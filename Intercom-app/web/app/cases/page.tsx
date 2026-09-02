'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, SectionCard, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { getAdminToken } from '../../lib/auth-token';
import { formatCategoryLabel, formatMentionStatus, formatRelativeTime } from '../../lib/case-display';

type CaseRow = {
  id: number;
  source: string;
  externalId?: string;
  subject: string | null;
  status: string;
  category: string | null;
  employee: string | null;
  storeNumber: string | null;
  relatedCaseCount: number;
  confidence: number | null;
  receivedAt: string;
  mentionStatus?: string | null;
  openInIntercomUrl?: string | null;
};

export default function CasesPage() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [scope, setScope] = useState<'demo' | 'admin'>('admin');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const adminToken = getAdminToken();
      const demoToken = typeof window !== 'undefined' ? sessionStorage.getItem('demoToken') : null;

      if (adminToken) {
        const result = await api.get<{ items: CaseRow[] }>(
          `/api/cases?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&source=${encodeURIComponent(source)}`
        );
        setItems(result.items);
        setEmpty(result.items.length === 0);
        setScope('admin');
        setError(null);
        return;
      }

      if (demoToken) {
        const result = await api.get<{ items: CaseRow[] }>('/api/demo/cases');
        const filtered = result.items.filter((row) => {
          const matchesQuery =
            !q || `${row.subject ?? ''} ${row.employee ?? ''}`.toLowerCase().includes(q.toLowerCase());
          const matchesStatus = !status || row.status === status;
          const matchesSource = !source || row.source === source;
          return matchesQuery && matchesStatus && matchesSource;
        });
        setItems(filtered);
        setEmpty(filtered.length === 0);
        setScope('demo');
        setError(null);
        return;
      }

      setError('Sign in as an operator to view cases.');
      setItems([]);
      setEmpty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell
      title="Cases"
      description="Every conversation persisted after intelligence processing. Counts and names come from the live database."
    >
      <SectionCard>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <input
            aria-label="Search cases"
            className="dash-field min-w-[14rem] flex-1"
            placeholder="Search subject or employee"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <select
            aria-label="Status filter"
            className="dash-field w-auto min-w-[10rem]"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
          </select>
          <select
            aria-label="Source filter"
            className="dash-field w-auto min-w-[10rem]"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">All sources</option>
            <option value="demo">Demo</option>
            <option value="email">Email</option>
            <option value="intercom">Intercom</option>
          </select>
          <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium">
            Filter
          </button>
        </form>
      </SectionCard>

      {error ? (
        <div className="mt-4">
          <AlertBanner tone="danger" title="Could not load cases" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>
            {error}
          </AlertBanner>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white/80" aria-busy="true" />
      ) : (
        <SectionCard className="mt-4 overflow-hidden !p-0">
          {empty ? (
            <div className="p-5">
              <EmptyState title="No cases match these filters">
                Seeded Northwind cases appear here when you are signed in as an operator.
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dash-table min-w-full text-left text-sm">
                <thead>
                  <tr>
                    {['Subject', 'Employee', 'Category', 'Related', 'Status', 'Source', 'Received', 'Intercom'].map(
                      (heading) => (
                        <th key={heading} className="px-5 py-4">
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="dash-row border-t border-primary/8">
                      <td className="max-w-[20rem] px-5 py-4">
                        <Link className="line-clamp-2 font-medium text-primary hover:text-primary-hover" href={`/cases/${row.id}`}>
                          {row.subject ?? '(no subject)'}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-primary">{row.employee ?? '—'}</p>
                        <p className="text-xs text-muted">{formatMentionStatus(row.mentionStatus)}</p>
                      </td>
                      <td className="px-5 py-4 text-muted">{formatCategoryLabel(row.category)}</td>
                      <td className="px-5 py-4 tabular-nums">{row.relatedCaseCount}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-5 py-4 capitalize text-muted">{row.source}</td>
                      <td className="px-5 py-4 text-muted">{formatRelativeTime(row.receivedAt)}</td>
                      <td className="px-5 py-4">
                        {row.openInIntercomUrl ? (
                          <a
                            className="font-medium text-secondary hover:text-primary"
                            href={row.openInIntercomUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Intercom
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </AppShell>
  );
}
