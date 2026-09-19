'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { AlertBanner, PageSkeleton, SectionCard, StatusBadge, TextButton } from '../../../components/dashboard/ui';
import { api } from '../../../lib/api';
import { AUTH_STATE_EVENT, getAdminToken, getAdminUser } from '../../../lib/auth-token';

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<'accurate' | 'needs_review' | 'incorrect'>('accurate');
  const [correction, setCorrection] = useState({ employee: '', caseType: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [correctionSaved, setCorrectionSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(() => getAdminUser()?.role);
  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const adminToken = getAdminToken();
      const demoToken = typeof window !== 'undefined' ? sessionStorage.getItem('demoToken') : null;
      if (adminToken) {
        setData(await api.get(`/api/cases/${params.id}`));
      } else if (demoToken) {
        setData(await api.get(`/api/demo/cases/${params.id}`));
      } else {
        throw new Error('Sign in as an operator to open this case.');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load case');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncRole = () => setRole(getAdminUser()?.role);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => window.removeEventListener(AUTH_STATE_EVENT, syncRole);
  }, []);

  const submitFeedback = async () => {
    const adminToken = getAdminToken();
    const demoToken = typeof window !== 'undefined' ? sessionStorage.getItem('demoToken') : null;
    const path =
      adminToken || !demoToken ? `/api/cases/${params.id}/feedback` : `/api/demo/cases/${params.id}/feedback`;
    await api.post(path, {
      rating: feedbackRating,
      comment
    });
    setSaved(true);
    await load();
  };

  const submitCorrection = async (fieldName: 'employee' | 'caseType') => {
    const correctedValue = correction[fieldName].trim();
    if (!correctedValue) {
      setCorrectionSaved('Enter a correction before saving it.');
      return;
    }

    try {
      await api.post(`/api/cases/${params.id}/corrections`, { fieldName, correctedValue });
      setCorrectionSaved(`${fieldName === 'employee' ? 'Employee' : 'Category'} correction saved.`);
      setCorrection((current) => ({ ...current, [fieldName]: '' }));
      await load();
    } catch (err) {
      setCorrectionSaved(err instanceof Error ? err.message : 'Correction could not be saved.');
    }
  };

  const snapshot = (data?.snapshot ?? {}) as {
    processingMode?: string;
    employeeMatches?: Array<{ canonicalName: string; confidenceScore: number; matchMethod?: string }>;
            relatedCases?: Array<{
              conversationId?: number;
              intercomId?: string;
              subject?: string;
              matchedEmployeeNames?: string[];
              openInIntercomUrl?: string | null;
            }>;
    ccRecipients?: { recipients?: Array<{ name: string; email: string; role: string }> };
    requiresManualReview?: boolean;
    caseType?: string;
  };
  const conversation = (data?.conversation ?? {}) as {
    body?: string;
    sender?: string;
    senderName?: string;
    subject?: string;
    source?: string;
  };
  const timeline = (data?.timeline ?? {}) as {
    createdAt?: string;
    processedAt?: string;
    processingDurationMs?: number;
    correlationId?: string;
  };

  const caseRow = (data?.case ?? {}) as {
    openInIntercomUrl?: string | null;
    intercomSyncStatus?: string | null;
  };
  const employee = snapshot.employeeMatches?.[0];

  return (
    <AppShell
      title="Case intelligence"
      description="This page inspects the persisted intelligence snapshot. Inbox reading and replies stay in Intercom."
    >
      {error ? (
        <AlertBanner tone="danger" title="Could not load this case" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>
          {error}
        </AlertBanner>
      ) : null}
      {loading && !data && !error ? <PageSkeleton variant="detail" /> : null}
      {data ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-primary/15 bg-slate-950 p-5 text-white shadow-lift md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="dashboard-section-label text-emerald-300">Case intelligence · #{String(params.id).padStart(4, '0')}</p>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight md:text-3xl">{conversation.subject ?? 'Untitled conversation'}</h2>
                <p className="mt-2 text-sm text-slate-300">{conversation.source} intake · {conversation.senderName ?? 'Unknown reporter'} · received {timeline.createdAt ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={String(caseRow.intercomSyncStatus ?? (snapshot.processingMode === 'live' ? 'ready' : 'processed'))} />
                {caseRow.openInIntercomUrl ? <a className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-50" href={caseRow.openInIntercomUrl} target="_blank" rel="noreferrer">Open in Intercom ↗</a> : null}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <HeroFact label="Identity" value={employee?.canonicalName ?? 'Not matched'} detail={employee ? `${employee.confidenceScore}% confidence` : 'Requires evidence review'} />
              <HeroFact label="Classification" value={snapshot.caseType ?? 'Uncategorized'} detail="Extracted case type" />
              <HeroFact label="Attention" value={snapshot.requiresManualReview ? 'Manual review' : 'No review required'} detail={snapshot.requiresManualReview ? 'Operator decision recommended' : 'Evidence threshold met'} />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Conversation intake" description="The source context that entered the intelligence pipeline.">
            <p className="text-sm text-muted">
              {conversation.source} · {conversation.senderName} · {conversation.sender}
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-primary">{conversation.subject}</h3>
            <blockquote className="mt-5 rounded-xl bg-paper px-5 py-4 text-sm leading-7 text-foreground">
              {conversation.body}
            </blockquote>
          </SectionCard>
          <SectionCard
            title="Identity & routing evidence"
            description="Persisted outputs, with uncertainty kept visible for operators."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {caseRow.openInIntercomUrl ? (
                  <a
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    href={caseRow.openInIntercomUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Intercom
                  </a>
                ) : null}
                {snapshot.processingMode === 'live' ? (
                  <StatusBadge status="ready" />
                ) : (
                  <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-primary">Processed</span>
                )}
              </div>
            }
          >
            <dl className="space-y-3">
              <div className="rounded-lg bg-paper px-4 py-3">
                <dt className="text-xs tracking-[0.14em] text-muted">Category</dt>
                <dd className="mt-1 font-semibold text-primary">{snapshot.caseType ?? '—'}</dd>
              </div>
              <div className="rounded-lg bg-paper px-4 py-3">
                <dt className="text-xs tracking-[0.14em] text-muted">Employee</dt>
                <dd className="mt-1 font-semibold text-primary">
                  {employee?.canonicalName ?? 'Not matched'}
                  {employee ? (
                    <span className="ml-2 text-sm font-normal text-muted">
                      {employee.confidenceScore}%
                      {employee.matchMethod ? ` · ${employee.matchMethod}` : ''}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="rounded-lg bg-paper px-4 py-3">
                <dt className="text-xs tracking-[0.14em] text-muted">Manual review</dt>
                <dd className="mt-1 font-semibold text-primary">{snapshot.requiresManualReview ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            <h3 className="mt-6 text-sm font-semibold text-primary">Related history</h3>
            {(snapshot.relatedCases ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted">No related cases matched.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {(snapshot.relatedCases ?? []).map((related, index) => (
                  <li key={index} className="border-l-2 border-secondary pl-3">
                    {related.conversationId ? (
                      <a className="font-medium text-primary" href={`/cases/${related.conversationId}`}>
                        {related.subject}
                      </a>
                    ) : (
                      related.subject
                    )}{' '}
                    ({related.matchedEmployeeNames?.join(', ')})
                    {related.openInIntercomUrl ? (
                      <>
                        {' '}
                        <a
                          className="text-secondary hover:text-primary"
                          href={related.openInIntercomUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Intercom
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-6 text-sm font-semibold text-primary">Stakeholder routing</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(snapshot.ccRecipients?.recipients ?? []).map((recipient) => (
                <li key={recipient.email}>
                  {recipient.name} · {recipient.role}
                </li>
              ))}
            </ul>
            {isAdmin ? (
              <p className="mt-6 text-xs leading-5 text-muted">
                Received {timeline.createdAt ?? '—'} · Processed {timeline.processedAt ?? 'pending'} ·{' '}
                {timeline.processingDurationMs ?? '—'} ms
                {timeline.correlationId ? ` · ${timeline.correlationId}` : ''}
                {caseRow.intercomSyncStatus ? ` · Intercom sync ${caseRow.intercomSyncStatus}` : ''}
              </p>
            ) : (
              <p className="mt-6 text-xs leading-5 text-muted">
                Generated from the persisted intelligence snapshot. Open the source conversation in Intercom to review the operator workflow.
              </p>
            )}
          </SectionCard>
          </div>

          <SectionCard title="Processing timeline" description="How this case moved through ingestion, intelligence, review, and optional write-back.">
            <div className="grid gap-3 md:grid-cols-4">
              <TimelineStep label="Received" value={timeline.createdAt ?? '—'} done />
              <TimelineStep label="Processed" value={timeline.processedAt ?? 'Pending'} done={Boolean(timeline.processedAt)} />
              <TimelineStep label="Human review" value={snapshot.requiresManualReview ? 'Required' : 'Not required'} done={!snapshot.requiresManualReview} warning={snapshot.requiresManualReview} />
              <TimelineStep label="Intercom sync" value={caseRow.intercomSyncStatus ?? 'Not available'} done={caseRow.intercomSyncStatus === 'synced' || caseRow.intercomSyncStatus === 'success'} />
            </div>
            {isAdmin ? <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-muted">Processing mode: {snapshot.processingMode ?? '—'} · Duration: {timeline.processingDurationMs ?? '—'} ms · Correlation: {timeline.correlationId ?? '—'}</p> : null}
          </SectionCard>

          {isAdmin ? <SectionCard title="Operator feedback" description="Confirm the result or record a lightweight correction. AI assists; humans decide.">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitFeedback();
              }}
            >
              <div className="flex flex-wrap gap-2" role="group" aria-label="Feedback rating">
                {([
                  ['accurate', 'Accurate'],
                  ['needs_review', 'Needs review'],
                  ['incorrect', 'Incorrect']
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={feedbackRating === value}
                    onClick={() => setFeedbackRating(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${feedbackRating === value ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-sm text-primary">
                Comment
                <textarea
                  className="dash-field mt-2 min-h-[7rem]"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold">
                Save feedback
              </button>
              {saved ? <p className="mt-3 text-sm text-success">Feedback saved for this case.</p> : null}
            </form>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-primary">Correct the persisted result</h3>
              <p className="mt-1 text-xs leading-5 text-muted">These protected admin actions preserve the correction on the snapshot and prevent silent overwrites until re-analysis.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-sm text-primary">
                  Employee
                  <input className="dash-field mt-2" value={correction.employee} placeholder={employee?.canonicalName ?? 'Canonical employee name'} onChange={(event) => setCorrection({ ...correction, employee: event.target.value })} />
                  <button type="button" className="btn-secondary mt-2 rounded-lg px-3 py-2 text-xs font-semibold" onClick={() => void submitCorrection('employee')}>Save employee correction</button>
                </label>
                <label className="block text-sm text-primary">
                  Category
                  <input className="dash-field mt-2" value={correction.caseType} placeholder={snapshot.caseType ?? 'Case category'} onChange={(event) => setCorrection({ ...correction, caseType: event.target.value })} />
                  <button type="button" className="btn-secondary mt-2 rounded-lg px-3 py-2 text-xs font-semibold" onClick={() => void submitCorrection('caseType')}>Save category correction</button>
                </label>
              </div>
              {correctionSaved ? <p className="mt-3 text-sm text-success" role="status">{correctionSaved}</p> : null}
            </div>
          </SectionCard> : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function HeroFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">{label}</p><p className="mt-2 truncate text-sm font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>;
}

function TimelineStep({ label, value, done, warning = false }: { label: string; value: string; done: boolean; warning?: boolean }) {
  return <div className="relative rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><span className={`absolute left-4 top-4 h-2 w-2 rounded-full ${warning ? 'bg-warning' : done ? 'bg-success' : 'bg-slate-300'}`} /><div className="pl-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value}</p></div></div>;
}
