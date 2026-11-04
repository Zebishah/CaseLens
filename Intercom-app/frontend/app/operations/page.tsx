'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, MetricCard, PageSkeleton, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { isDemoRecruiter } from '../../lib/auth-token';

type QueueCounts = Record<string, number>;
type DeadLetterJob = { id?: string; attempts: number; safeError: string | null; conversationId: number | null; correlationId: string | null };
type Operations = {
  jobProcessingMode?: string;
  workersEnabled?: boolean;
  pendingOutbox?: number;
  queues?: { intelligence?: QueueCounts };
  deadLetter?: DeadLetterJob[];
  duplicateEventsPrevented?: number;
  intercom?: { enabled: boolean; connected: boolean; workspace?: string | null; lastWebhookAt: string | null; lastWebhookTopic: string | null; lastSuccessfulWritebackAt: string | null; writebackFailures: number; writebacksSynced: number };
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

export default function OperationsPage() {
  const [mode, setMode] = useState<'checking' | 'demo' | 'standard'>('checking');

  useEffect(() => {
    setMode(isDemoRecruiter() ? 'demo' : 'standard');
  }, []);

  if (mode === 'checking') {
    return <div className="theme-light min-h-screen bg-paper" aria-busy="true" />;
  }

  return mode === 'demo' ? <RecruiterOperationsPage /> : <AdminOperationsPage />;
}

function RecruiterOperationsPage() {
  const [data, setData] = useState<ReviewerOperations | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<ReviewerOperations>('/api/operations/reviewer-summary'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load operational summary');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const actorRuns = data?.actorRuns;
  return (
    <AppShell title="Operational health" description="Review aggregate ingestion and background-processing health from the synthetic workspace. Recovery, replay, and write-back controls are reserved for administrators.">
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
        <span><strong className="font-semibold">Product demo · Read-only.</strong> This view shows safe operational summaries without maintenance actions.</span>
      </div>
      {error ? <AlertBanner tone="danger" title="Could not load operational health" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {!data && !error ? <PageSkeleton variant="overview" /> : null}
      {data ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-primary/15 bg-mist p-5 text-white shadow-lift md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="dashboard-section-label text-emerald-300">Read-only runtime evidence</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Background processing summary</h2>
                <p className="mt-1 text-sm text-slate-400">Aggregate run and recovery state from PostgreSQL. No provider payloads or identifiers are shown.</p>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">{data.jobProcessingMode} mode</span>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Actor runs queued" value={actorRuns?.queued ?? 0} hint="Awaiting background execution" icon="activity" />
            <MetricCard label="Actor runs running" value={actorRuns?.running ?? 0} hint="Currently processing" icon="activity" />
            <MetricCard label="Actor runs completed" value={actorRuns?.completed ?? 0} hint="Completed safely" icon="review" tone="success" />
            <MetricCard label="Actor runs failed" value={actorRuns?.failed ?? 0} hint="Visible for operator review" icon="shield" tone={actorRuns?.failed ? 'warning' : 'default'} />
            <MetricCard label="Retryable failures" value={actorRuns?.retryableFailures ?? 0} hint="Bounded recovery candidates" icon="activity" tone={actorRuns?.retryableFailures ? 'warning' : 'default'} />
            <MetricCard label="Pending outbox" value={data.pendingOutbox} hint="Durable dispatch intent" icon="cases" tone={data.pendingOutbox ? 'warning' : 'default'} />
            <MetricCard label="Recovery status" value={data.recoveryStatus === 'clear' ? 'Clear' : 'Pending'} hint="Safe aggregate readiness" icon="shield" tone={data.recoveryStatus === 'clear' ? 'success' : 'warning'} />
            <MetricCard label="Latest failure" value={actorRuns?.latestFailureCode ?? 'None'} hint="Safe failure classification" icon="activity" />
          </div>

          <section className="dash-panel">
            <h2 className="text-base font-semibold text-primary">What recruiters can inspect</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-3">
              <li className="rounded-xl bg-paper p-4">Whether background work is queued, running, complete, or failed.</li>
              <li className="rounded-xl bg-paper p-4">Whether durable outbox work is clear or waiting for recovery.</li>
              <li className="rounded-xl bg-paper p-4">Safe failure categories without replay or write-back controls.</li>
            </ul>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function AdminOperationsPage() {
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayId, setReplayId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await api.get<Operations>('/api/operations/queues')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load operations'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const replay = async (conversationId: string, force = false) => {
    setAction('replay'); setMessage(null); setError(null);
    try { await api.post(`/api/operations/replay/${conversationId}`, { force }); setMessage(`Queued replay for case ${conversationId}.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Replay failed'); }
    finally { setAction(null); }
  };

  const retryWriteback = async () => {
    setAction('writeback'); setMessage(null); setError(null);
    try { await api.post(`/api/operations/intercom-sync/${replayId}`, {}); setMessage(`Retried Intercom write-back for case ${replayId}.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Write-back retry failed'); }
    finally { setAction(null); }
  };

  const recover = async () => {
    setAction('recover'); setMessage(null); setError(null);
    try { const result = await api.post<{ dispatched: number }>('/api/operations/outbox/recover', {}); setMessage(`Dispatched ${result.dispatched} pending outbox records.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Outbox recovery failed'); }
    finally { setAction(null); }
  };

  const counts = data?.queues?.intelligence ?? {};
  const queueEntries = Object.entries(counts);
  const workspaceName =
    process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_NAME?.trim() ||
    data?.intercom?.workspace ||
    'Nagumo Workspace [DEV]';
  const runtimeLabel =
    data?.jobProcessingMode === 'bullmq'
      ? 'Distributed queue workers'
      : 'Workspace-safe inline processing';

  return (
    <AppShell title="Operational health" description="Monitor the risks that can interrupt organizational case work: ingestion, durable delivery, queue processing, retries, outbox recovery, and Intercom synchronization.">
      {error ? <AlertBanner tone="danger" title="Operation could not be completed" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {message ? <AlertBanner tone="success" title="Action completed">{message}</AlertBanner> : null}
      {loading ? <PageSkeleton variant="overview" /> : null}

      {!loading && data ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-primary/15 bg-mist p-5 text-white shadow-lift md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${data.intercom?.enabled && data.intercom?.connected ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                <div>
                  <p className="dashboard-section-label text-emerald-300">System health</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{data.intercom?.enabled && data.intercom?.connected ? 'Connected and receiving events' : data.intercom?.enabled ? 'Enabled — connection needs attention' : 'Integration disabled'}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Workspace: {workspaceName}
                    {data.intercom?.lastWebhookTopic
                      ? ` · Latest event: ${formatWebhookTopic(data.intercom.lastWebhookTopic)}`
                      : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/15">Refresh status</button>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              <OperationalFact label="Last webhook" value={data.intercom?.lastWebhookAt ? new Date(data.intercom.lastWebhookAt).toLocaleString() : 'No event received'} />
              <OperationalFact label="Last write-back" value={data.intercom?.lastSuccessfulWritebackAt ? new Date(data.intercom.lastSuccessfulWritebackAt).toLocaleString() : 'No successful sync'} />
              <OperationalFact label="Write-back failures" value={String(data.intercom?.writebackFailures ?? 0)} />
              <OperationalFact label="Runtime" value={runtimeLabel} />
            </dl>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {queueEntries.map(([name, value]) => <MetricCard key={name} label={name.replace(/([A-Z])/g, ' $1')} value={value} hint="Current intelligence queue" icon="activity" tone={name === 'failed' && value > 0 ? 'warning' : 'default'} />)}
            <MetricCard label="Duplicates blocked" value={data.duplicateEventsPrevented ?? 0} hint="Repeated inbound events rejected" icon="shield" tone="success" />
            <MetricCard label="Pending outbox" value={data.pendingOutbox ?? 0} hint="Durable jobs awaiting dispatch" icon="cases" tone={(data.pendingOutbox ?? 0) > 0 ? 'warning' : 'default'} />
            <MetricCard label="Write-backs synced" value={data.intercom?.writebacksSynced ?? 0} hint="Intercom updates completed" icon="link" tone="success" />
          </div>

          <section className="dash-panel overflow-hidden !p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-base font-semibold text-slate-900">Dead-letter queue</h2><p className="mt-1 text-sm text-slate-500">Permanently failed jobs requiring operator review.</p></div>
              {(data.pendingOutbox ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={action === 'recover'}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void recover()}
                >
                  {action === 'recover' ? 'Dispatching…' : 'Dispatch pending events'}
                </button>
              ) : null}
            </div>
            {(data.deadLetter ?? []).length === 0 ? <div className="p-5"><EmptyState title="Queue is healthy">No failed jobs are waiting for intervention.</EmptyState></div> : (
              <div className="overflow-x-auto"><table className="dash-table min-w-[52rem] w-full text-left text-sm"><thead><tr>{['Job', 'Case', 'Attempts', 'Safe error', 'Action'].map((h) => <th scope="col" key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{(data.deadLetter ?? []).map((job) => <tr key={job.id} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-mono text-xs text-slate-500">{job.id ?? '—'}</td><td className="px-5 py-4 font-medium text-slate-800">{job.conversationId ?? '—'}</td><td className="px-5 py-4 text-slate-600">{job.attempts}</td><td className="max-w-md px-5 py-4 text-slate-600">{job.safeError ?? 'No safe error message'}</td><td className="px-5 py-4">{job.conversationId ? <button className="font-semibold text-primary hover:text-primary-hover" type="button" onClick={() => void replay(String(job.conversationId), true)}>Replay</button> : '—'}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <details className="dash-panel group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div><h2 className="text-base font-semibold text-slate-900">Maintenance actions</h2><p className="mt-1 text-sm text-slate-500">Targeted recovery controls for a known case ID.</p></div>
              <span className="text-sm font-semibold text-primary group-open:hidden">Open controls</span><span className="hidden text-sm font-semibold text-primary group-open:inline">Close controls</span>
            </summary>
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
              <form className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); void retryWriteback(); }}>
                <h3 className="text-sm font-semibold text-slate-900">Retry Intercom write-back</h3><p className="mt-1 text-xs leading-5 text-slate-500">Re-send the persisted intelligence result without reprocessing the case.</p>
                <input aria-label="Case ID for write-back" inputMode="numeric" placeholder="Case ID" className="dash-field mt-4 h-11" value={replayId} onChange={(event) => setReplayId(event.target.value)} />
                <button disabled={!replayId.trim() || action !== null} type="submit" className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{action === 'writeback' ? 'Retrying…' : 'Retry write-back'}</button>
              </form>
              <form className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" onSubmit={(event) => { event.preventDefault(); void replay(replayId, true); }}>
                <h3 className="text-sm font-semibold text-slate-900">Force intelligence replay</h3><p className="mt-1 text-xs leading-5 text-slate-500">Run the complete pipeline again. Use only after correcting source data or configuration.</p>
                <input aria-label="Case ID for replay" inputMode="numeric" placeholder="Case ID" className="dash-field mt-4 h-11" value={replayId} onChange={(event) => setReplayId(event.target.value)} />
                <button disabled={!replayId.trim() || action !== null} type="submit" className="mt-3 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{action === 'replay' ? 'Replaying…' : 'Force replay'}</button>
              </form>
            </div>
          </details>
        </div>
      ) : null}
    </AppShell>
  );
}

function OperationalFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-slate-800">{value}</dd></div>;
}

function formatWebhookTopic(topic: string): string {
  const labels: Record<string, string> = {
    'conversation.user.created': 'New conversation received',
    'conversation.user.replied': 'Conversation reply received',
    'conversation.admin.replied': 'Operator reply received',
    'conversation.admin.closed': 'Conversation closed'
  };
  return labels[topic] ?? 'Intercom event received';
}
