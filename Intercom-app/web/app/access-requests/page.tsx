'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, MetricCard, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { ApiError, api } from '../../lib/api';

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
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await api.get<AccessRequest[]>('/api/access-requests'));
    } catch (err) {
      setError(
        err instanceof ApiError && err.sleeping
          ? 'The backend service is starting. Retry in a moment.'
          : 'Reviewer requests are temporarily unavailable. Retry after the service reconnects.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: number, status: Status) => {
    setAction(id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.patch<{ invitation?: { sent: boolean } }>(`/api/access-requests/${id}`, { status });
      setNotice(status === 'approved'
        ? result.invitation?.sent === false
          ? 'The viewer account was prepared, but Brevo is not enabled in this environment. Configure Brevo before approving production requests.'
          : 'Viewer account prepared and the one-time password setup email was sent through Brevo.'
        : `Request marked ${status}.`);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError && err.sleeping
          ? 'The backend service is starting. Retry in a moment.'
          : 'The request could not be updated. Refresh the queue and try again.'
      );
    } finally {
      setAction(null);
    }
  };

  const copyEmail = async (row: AccessRequest) => {
    await navigator.clipboard.writeText(row.workEmail);
    setCopied(row.id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const visibleRows = filter === 'all' ? rows : rows.filter((row) => row.status === filter);
  const countFor = (status: Status) => rows.filter((row) => row.status === status).length;

  return (
    <AppShell
      title="Access management"
      description="Review requests for personal, read-only organization workspace accounts. Approval creates a viewer account and sends a one-time password setup link through Brevo; Intercom access remains separate."
    >
      {error ? (
        <AlertBanner tone="danger" title="Access queue unavailable" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>
          {error}
        </AlertBanner>
      ) : null}
      {notice ? <AlertBanner tone="success" title="Access workflow updated">{notice}</AlertBanner> : null}

      <section className="dash-panel mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary">Controlled invitations</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">Reviewer access queue</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Verify the requester, approve the record, and let the system send a one-time setup link to the exact email.
              Never send shared credentials or verification codes.
            </p>
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Request status">
            {(['pending', 'approved', 'invited', 'declined', 'expired', 'all'] as const).map((status) => (
              <button key={status} type="button" role="tab" aria-selected={filter === status} onClick={() => setFilter(status)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold capitalize transition ${filter === status ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{status === 'all' ? 'All' : status}</button>
            ))}
          </div>
        </div>
      </section>

      {!loading && !error ? <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Pending" value={countFor('pending')} hint="Awaiting review" icon="review" tone={countFor('pending') > 0 ? 'warning' : 'default'} />
        <MetricCard label="Approved" value={countFor('approved')} hint="Ready for invitation" icon="shield" />
        <MetricCard label="Invited" value={countFor('invited')} hint="Invitation marked sent" icon="users" tone="success" />
        <MetricCard label="Declined" value={countFor('declined')} hint="Requests not approved" icon="cases" />
        <MetricCard label="Expired" value={countFor('expired')} hint="No longer active" icon="activity" />
      </div> : null}

      {loading ? <PageSkeleton variant="table" /> : null}

      {!loading && !error && visibleRows.length === 0 ? (
        <section className="dash-panel">
          <EmptyState title={filter === 'pending' ? 'No pending reviewer requests' : 'No requests in this view'} icon="shield">
            {filter === 'pending' ? 'The queue is clear. New requests will appear here after secure submission.' : 'Try another status tab to inspect the invitation history.'}
          </EmptyState>
        </section>
      ) : null}

      {!loading && !error && visibleRows.length > 0 ? (
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
                {visibleRows.map((row) => (
                  <tr key={row.id} tabIndex={0} className="dash-row cursor-pointer border-t border-slate-100 align-top" onClick={() => setSelected(row)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(row); }}>
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
                          <>
                            <ActionButton disabled={action === row.id} onClick={() => void updateStatus(row.id, 'approved')}>Resend setup email</ActionButton>
                            <ActionButton disabled={action === row.id} muted onClick={() => void updateStatus(row.id, 'invited')}>Mark complete</ActionButton>
                          </>
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
      {selected ? <RequestDrawer row={selected} onClose={() => setSelected(null)} /> : null}
    </AppShell>
  );
}

function RequestDrawer({ row, onClose }: { row: AccessRequest; onClose: () => void }) {
  return <aside className="mt-5 rounded-2xl border border-primary/15 bg-slate-950 p-5 text-white shadow-lift" aria-label="Access request details">
    <div className="flex items-start justify-between gap-4"><div><p className="dashboard-section-label text-emerald-300">Request detail · #{row.id}</p><h2 className="mt-2 text-xl font-semibold">{row.fullName}</h2><p className="mt-1 text-sm text-slate-400">{row.organization || 'Organization not provided'} · {row.role || 'Role not provided'}</p></div><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Close</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Status</p><div className="mt-2"><StatusBadge status={row.status} /></div></div><div className="rounded-xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Email</p><p className="mt-2 break-all text-sm font-medium text-white">{row.workEmail}</p></div></div>
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-slate-400">Reason for access</p><p className="mt-2 text-sm leading-6 text-slate-200">{row.purpose}</p></div>
    <p className="mt-4 text-xs text-slate-400">Requested {new Date(row.createdAt).toLocaleString()}{row.reviewedAt ? ` · reviewed ${new Date(row.reviewedAt).toLocaleString()}` : ''}</p>
  </aside>;
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
