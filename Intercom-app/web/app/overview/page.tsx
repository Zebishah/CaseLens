'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, DashboardIcon, MetricCard, PageSkeleton, SectionCard, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { ApiError, api } from '../../lib/api';
import { formatCategoryLabel, formatMentionStatus, formatRelativeTime } from '../../lib/case-display';

type RecentCase = {
  id: number;
  subject: string | null;
  status: string;
  category: string | null;
  employee: string | null;
  mentionStatus?: string | null;
  relatedCaseCount: number;
  confidence: number | null;
  receivedAt: string;
  source?: string;
};

type Overview = {
  casesProcessed: number;
  completed: number;
  failed: number;
  processing?: number;
  pending?: number;
  pendingManualReview: number;
  duplicateEventsPrevented: number;
  casesBySource?: Record<string, number>;
  casesByCategory?: Record<string, number>;
  mentionStatus?: Record<string, number>;
  matchedEmployeeCases?: number;
  casesWithRelated?: number;
  employeeDirectoryCount?: number;
  averageMatchConfidence?: number | null;
  lastIntercomWebhookAt?: string | null;
  recentCases?: RecentCase[];
};

type ReviewerOperations = {
  jobProcessingMode: string;
  actorRuns: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    retryableFailures: number;
    latestFailureCode: string | null;
    recentRunDurationMs: number | null;
  } | null;
  pendingOutbox: number;
  recoveryStatus: 'clear' | 'pending';
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const percent = (part: number, total: number): string => {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((part / total) * 100)}%`;
};

const mentionBars: Array<{ key: string; label: string; color: string }> = [
  { key: 'resolved', label: 'Matched to directory', color: 'bg-success' },
  { key: 'unresolved', label: 'Name found, unmatched', color: 'bg-highlight' },
  { key: 'ambiguous', label: 'Ambiguous match', color: 'bg-warning' },
  { key: 'no_employee_mentioned', label: 'No employee in subject', color: 'bg-primary/30' },
  { key: 'unknown', label: 'Processed before status tags', color: 'bg-muted/40' }
];

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [operations, setOperations] = useState<ReviewerOperations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ready = await api.ready();
        if (ready.status !== 'ready') {
          setSleeping(true);
          break;
        }

        setSleeping(false);
        const [overview, operationalSummary] = await Promise.all([
          api.get<Overview>('/api/cases/overview'),
          api.get<ReviewerOperations>('/api/operations/reviewer-summary')
        ]);
        setData(overview);
        setOperations(operationalSummary);
        break;
      } catch (err) {
        if (err instanceof ApiError && err.sleeping) {
          setSleeping(true);
          break;
        }

        if (attempt < 2) {
          await wait(700 * (attempt + 1));
          continue;
        }

        const raw = err instanceof Error ? err.message : 'Unable to load overview';
        setError(raw === 'Internal server error' ? 'The database host timed out. Retry in a moment.' : raw);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.casesProcessed ?? 0;
  const matched = data?.matchedEmployeeCases ?? 0;
  const related = data?.casesWithRelated ?? 0;
  const review = data?.pendingManualReview ?? 0;
  const categoryEntries = Object.entries(data?.casesByCategory ?? {}).sort((left, right) => right[1] - left[1]);
  const sourceEntries = Object.entries(data?.casesBySource ?? {});
  const mentionTotal = Object.values(data?.mentionStatus ?? {}).reduce((sum, value) => sum + value, 0);

  return (
    <AppShell
      title="Organization overview"
      description="A live view of what HR Intelligence is helping your organization accomplish: processed cases, directory matches, related history, and work that needs human review."
    >
      {sleeping ? (
        <AlertBanner
          tone="warning"
          title="Starting the service"
          action={
            <button type="button" onClick={() => void load()} className="btn-primary rounded-full px-4 py-2 text-sm font-medium">
              Retry
            </button>
          }
        >
          The host may be waking from sleep.
        </AlertBanner>
      ) : null}
      {loading && !data ? <PageSkeleton variant="overview" /> : null}
      {error ? (
        <AlertBanner
          tone="danger"
          title="Could not load overview"
          action={<TextButton onClick={() => void load()}>Retry</TextButton>}
        >
          {error}
        </AlertBanner>
      ) : null}

      {data ? (
        <div className="space-y-6">
          {operations ? (
            <section className="dash-panel" aria-labelledby="runtime-summary-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="dashboard-section-label">Read-only runtime evidence</p>
                  <h2 id="runtime-summary-title" className="mt-1 text-lg font-semibold text-primary">Background processing summary</h2>
                  <p className="mt-1 text-sm text-muted">Aggregate Actor run and recovery state from PostgreSQL. No provider payloads or identifiers are shown.</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{operations.jobProcessingMode} mode</span>
              </div>
              {operations.actorRuns ? <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OperationalMetric label="Actor runs queued" value={operations.actorRuns.queued} />
                <OperationalMetric label="Actor runs running" value={operations.actorRuns.running} />
                <OperationalMetric label="Actor runs completed" value={operations.actorRuns.completed} />
                <OperationalMetric label="Actor runs failed" value={operations.actorRuns.failed} />
                <OperationalMetric label="Retryable failures" value={operations.actorRuns.retryableFailures} />
                <OperationalMetric label="Latest failure code" value={operations.actorRuns.latestFailureCode ?? 'None'} />
                <OperationalMetric label="Recent run duration" value={operations.actorRuns.recentRunDurationMs == null ? '—' : `${operations.actorRuns.recentRunDurationMs} ms`} />
                <OperationalMetric label="Outbox recovery" value={operations.recoveryStatus === 'clear' ? 'Clear' : `${operations.pendingOutbox} pending`} />
              </dl> : <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-muted">Actor run counts are recorded when Apify mode is active. This deployment is using {operations.jobProcessingMode} mode.</p>}
            </section>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Last Intercom webhook:{' '}
              <span className="font-medium text-primary">
                {data.lastIntercomWebhookAt
                  ? `${formatRelativeTime(data.lastIntercomWebhookAt)} · ${new Date(data.lastIntercomWebhookAt).toLocaleString()}`
                  : 'None yet'}
              </span>
            </p>
            <button type="button" className="text-sm font-medium text-primary hover:text-primary-hover" onClick={() => void load()}>
              Refresh
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Cases processed"
              value={total}
              hint={`${data.completed} ready · ${data.processing ?? 0} running · ${data.failed} failed`}
              icon="cases"
            />
            <MetricCard
              label="Employees matched"
              value={matched}
              hint={`${percent(matched, total)} of cases linked to the directory · ${data.employeeDirectoryCount ?? 0} identities`}
              icon="users"
            />
            <MetricCard
              label="Related cases found"
              value={related}
              hint={`${percent(related, total)} of cases have at least one related conversation`}
              icon="link"
            />
            <MetricCard
              label="Manual review"
              value={review}
              hint={
                data.averageMatchConfidence != null
                  ? `Avg match confidence ${data.averageMatchConfidence}%`
                  : 'Waiting on an operator'
              }
              tone={review > 0 ? 'warning' : 'default'}
              icon="review"
            />
            <MetricCard
              label="Processing health"
              value={data.failed > 0 ? 'Needs attention' : 'Healthy'}
              hint={`${data.failed} failed · ${data.processing ?? 0} in progress · ${data.pending ?? 0} pending`}
              tone={data.failed > 0 ? 'warning' : 'success'}
              icon="activity"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="dash-panel lg:col-span-2">
              <p className="dashboard-section-label">Distribution</p>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-primary">Case categories</h2>
              <p className="mt-1 text-sm text-muted">From extracted case type on each conversation.</p>
              {categoryEntries.length === 0 ? (
                <p className="mt-8 text-sm text-muted">No categorized cases yet.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {categoryEntries.map(([label, count]) => (
                    <li key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-primary">{label}</span>
                        <span className="tabular-nums text-muted">
                          {count} · {percent(count, total)}
                        </span>
                      </div>
                      <div className="chart-track mt-2">
                        <div
                          className="chart-fill bg-secondary"
                          style={{ width: percent(count, total) }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dash-panel lg:col-span-2">
              <p className="dashboard-section-label">Resolution</p>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-primary">Identity resolution</h2>
              <p className="mt-1 text-sm text-muted">How extracted names landed against the employee directory.</p>
              <ul className="mt-5 space-y-4">
                {mentionBars
                  .filter((row) => (data.mentionStatus?.[row.key] ?? 0) > 0 || row.key === 'resolved')
                  .map((row) => {
                  const count = data.mentionStatus?.[row.key] ?? 0;
                  return (
                    <li key={row.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-primary">{row.label}</span>
                        <span className="tabular-nums text-muted">{count}</span>
                      </div>
                      <div className="chart-track mt-2">
                        <div
                          className={`chart-fill ${row.color}`}
                          style={{ width: percent(count, mentionTotal || total) }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {sourceEntries.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {sourceEntries.map(([source, count]) => (
                    <span
                      key={source}
                      className="rounded-full bg-paper px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted"
                    >
                      {source} · {count}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="dash-panel lg:col-span-1">
              <p className="dashboard-section-label">Pipeline</p>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-primary">Processing status</h2>
              <p className="mt-1 text-sm text-muted">Current case state, not a historical trend.</p>
              <div className="mt-5 space-y-3">
                {[
                  ['Ready', data.completed, 'bg-success'],
                  ['Processing', data.processing ?? 0, 'bg-secondary'],
                  ['Pending', data.pending ?? 0, 'bg-slate-400'],
                  ['Failed', data.failed, 'bg-danger']
                ].map(([label, count, color]) => (
                  <div key={String(label)}>
                    <div className="flex items-center justify-between text-sm"><span className="text-primary">{label}</span><span className="tabular-nums text-muted">{count}</span></div>
                    <div className="chart-track mt-2"><div className={`chart-fill ${color}`} style={{ width: percent(Number(count), total) }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <SectionCard title="Attention queue" description="Only items that can change an operator’s next action appear here.">
              <div className="grid gap-3 sm:grid-cols-2">
                <AttentionItem label="Manual review" value={review} copy={review > 0 ? 'Cases need an operator decision.' : 'All current cases resolved without manual review.'} tone={review > 0 ? 'warning' : 'success'} />
                <AttentionItem label="Failed processing" value={data.failed} copy={data.failed > 0 ? 'Inspect failures in Operations.' : 'No failed case jobs require intervention.'} tone={data.failed > 0 ? 'warning' : 'success'} />
                <AttentionItem label="Pending work" value={data.pending ?? 0} copy={data.pending ? 'Cases are waiting to be processed.' : 'No cases are waiting in the pipeline.'} tone={data.pending ? 'warning' : 'success'} />
                <AttentionItem label="Duplicate events blocked" value={data.duplicateEventsPrevented} copy="Repeated inbound events safely ignored." tone="success" />
              </div>
            </SectionCard>
            <SectionCard title="Platform proof" description="A compact tour of the workflow behind these live records." action={<Link href="/demo" className="text-sm font-semibold text-primary hover:text-primary-hover">Open walkthrough →</Link>}>
              <div className="flex items-start gap-3 rounded-xl border border-primary/10 bg-emerald-50/60 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-secondary shadow-sm"><DashboardIcon name="spark" /></span>
                <div><p className="text-sm font-semibold text-primary">Cases become explainable work</p><p className="mt-1 text-sm leading-5 text-muted">Identity evidence, related history, routing context, and safe processing state are shown together.</p></div>
              </div>
            </SectionCard>
          </section>

          <section className="dash-panel overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-primary">Recent cases</h2>
                <p className="mt-1 text-sm text-muted">Newest conversations in the intelligence store.</p>
              </div>
              <Link href="/cases" className="text-sm font-medium text-primary hover:text-primary-hover">
                View all
              </Link>
            </div>
            {(data.recentCases ?? []).length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted">No cases stored yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="dash-table min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      {['Subject', 'Employee', 'Category', 'Related', 'Status', 'Received'].map((heading) => (
                        <th key={heading} className="px-5 py-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentCases ?? []).map((row) => (
                      <tr key={row.id} className="dash-row border-t border-primary/8">
                        <td className="max-w-[22rem] px-5 py-3">
                          <Link className="line-clamp-1 font-medium text-primary hover:text-primary-hover" href={`/cases/${row.id}`}>
                            {row.subject ?? '(no subject)'}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-primary">{row.employee ?? '—'}</p>
                          <p className="text-xs text-muted">{formatMentionStatus(row.mentionStatus)}</p>
                        </td>
                        <td className="px-5 py-3 text-muted">{formatCategoryLabel(row.category)}</td>
                        <td className="px-5 py-3 tabular-nums">{row.relatedCaseCount}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3 text-muted">{formatRelativeTime(row.receivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-muted">Live database snapshot · Last Intercom webhook: {data.lastIntercomWebhookAt ? formatRelativeTime(data.lastIntercomWebhookAt) : 'none recorded'}.</p>
        </div>
      ) : null}
    </AppShell>
  );
}

function OperationalMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd></div>;
}

function AttentionItem({ label, value, copy, tone }: { label: string; value: number; copy: string; tone: 'warning' | 'success' }) {
  return (
    <div className={`attention-item ${tone === 'success' ? 'is-clear' : ''} rounded-xl px-4 py-3`}>
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-primary">{label}</p><span className="text-lg font-semibold tabular-nums text-primary">{value}</span></div>
      <p className="mt-1 text-xs leading-5 text-muted">{copy}</p>
    </div>
  );
}
