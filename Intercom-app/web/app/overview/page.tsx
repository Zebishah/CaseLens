'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
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
        setData(await api.get<Overview>('/api/cases/overview'));
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
      title="Overview"
      description="Live counts from this environment’s PostgreSQL store — processed Intercom cases, directory matches, and related-case links. Nothing here is seeded demo copy."
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Cases processed"
              value={total}
              hint={`${data.completed} ready · ${data.processing ?? 0} running · ${data.failed} failed`}
            />
            <KpiCard
              label="Employees matched"
              value={matched}
              hint={`${percent(matched, total)} of cases linked to the directory · ${data.employeeDirectoryCount ?? 0} identities`}
            />
            <KpiCard
              label="Related cases found"
              value={related}
              hint={`${percent(related, total)} of cases have at least one related conversation`}
            />
            <KpiCard
              label="Manual review"
              value={review}
              hint={
                data.averageMatchConfidence != null
                  ? `Avg match confidence ${data.averageMatchConfidence}%`
                  : 'Waiting on an operator'
              }
              tone={review > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="dash-panel lg:col-span-3">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Case categories</h2>
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
                      <div className="h-2 overflow-hidden rounded-full bg-paper">
                        <div
                          className="h-full rounded-full bg-secondary"
                          style={{ width: percent(count, total) }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dash-panel lg:col-span-2">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Identity resolution</h2>
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
                      <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                        <div
                          className={`h-full rounded-full ${row.color}`}
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
          </div>

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

          <p className="text-xs text-muted">
            Duplicates blocked: {data.duplicateEventsPrevented}. These figures update when Intercom conversations are processed.
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default'
}: {
  label: string;
  value: number;
  hint: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className={`dash-panel ${tone === 'warning' && value > 0 ? 'ring-1 ring-highlight/40' : ''}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-primary">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted">{hint}</p>
    </div>
  );
}
