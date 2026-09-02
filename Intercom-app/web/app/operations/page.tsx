'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, MetricCard, SectionCard, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';

type QueueCounts = Record<string, number>;
type DeadLetterJob = {
  id?: string;
  attempts: number;
  safeError: string | null;
  conversationId: number | null;
  correlationId: string | null;
};

type Operations = {
  jobProcessingMode?: string;
  workersEnabled?: boolean;
  pendingOutbox?: number;
  queues?: { intelligence?: QueueCounts };
  deadLetter?: DeadLetterJob[];
  duplicateEventsPrevented?: number;
  intercom?: {
    enabled: boolean;
    connected: boolean;
    workspace?: string | null;
    lastWebhookAt: string | null;
    lastWebhookTopic: string | null;
    lastSuccessfulWritebackAt: string | null;
    writebackFailures: number;
    writebacksSynced: number;
  };
};

export default function OperationsPage() {
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayId, setReplayId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api
      .get<Operations>('/api/operations/queues')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load operations'));
  };

  useEffect(() => {
    load();
  }, []);

  const replay = async (conversationId: string, force = false) => {
    setMessage(null);
    await api.post(`/api/operations/replay/${conversationId}`, { force });
    setMessage(`Queued replay for case ${conversationId}`);
    load();
  };

  const recover = async () => {
    const result = await api.post<{ dispatched: number }>('/api/operations/outbox/recover', {});
    setMessage(`Dispatched ${result.dispatched} pending outbox records`);
    load();
  };

  const counts = data?.queues?.intelligence ?? {};
  const queueEntries = Object.entries(counts);

  return (
    <AppShell
      title="Operations"
      description="Engineering and reliability for ingestion, queues, and Intercom write-back. Secrets are never shown."
    >
      {error ? (
        <AlertBanner tone="danger" title="Could not load operations" action={<TextButton onClick={load}>Retry</TextButton>}>
          {error}
        </AlertBanner>
      ) : null}
      {message ? (
        <div className="mb-4">
          <AlertBanner tone="success" title="Action queued">
            {message}
          </AlertBanner>
        </div>
      ) : null}
      {data ? (
        <div className="space-y-5">
          <SectionCard title="Intercom">
            <p className="text-2xl font-bold text-primary">
              {data.intercom?.enabled ? 'Connected' : 'Disabled'}
            </p>
            <p className="mt-1 text-sm text-muted">
              Workspace: {data.intercom?.workspace ?? 'Not configured'}
              {data.intercom?.lastWebhookTopic ? ` · last topic ${data.intercom.lastWebhookTopic}` : ''}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted">Last webhook</dt>
                <dd className="mt-1 text-primary">
                  {data.intercom?.lastWebhookAt ? new Date(data.intercom.lastWebhookAt).toLocaleString() : 'None yet'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last successful write-back</dt>
                <dd className="mt-1 text-primary">
                  {data.intercom?.lastSuccessfulWritebackAt
                    ? new Date(data.intercom.lastSuccessfulWritebackAt).toLocaleString()
                    : 'None yet'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Write-back failures</dt>
                <dd className="mt-1 text-primary">{data.intercom?.writebackFailures ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted">Processing mode</dt>
                <dd className="mt-1 text-primary">
                  {data.jobProcessingMode ?? 'inline'} · workers {data.workersEnabled ? 'on' : 'off'}
                </dd>
              </div>
            </dl>
          </SectionCard>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {queueEntries.map(([name, value], index) => (
              <MetricCard key={name} label={name} value={value} delay={index * 70} />
            ))}
            <MetricCard
              label="Duplicates blocked"
              value={data.duplicateEventsPrevented ?? 0}
              hint="Same inbound event rejected"
              delay={queueEntries.length * 70}
            />
            <MetricCard
              label="Pending outbox"
              value={data.pendingOutbox ?? 0}
              hint="Durable jobs not yet dispatched"
              delay={(queueEntries.length + 1) * 70}
            />
          </div>
          <SectionCard
            title="Dead-letter jobs"
            action={
              <button type="button" className="text-sm font-medium text-primary hover:text-primary-hover" onClick={() => void recover()}>
                Recover outbox
              </button>
            }
          >
            {(data.deadLetter ?? []).length === 0 ? (
              <EmptyState title="No failed jobs waiting for action">The queue is clear in this environment.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {(data.deadLetter ?? []).map((job) => (
                  <li key={job.id} className="rounded-[1.4rem] bg-paper p-4">
                    <p className="font-medium text-primary">
                      Job {job.id} · attempts {job.attempts} · case {job.conversationId ?? '—'}
                    </p>
                    <p className="mt-1 text-sm text-muted">{job.safeError ?? 'No safe error message'}</p>
                    {job.conversationId ? (
                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-primary"
                        onClick={() => void replay(String(job.conversationId), true)}
                      >
                        Replay
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Retry Intercom write-back">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void api
                  .post(`/api/operations/intercom-sync/${replayId}`, {})
                  .then(() => {
                    setMessage(`Retried Intercom sync for case ${replayId}`);
                    load();
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Sync retry failed'));
              }}
            >
              <label className="min-w-[12rem] flex-1 text-sm text-primary">
                Case ID
                <input className="dash-field mt-2" value={replayId} onChange={(event) => setReplayId(event.target.value)} />
              </label>
              <button type="submit" className="btn-secondary rounded-full px-5 py-2.5 text-sm font-medium">
                Retry write-back
              </button>
            </form>
          </SectionCard>
          <SectionCard title="Force replay">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void replay(replayId, true);
              }}
            >
              <label className="min-w-[12rem] flex-1 text-sm text-primary">
                Case ID
                <input
                  className="dash-field mt-2"
                  value={replayId}
                  onChange={(event) => setReplayId(event.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium">
                Force replay
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}
    </AppShell>
  );
}
