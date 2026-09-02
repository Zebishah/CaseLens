'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, EmptyState, SectionCard } from '../../components/dashboard/ui';
import { api } from '../../lib/api';

type Directory = {
  companies: Array<{ name: string; slug: string }>;
  stores: Array<{
    storeNumber: string;
    storeName: string | null;
    districtManagerName?: string | null;
    vpName?: string | null;
  }>;
  employees?: Array<{
    id: number;
    canonicalName: string;
    storeNumber: string | null;
    companyDomain: string | null;
  }>;
  fixedContacts: Array<{ name: string; email: string; role: string | null }>;
  importHistory: Array<{
    id?: number;
    source: string;
    status: string;
    storesUpserted: number;
    errorMessage?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
  }>;
  boxConfigured: boolean;
};

export default function DirectoryPage() {
  const [data, setData] = useState<Directory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState(
    'company_slug,store_number,store_name,district_manager_name,district_manager_email\nnorthwind-bakery,1042,Harbor Street,Sam Patel,sam.patel@northwind.co'
  );
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api
      .get<Directory>('/api/directory')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load directory'));
  };

  useEffect(() => {
    load();
  }, []);

  const importCsv = async () => {
    setMessage(null);
    const result = await api.post<{ storesUpserted: number }>('/api/directory/import', { csv });
    setMessage(`Imported ${result.storesUpserted} stores. This replaces the full directory, same as Box sync.`);
    load();
  };

  return (
    <AppShell
      title="Directory"
      description={
        data
          ? `Live directory in this environment. ${data.employees?.length ?? 0} employees, ${data.stores.length} stores. CSV import updates stores, not employee identities.`
          : 'Companies, employees, and store routing used for identity resolution.'
      }
    >
      {error ? (
        <AlertBanner tone="danger" title="Directory requires an operator session">
          {error}
        </AlertBanner>
      ) : null}
      {!data && !error ? <div className="h-48 animate-pulse rounded-[1.8rem] bg-white/80" /> : null}
      {data ? (
        <div className="space-y-5">
          {message ? (
            <AlertBanner tone="success" title="Import complete">
              {message}
            </AlertBanner>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Companies">
              {data.companies.length === 0 ? (
                <EmptyState title="No companies yet" />
              ) : (
                <ul className="space-y-2">
                  {data.companies.map((company) => (
                    <li key={company.slug} className="rounded-[1.2rem] bg-paper px-4 py-3">
                      <p className="font-semibold text-primary">{company.name}</p>
                      <p className="text-sm text-muted">{company.slug}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Employees">
              {(data.employees ?? []).length === 0 ? (
                <EmptyState title="No employee identities loaded yet" />
              ) : (
                <ul className="space-y-2">
                  {(data.employees ?? []).map((employee) => (
                    <li key={employee.id} className="rounded-[1.2rem] bg-paper px-4 py-3">
                      <p className="font-semibold text-primary">{employee.canonicalName}</p>
                      <p className="text-sm text-muted">
                        {employee.storeNumber ?? 'no store'} · {employee.companyDomain ?? 'no domain'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Stores">
              {data.stores.length === 0 ? (
                <EmptyState title="No stores loaded">Seed the portfolio or import a CSV.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {data.stores.map((store) => (
                    <li key={store.storeNumber} className="rounded-[1.2rem] bg-paper px-4 py-3">
                      <p className="font-semibold text-primary">
                        {store.storeNumber} · {store.storeName}
                      </p>
                      <p className="text-sm text-muted">{store.districtManagerName ?? store.vpName ?? '—'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Stakeholders">
              {data.fixedContacts.length === 0 ? (
                <EmptyState title="No fixed CC contacts" />
              ) : (
                <ul className="space-y-2">
                  {data.fixedContacts.map((contact) => (
                    <li key={contact.email} className="rounded-[1.2rem] bg-paper px-4 py-3">
                      <p className="font-semibold text-primary">{contact.name}</p>
                      <p className="text-sm text-muted">
                        {contact.role} · {contact.email}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
          <SectionCard title="Import history">
            {data.importHistory.length === 0 ? (
              <EmptyState title="No import runs yet" />
            ) : (
              <ul className="space-y-2 text-sm">
                {data.importHistory.map((run, index) => (
                  <li key={run.id ?? index} className="rounded-[1.2rem] bg-paper px-4 py-3">
                    {run.source} · {run.status} · {run.storesUpserted} stores
                    {run.finishedAt ? ` · finished ${run.finishedAt}` : ''}
                    {run.errorMessage ? ` · ${run.errorMessage}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Sanitized CSV import">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void importCsv().catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Import failed');
                });
              }}
            >
              <textarea
                className="dash-field min-h-[9rem] font-mono text-xs"
                rows={6}
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
              />
              <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium">
                Import CSV
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}
    </AppShell>
  );
}
