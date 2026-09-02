'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, MetricCard, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';

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

export default function OperationsPage() {
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

  return (
    <AppShell title="Operations" description="Monitor ingestion, queue health, delivery safeguards, and Intercom write-back from one operational view.">
      {error ? <AlertBanner tone="danger" title="Operation could not be completed" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {message ? <AlertBanner tone="success" title="Action completed">{message}</AlertBanner> : null}
      {loading ? <PageSkeleton variant="overview" /> : null}

      {!loading && data ? (
        <div className="space-y-5">
          <section className="dash-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${data.intercom?.enabled && data.intercom?.connected ? 'bg-success' : 'bg-warning'}`} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Intercom integration</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{data.intercom?.enabled && data.intercom?.connected ? 'Connected and receiving events' : data.intercom?.enabled ? 'Enabled — connection needs attention' : 'Integration disabled'}</h2>
                  <p className="mt-1 text-sm text-slate-500">Workspace: {data.intercom?.workspace ?? 'Not configured'}{data.intercom?.lastWebhookTopic ? ` · Last topic: ${data.intercom.lastWebhookTopic}` : ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Refresh status</button>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              <OperationalFact label="Last webhook" value={data.intercom?.lastWebhookAt ? new Date(data.intercom.lastWebhookAt).toLocaleString() : 'No event received'} />
              <OperationalFact label="Last write-back" value={data.intercom?.lastSuccessfulWritebackAt ? new Date(data.intercom.lastSuccessfulWritebackAt).toLocaleString() : 'No successful sync'} />
              <OperationalFact label="Write-back failures" value={String(data.intercom?.writebackFailures ?? 0)} />
              <OperationalFact label="Execution" value={`${data.jobProcessingMode ?? 'inline'} · workers ${data.workersEnabled ? 'on' : 'off'}`} />
            </dl>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {queueEntries.map(([name, value]) => <MetricCard key={name} label={name.replace(/([A-Z])/g, ' $1')} value={value} hint="Current intelligence queue" />)}
            <MetricCard label="Duplicates blocked" value={data.duplicateEventsPrevented ?? 0} hint="Repeated inbound events rejected" />
            <MetricCard label="Pending outbox" value={data.pendingOutbox ?? 0} hint="Durable jobs awaiting dispatch" />
            <MetricCard label="Write-backs synced" value={data.intercom?.writebacksSynced ?? 0} hint="Intercom updates completed" />
          </div>

          <section className="dash-panel overflow-hidden !p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-base font-semibold text-slate-900">Dead-letter queue</h2><p className="mt-1 text-sm text-slate-500">Permanently failed jobs requiring operator review.</p></div>
              <button type="button" disabled={action === 'recover'} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" onClick={() => void recover()}>{action === 'recover' ? 'Recovering…' : 'Recover outbox'}</button>
            </div>
            {(data.deadLetter ?? []).length === 0 ? <div className="p-5"><EmptyState title="Queue is healthy">No failed jobs are waiting for intervention.</EmptyState></div> : (
              <div className="overflow-x-auto"><table className="dash-table min-w-[52rem] w-full text-left text-sm"><thead><tr>{['Job', 'Case', 'Attempts', 'Safe error', 'Action'].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{(data.deadLetter ?? []).map((job) => <tr key={job.id} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-mono text-xs text-slate-500">{job.id ?? '—'}</td><td className="px-5 py-4 font-medium text-slate-800">{job.conversationId ?? '—'}</td><td className="px-5 py-4 text-slate-600">{job.attempts}</td><td className="max-w-md px-5 py-4 text-slate-600">{job.safeError ?? 'No safe error message'}</td><td className="px-5 py-4">{job.conversationId ? <button className="font-semibold text-primary hover:text-primary-hover" type="button" onClick={() => void replay(String(job.conversationId), true)}>Replay</button> : '—'}</td></tr>)}</tbody></table></div>
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
