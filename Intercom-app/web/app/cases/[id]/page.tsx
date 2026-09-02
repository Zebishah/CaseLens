'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { AlertBanner, PageSkeleton, SectionCard, StatusBadge, TextButton } from '../../../components/dashboard/ui';
import { api } from '../../../lib/api';
import { getAdminToken, getAdminUser } from '../../../lib/auth-token';

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = getAdminUser()?.role === 'admin';

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

  const submitFeedback = async () => {
    const adminToken = getAdminToken();
    const demoToken = typeof window !== 'undefined' ? sessionStorage.getItem('demoToken') : null;
    const path =
      adminToken || !demoToken ? `/api/cases/${params.id}/feedback` : `/api/demo/cases/${params.id}/feedback`;
    await api.post(path, {
      rating: 'accurate',
      comment
    });
    setSaved(true);
    await load();
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
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Intake">
            <p className="text-sm text-muted">
              {conversation.source} · {conversation.senderName} · {conversation.sender}
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-primary">{conversation.subject}</h3>
            <blockquote className="mt-5 rounded-xl bg-paper px-5 py-4 text-sm leading-7 text-foreground">
              {conversation.body}
            </blockquote>
          </SectionCard>
          <SectionCard
            title="Intelligence"
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
            <h3 className="mt-6 text-sm font-semibold text-primary">Related cases</h3>
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
            <h3 className="mt-6 text-sm font-semibold text-primary">Stakeholders</h3>
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
          {isAdmin ? <SectionCard title="Operator feedback" className="lg:col-span-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitFeedback();
              }}
            >
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
          </SectionCard> : null}
        </div>
      ) : null}
    </AppShell>
  );
}
