'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { formatCategoryLabel, formatMentionStatus, formatRelativeTime } from '../../lib/case-display';

type CaseRow = {
  id: number;
  source: string;
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
  const [applied, setApplied] = useState({ q: '', status: '', source: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (filters: { q: string; status: string; source: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ items: CaseRow[] }>(
        `/api/cases?q=${encodeURIComponent(filters.q)}&status=${encodeURIComponent(filters.status)}&source=${encodeURIComponent(filters.source)}`
      );
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ q: '', status: '', source: '' });
  }, [load]);

  const activeFilterCount = useMemo(
    () => [applied.q, applied.status, applied.source].filter(Boolean).length,
    [applied]
  );

  const applyFilters = () => {
    const next = { q: q.trim(), status, source };
    setApplied(next);
    void load(next);
  };

  const clearFilters = () => {
    const next = { q: '', status: '', source: '' };
    setQ('');
    setStatus('');
    setSource('');
    setApplied(next);
    void load(next);
  };

  return (
    <AppShell title="Case explorer" description="Search and inspect every persisted conversation, employee match, classification, and related-case result.">
      <section className="dash-panel mb-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_12rem_12rem_auto]" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <label className="relative">
            <span className="sr-only">Search cases</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input className="dash-field h-11 pl-10" placeholder="Search subject or employee" value={q} onChange={(event) => setQ(event.target.value)} />
          </label>
          <select aria-label="Status filter" className="dash-field h-11" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option><option value="pending">Pending</option><option value="ready">Ready</option><option value="failed">Failed</option>
          </select>
          <select aria-label="Source filter" className="dash-field h-11" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option><option value="demo">Demo</option><option value="email">Email</option><option value="intercom">Intercom</option>
          </select>
          <button type="submit" className="btn-primary h-11 rounded-lg px-5 text-sm font-semibold">Apply filters</button>
        </form>
        {activeFilterCount > 0 ? (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}</span>
            <button type="button" className="font-semibold text-primary hover:text-primary-hover" onClick={clearFilters}>Clear all</button>
          </div>
        ) : null}
      </section>

      {error ? <AlertBanner tone="danger" title="Could not load cases" action={<TextButton onClick={() => void load(applied)}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {loading ? <PageSkeleton variant="table" /> : null}

      {!loading && !error ? (
        <section className="dash-panel overflow-hidden !p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Case results</h2>
              <p className="mt-1 text-xs text-slate-500">{items.length} {items.length === 1 ? 'case' : 'cases'} in the current view</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-success" />Live database</span>
          </div>
          {items.length === 0 ? (
            <div className="p-5"><EmptyState title="No cases match these filters">Try a broader search or clear the active filters.</EmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dash-table min-w-[72rem] w-full text-left text-sm">
                <thead><tr>{['Case', 'Employee match', 'Category', 'Related', 'Status', 'Source', 'Received', 'Workspace'].map((heading) => <th key={heading} className="px-5 py-3.5">{heading}</th>)}</tr></thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="dash-row border-t border-slate-100">
                      <td className="max-w-[22rem] px-5 py-4">
                        <Link className="line-clamp-2 font-semibold leading-5 text-primary hover:text-primary-hover" href={`/cases/${row.id}`}>{row.subject ?? '(no subject)'}</Link>
                        <p className="mt-1 text-xs text-slate-400">Case #{row.id}</p>
                      </td>
                      <td className="px-5 py-4"><p className="font-medium text-slate-800">{row.employee ?? 'Not identified'}</p><p className="mt-0.5 text-xs text-slate-500">{formatMentionStatus(row.mentionStatus)}</p></td>
                      <td className="px-5 py-4 text-slate-600">{formatCategoryLabel(row.category)}</td>
                      <td className="px-5 py-4"><span className="tabular-nums font-medium text-slate-800">{row.relatedCaseCount}</span></td>
                      <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-4 capitalize text-slate-500">{row.source}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatRelativeTime(row.receivedAt)}</td>
                      <td className="px-5 py-4">{row.openInIntercomUrl ? <a className="whitespace-nowrap font-semibold text-secondary hover:text-primary" href={row.openInIntercomUrl} target="_blank" rel="noreferrer">Open in Intercom ↗</a> : <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
