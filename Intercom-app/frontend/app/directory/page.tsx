'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, MetricCard, PageSkeleton, StatusBadge, TextButton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { AUTH_STATE_EVENT, getAdminUser } from '../../lib/auth-token';

type Directory = {
  companies: Array<{ name: string; slug: string }>;
  stores: Array<{ storeNumber: string; storeName: string | null; districtManagerName?: string | null; vpName?: string | null }>;
  employees?: Array<{ id: number; canonicalName: string; storeNumber: string | null; companyDomain: string | null }>;
  fixedContacts: Array<{ name: string; email: string; role: string | null }>;
  importHistory: Array<{ id?: number; source: string; status: string; storesUpserted: number; errorMessage?: string | null; startedAt?: string; finishedAt?: string | null }>;
  boxConfigured: boolean;
};

type Tab = 'employees' | 'stores' | 'companies' | 'stakeholders' | 'imports';
type DirectorySelection = { kind: string; title: string; subtitle: string; details: Array<[string, string]> };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'employees', label: 'Employees' },
  { id: 'stores', label: 'Stores' },
  { id: 'companies', label: 'Companies' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'imports', label: 'Import & sync' }
];

export default function DirectoryPage() {
  const [role, setRole] = useState(() => getAdminUser()?.role);
  const isAdmin = role === 'admin';
  const visibleTabs = isAdmin ? tabs : tabs.filter((item) => item.id !== 'imports');
  const [data, setData] = useState<Directory | null>(null);
  const [tab, setTab] = useState<Tab>('employees');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('company_slug,store_number,store_name,district_manager_name,district_manager_email\nnorthwind-bakery,1042,Harbor Street,Sam Patel,sam.patel@northwind.co');
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<DirectorySelection | null>(null);

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
  useEffect(() => {
    const syncRole = () => setRole(getAdminUser()?.role);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => window.removeEventListener(AUTH_STATE_EVENT, syncRole);
  }, []);

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
    <AppShell title="Directory intelligence" description="The organizational context layer behind safer employee resolution and store-aware stakeholder routing: employee, store, company, and ownership relationships in one view.">
      {error ? <AlertBanner tone="danger" title="Could not load the directory" action={<TextButton onClick={() => void load()}>Retry</TextButton>}>{error}</AlertBanner> : null}
      {loading ? <PageSkeleton variant="directory" /> : null}

      {!loading && data ? (
        <div className="space-y-5">
          {message ? <AlertBanner tone="success" title="Directory updated">{message}</AlertBanner> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Employees" value={data.employees?.length ?? 0} hint="Resolvable identities" icon="users" />
            <MetricCard label="Stores" value={data.stores.length} hint="Routing locations" icon="store" />
            <MetricCard label="Companies" value={data.companies.length} hint="Tenant organizations" icon="cases" />
            <MetricCard label="Stakeholders" value={data.fixedContacts.length} hint="Escalation contacts" icon="review" />
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
                  <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setQuery(''); setSelected(null); }} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${tab === item.id ? 'border-secondary text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'employees' ? <EmployeesTable items={employees} onSelect={setSelected} /> : null}
            {tab === 'stores' ? <StoresTable items={stores} onSelect={setSelected} /> : null}
            {tab === 'companies' ? <CompaniesTable items={companies} onSelect={setSelected} /> : null}
            {tab === 'stakeholders' ? <ContactsTable items={contacts} onSelect={setSelected} /> : null}
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
          {selected ? <DirectoryDrawer selection={selected} onClose={() => setSelected(null)} /> : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function EmptyTable({ label }: { label: string }) {
  return <div className="p-5"><EmptyState title={`No ${label} match your search`}>Clear the search or choose another directory view.</EmptyState></div>;
}

function EmployeesTable({ items, onSelect }: { items: NonNullable<Directory['employees']>; onSelect: (selection: DirectorySelection) => void }) {
  if (!items.length) return <EmptyTable label="employees" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[48rem] w-full text-left text-sm"><thead><tr>{['Employee', 'Store', 'Company domain', 'Directory ID'].map((h) => <th scope="col" key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.id} tabIndex={0} className="dash-row cursor-pointer border-t border-slate-100" onClick={() => onSelect({ kind: 'Employee', title: row.canonicalName, subtitle: 'Directory identity', details: [['Store', row.storeNumber ?? 'Unassigned'], ['Company domain', row.companyDomain ?? 'Not available'], ['Directory ID', `EMP-${String(row.id).padStart(4, '0')}`]] })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.click(); }}><td className="px-5 py-4 font-semibold text-primary">{row.canonicalName}</td><td className="px-5 py-4 text-slate-600">{row.storeNumber ?? 'Unassigned'}</td><td className="px-5 py-4 text-slate-600">{row.companyDomain ?? 'Not available'}</td><td className="px-5 py-4 font-mono text-xs text-slate-400">EMP-{String(row.id).padStart(4, '0')}</td></tr>)}</tbody></table></div>;
}

function StoresTable({ items, onSelect }: { items: Directory['stores']; onSelect: (selection: DirectorySelection) => void }) {
  if (!items.length) return <EmptyTable label="stores" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[52rem] w-full text-left text-sm"><thead><tr>{['Store', 'Location name', 'District manager', 'VP owner'].map((h) => <th scope="col" key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.storeNumber} tabIndex={0} className="dash-row cursor-pointer border-t border-slate-100" onClick={() => onSelect({ kind: 'Store', title: row.storeNumber, subtitle: row.storeName ?? 'Unnamed location', details: [['District manager', row.districtManagerName ?? 'Not assigned'], ['VP owner', row.vpName ?? 'Not assigned']] })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.click(); }}><td className="px-5 py-4 font-semibold tabular-nums text-primary">{row.storeNumber}</td><td className="px-5 py-4 text-slate-700">{row.storeName ?? 'Unnamed location'}</td><td className="px-5 py-4 text-slate-600">{row.districtManagerName ?? 'Not assigned'}</td><td className="px-5 py-4 text-slate-600">{row.vpName ?? 'Not assigned'}</td></tr>)}</tbody></table></div>;
}

function CompaniesTable({ items, onSelect }: { items: Directory['companies']; onSelect: (selection: DirectorySelection) => void }) {
  if (!items.length) return <EmptyTable label="companies" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[38rem] w-full text-left text-sm"><thead><tr><th className="px-5 py-3.5">Company</th><th className="px-5 py-3.5">Tenant slug</th></tr></thead><tbody>{items.map((row) => <tr key={row.slug} tabIndex={0} className="dash-row cursor-pointer border-t border-slate-100" onClick={() => onSelect({ kind: 'Company', title: row.name, subtitle: 'Tenant organization', details: [['Tenant slug', row.slug]] })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.click(); }}><td className="px-5 py-4 font-semibold text-primary">{row.name}</td><td className="px-5 py-4 font-mono text-xs text-slate-500">{row.slug}</td></tr>)}</tbody></table></div>;
}

function ContactsTable({ items, onSelect }: { items: Directory['fixedContacts']; onSelect: (selection: DirectorySelection) => void }) {
  if (!items.length) return <EmptyTable label="stakeholders" />;
  return <div className="overflow-x-auto"><table className="dash-table min-w-[44rem] w-full text-left text-sm"><thead><tr>{['Stakeholder', 'Role', 'Email'].map((h) => <th scope="col" key={h} className="px-5 py-3.5">{h}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.email} tabIndex={0} className="dash-row cursor-pointer border-t border-slate-100" onClick={() => onSelect({ kind: 'Stakeholder', title: row.name, subtitle: row.role ?? 'General contact', details: [['Email', row.email], ['Role', row.role ?? 'General contact']] })} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.click(); }}><td className="px-5 py-4 font-semibold text-primary">{row.name}</td><td className="px-5 py-4 text-slate-600">{row.role ?? 'General contact'}</td><td className="px-5 py-4 text-slate-600">{row.email}</td></tr>)}</tbody></table></div>;
}

function DirectoryDrawer({ selection, onClose }: { selection: DirectorySelection; onClose: () => void }) {
  return <aside className="mt-4 rounded-2xl border border-primary/15 bg-mist p-5 text-white shadow-lift" aria-label={`${selection.kind} details`}>
    <div className="flex items-start justify-between gap-4"><div><p className="dashboard-section-label text-emerald-300">{selection.kind} detail</p><h3 className="mt-2 text-xl font-semibold">{selection.title}</h3><p className="mt-1 text-sm text-slate-400">{selection.subtitle}</p></div><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Close</button></div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2">{selection.details.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-white">{value}</dd></div>)}</dl>
  </aside>;
}
