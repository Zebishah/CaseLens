'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, PageSkeleton, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';

type Status = 'pending' | 'approved' | 'invited' | 'declined' | 'expired';

type AccessRequest = {
  id: number;
  fullName: string;
  workEmail: string;
  organization: string | null;
  role: string | null;
  purpose: string;
  status: Status;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const statusStyles: Record<Status, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-sky-50 text-sky-700',
  invited: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-500'
};

export default function AccessRequestsPage() {
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      setRows(await api.get<AccessRequest[]>(`/api/access-requests${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load access requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: number, status: Status) => {
    setAction(id);
    setError(null);
    try {
      await api.patch(`/api/access-requests/${id}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update request');
    } finally {
      setAction(null);
    }
  };

  const copyEmail = async (row: AccessRequest) => {
    await navigator.clipboard.writeText(row.workEmail);
    setCopied(row.id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <AppShell
      title="Access Requests"
      description="Review requests for personal invitations to the synthetic Intercom workspace. Approval here records the decision; the actual teammate invitation is sent manually from Intercom."
    >
      {error ? (
        <AlertBanner tone="danger" title="Access queue unavailable" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>
          {error}
        </AlertBanner>
      ) : null}

      <section className="dash-panel mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary">Controlled invitations</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">Intercom reviewer queue</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Verify the requester, approve the record, invite the exact email in Intercom, then mark it invited.
              Never send shared credentials or verification codes.
            </p>
          </div>
          <label className="text-xs font-medium text-muted">
            Request status
            <select className="dash-field mt-2 min-w-44" value={filter} onChange={(event) => setFilter(event.target.value as Status | 'all')}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="invited">Invited</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
              <option value="all">All requests</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? <PageSkeleton variant="table" /> : null}

      {!loading && rows.length === 0 ? (
        <section className="dash-panel">
          <EmptyState title="No requests in this view">
            New recruiter invitation requests will appear here after secure submission.
          </EmptyState>
        </section>
      ) : null}

      {!loading && rows.length > 0 ? (
        <section className="dash-panel overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="dash-table min-w-[68rem] w-full text-left text-sm">
              <thead>
                <tr>
                  {['Reviewer', 'Organization', 'Reason', 'Requested', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-5 py-3.5">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="dash-row border-t border-slate-100 align-top">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-primary">{row.fullName}</p>
                      <button type="button" onClick={() => void copyEmail(row)} className="mt-1 text-left text-xs text-secondary hover:text-primary">
                        {row.workEmail} · {copied === row.id ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      <p>{row.organization || 'Not provided'}</p>
                      <p className="mt-1 text-xs">{row.role || 'Role not provided'}</p>
                    </td>
                    <td className="max-w-md px-5 py-4 leading-6 text-muted">{row.purpose}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'pending' ? (
                          <>
                            <ActionButton disabled={action === row.id} onClick={() => void updateStatus(row.id, 'approved')}>Approve</ActionButton>
                            <ActionButton disabled={action === row.id} muted onClick={() => void updateStatus(row.id, 'declined')}>Decline</ActionButton>
                          </>
                        ) : null}
                        {row.status === 'approved' ? (
                          <ActionButton disabled={action === row.id} onClick={() => void updateStatus(row.id, 'invited')}>Mark invited</ActionButton>
                        ) : null}
                        {row.status === 'invited' ? (
                          <ActionButton disabled={action === row.id} muted onClick={() => void updateStatus(row.id, 'expired')}>Expire access</ActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function ActionButton({
  children,
  disabled,
  muted = false,
  onClick
}: {
  children: ReactNode;
  disabled: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={muted
        ? 'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50'
        : 'rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50'}
    >
      {children}
    </button>
  );
}
