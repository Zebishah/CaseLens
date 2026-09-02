'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { getAdminUser } from '../../lib/auth-token';

type Directory = {
  companies: Array<{ name: string; slug: string }>;
  stores: Array<{ storeNumber: string; storeName: string | null; districtManagerName?: string | null; vpName?: string | null }>;
  employees?: Array<{ id: number; canonicalName: string; storeNumber: string | null; companyDomain: string | null }>;
  fixedContacts: Array<{ name: string; email: string; role: string | null }>;
  importHistory: Array<{ id?: number; source: string; status: string; storesUpserted: number; errorMessage?: string | null; startedAt?: string; finishedAt?: string | null }>;
  boxConfigured: boolean;
};

type Tab = 'employees' | 'stores' | 'companies' | 'stakeholders' | 'imports';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'employees', label: 'Employees' },
  { id: 'stores', label: 'Stores' },
  { id: 'companies', label: 'Companies' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'imports', label: 'Import & sync' }
];

export default function DirectoryPage() {
  const isAdmin = getAdminUser()?.role === 'admin';
  const visibleTabs = isAdmin ? tabs : tabs.filter((item) => item.id !== 'imports');
  const [data, setData] = useState<Directory | null>(null);
  const [tab, setTab] = useState<Tab>('employees');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('company_slug,store_number,store_name,district_manager_name,district_manager_email\nnorthwind-bakery,1042,Harbor Street,Sam Patel,sam.patel@northwind.co');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<Directory>('/api/directory'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const employees = useMemo(() => (data?.employees ?? []).filter((row) =>
    !normalizedQuery || `${row.canonicalName} ${row.storeNumber ?? ''} ${row.companyDomain ?? ''}`.toLowerCase().includes(normalizedQuery)
  ), [data, normalizedQuery]);
  const stores = useMemo(() => (data?.stores ?? []).filter((row) =>
    !normalizedQuery || `${row.storeNumber} ${row.storeName ?? ''} ${row.districtManagerName ?? ''} ${row.vpName ?? ''}`.toLowerCase().includes(normalizedQuery)
  ), [data, normalizedQuery]);
  const companies = useMemo(() => (data?.companies ?? []).filter((row) =>
    !normalizedQuery || `${row.name} ${row.slug}`.toLowerCase().includes(normalizedQuery)
  ), [data, normalizedQuery]);
  const contacts = useMemo(() => (data?.fixedContacts ?? []).filter((row) =>
    !normalizedQuery || `${row.name} ${row.email} ${row.role ?? ''}`.toLowerCase().includes(normalizedQuery)
  ), [data, normalizedQuery]);

  const importCsv = async () => {
    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.post<{ storesUpserted: number }>('/api/directory/import', { csv });
      setMessage(`Imported ${result.storesUpserted} stores successfully.`);
      await load();
      setTab('imports');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const visibleCount = tab === 'employees' ? employees.length : tab === 'stores' ? stores.length : tab === 'companies' ? companies.length : tab === 'stakeholders' ? contacts.length : data?.importHistory.length ?? 0;

  return (
    <AppShell title="People & stores" description="The resolution directory behind employee matching, store ownership, and stakeholder routing.">
      {error ? <AlertBanner tone="danger" title="Could not load the directory" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {loading ? <PageSkeleton variant="directory" /> : null}

      {!loading && data ? (
        <div className="space-y-5">
          {message ? <AlertBanner tone="success" title="Directory updated">{message}</AlertBanner> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Employees', data.employees?.length ?? 0, 'Resolvable identities'],
              ['Stores', data.stores.length, 'Routing locations'],
              ['Companies', data.companies.length, 'Tenant organizations'],
              ['Stakeholders', data.fixedContacts.length, 'Escalation contacts']
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="dash-panel">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
                <p className="mt-2 text-sm text-slate-500">{hint}</p>
              </div>
            ))}
          </div>

          <section className="dash-panel overflow-hidden !p-0">
            <div className="border-b border-slate-200 px-5 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Directory records</h2>
                  <p className="mt-1 text-sm text-slate-500">{visibleCount} records in this view</p>
                </div>
                {tab !== 'imports' ? (
                  <label className="relative w-full sm:w-80">
                    <span className="sr-only">Search directory</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
                    <input className="dash-field h-11 pl-10" placeholder="Search this directory view" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                ) : null}
              </div>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Directory views">
                {visibleTabs.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setQuery(''); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${tab === item.id ? 'border-secondary text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'employees' ? <EmployeesTable items={employees} /> : null}
            {tab === 'stores' ? <StoresTable items={stores} /> : null}
            {tab === 'companies' ? <CompaniesTable items={companies} /> : null}
            {tab === 'stakeholders' ? <ContactsTable items={contacts} /> : null}
            {isAdmin && tab === 'imports' ? (
              <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div><h3 className="text-sm font-semibold text-slate-900">Sanitized CSV import</h3><p className="mt-1 text-sm text-slate-500">Updates store-routing records. Employee identities are preserved.</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${data.boxConfigured ? 'status-completed' : 'status-queued'}`}>Box {data.boxConfigured ? 'configured' : 'not configured'}</span>
                  </div>
                  <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void importCsv(); }}>
                    <textarea aria-label="CSV records" className="dash-field min-h-[11rem] resize-y font-mono text-xs leading-5" rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Use synthetic or sanitized records only.</p>
                      <button type="submit" disabled={importing} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{importing ? 'Importing…' : 'Import CSV'}</button>
                    </div>
                  </form>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Import history</h3>
                  <p className="mt-1 text-sm text-slate-500">Most recent directory synchronization runs.</p>
                  {data.importHistory.length === 0 ? <div className="mt-4"><EmptyState title="No import runs yet">A completed CSV or Box synchronization will appear here.</EmptyState></div> : (
                    <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {data.importHistory.map((run, index) => (
                        <li key={run.id ?? index} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium capitalize text-slate-800">{run.source}</span><StatusBadge status={run.status} /></div>
                          <p className="mt-1 text-xs text-slate-500">{run.storesUpserted} stores updated{run.finishedAt ? ` · ${new Date(run.finishedAt).toLocaleString()}` : ''}</p>
                          {run.errorMessage ? <p className="mt-1 text-xs text-red-600">{run.errorMessage}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function EmptyTable({ label }: { label: string }) {
  return <div className="p-5"><EmptyState title={`No ${label} match your search`}>Clear the search or choose another directory view.</EmptyState></div>;
}

function EmployeesTable({ items }: { items: NonNullable<Directory['employees']> }) {
  if (!items.length) return <EmptyTable label="employees" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[48rem] w-full text-left text-sm"><thead><tr>{['Employee', 'Store', 'Company domain', 'Directory ID'].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.id} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-semibold text-primary">{row.canonicalName}</td><td className="px-5 py-4 text-slate-600">{row.storeNumber ?? 'Unassigned'}</td><td className="px-5 py-4 text-slate-600">{row.companyDomain ?? 'Not available'}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">EMP-{String(row.id).padStart(4, '0')}</td></tr>)}</tbody></table></div>;
}

function StoresTable({ items }: { items: Directory['stores'] }) {
  if (!items.length) return <EmptyTable label="stores" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[52rem] w-full text-left text-sm"><thead><tr>{['Store', 'Location name', 'District manager', 'VP owner'].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.storeNumber} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-semibold tabular-nums text-primary">{row.storeNumber}</td><td className="px-5 py-4 text-slate-700">{row.storeName ?? 'Unnamed location'}</td><td className="px-5 py-4 text-slate-600">{row.districtManagerName ?? 'Not assigned'}</td><td className="px-5 py-4 text-slate-600">{row.vpName ?? 'Not assigned'}</td></tr>)}</tbody></table></div>;
}

function CompaniesTable({ items }: { items: Directory['companies'] }) {
  if (!items.length) return <EmptyTable label="companies" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[38rem] w-full text-left text-sm"><thead><tr><th className="px-5 py-3.5">Company</th><th className="px-5 py-3.5">Tenant slug</th></tr></thead><tbody>{items.map((row) => <tr key={row.slug} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-semibold text-primary">{row.name}</td><td className="px-5 py-4 font-mono text-xs text-slate-500">{row.slug}</td></tr>)}</tbody></table></div>;
}

function ContactsTable({ items }: { items: Directory['fixedContacts'] }) {
  if (!items.length) return <EmptyTable label="stakeholders" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[44rem] w-full text-left text-sm"><thead><tr>{['Stakeholder', 'Role', 'Email'].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.email} className="dash-row border-t border-slate-100"><td className="px-5 py-4 font-semibold text-primary">{row.name}</td><td className="px-5 py-4 text-slate-600">{row.role ?? 'General contact'}</td><td className="px-5 py-4 text-slate-600">{row.email}</td></tr>)}</tbody></table></div>;
}
