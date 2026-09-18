import { AppShell } from '../../components/AppShell';
import { SectionCard } from '../../components/dashboard/ui';

const stages = [
  { name: 'Intercom / inbound email', detail: 'Verified webhook or normalized email intake', accent: 'border-sky-300 bg-sky-50' },
  { name: 'Render API', detail: 'Validate, deduplicate and acknowledge intake', accent: 'border-indigo-300 bg-indigo-50' },
  { name: 'PostgreSQL', detail: 'Case state, inbound event and durable outbox', accent: 'border-emerald-300 bg-emerald-50' },
  { name: 'Private Apify Actor', detail: 'On-demand background execution', accent: 'border-violet-300 bg-violet-50' },
  { name: 'Shared intelligence handlers', detail: 'Gemini extraction · employee matching · related cases', accent: 'border-amber-300 bg-amber-50' },
  { name: 'PostgreSQL', detail: 'Persisted snapshot and run status', accent: 'border-emerald-300 bg-emerald-50' },
  { name: 'Intercom Canvas / dashboard', detail: 'Operator context, review and write-back', accent: 'border-slate-300 bg-slate-50' }
];

const guarantees = [
  ['Idempotency', 'A unique source event key makes repeated webhook delivery safe to process.'],
  ['Transactional outbox', 'Generic intake commits the case and dispatch intent together, so recovery can find work not yet handed off.'],
  ['Revision-aware deduplication', 'A newer conversation revision can run even while an older revision is already active.'],
  ['Stale-write protection', 'A result from an older revision cannot replace a newer persisted snapshot or write stale intelligence back.'],
  ['Advisory locking', 'PostgreSQL session locks serialize processing for the same conversation across separate Actor runs.'],
  ['Retry and recovery', 'Safe run state, retry classification and bounded recovery make failed or interrupted jobs visible and replayable.'],
  ['Non-fatal secondary effects', 'Optional peer refresh and Intercom write-back failures do not erase a completed primary intelligence result.']
];

export default function ArchitecturePage() {
  return (
    <AppShell
      title="Architecture"
      description="A concise view of how verified conversations become persisted, explainable HR case intelligence. PostgreSQL remains the source of truth across execution modes."
    >
      <div className="space-y-7">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-lift md:p-7" aria-labelledby="architecture-flow-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="dashboard-section-label text-emerald-300">Production processing path</p>
              <h2 id="architecture-flow-title" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">From conversation to trusted operator context</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">The Render API handles intake. It stores durable work in PostgreSQL and dispatches private Apify Actors only when background processing is needed.</p>
            </div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">PostgreSQL source of truth</span>
          </div>

          <ol className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Conversation processing stages">
            {stages.map((stage, index) => (
              <li key={`${stage.name}-${index}`} className="relative min-h-28 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 font-mono text-xs text-emerald-200">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-sm font-semibold text-white">{stage.name}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{stage.detail}</p>
                {index < stages.length - 1 ? <span aria-hidden="true" className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-lg text-emerald-300 xl:block">→</span> : null}
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5" aria-label="Supported execution modes">
            <ModeBadge title="Apify" detail="On-demand production background work" />
            <ModeBadge title="BullMQ + Redis" detail="Supported alternate worker mode" />
            <ModeBadge title="Inline" detail="Local, fallback and demo mode" />
          </div>
        </section>

        <section aria-labelledby="reliability-title">
          <div className="mb-4">
            <p className="dashboard-section-label">Reliability by design</p>
            <h2 id="reliability-title" className="mt-1 text-xl font-semibold text-primary">What protects the processing path</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {guarantees.map(([title, description], index) => (
              <SectionCard key={title} className="h-full">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-mono text-xs font-semibold text-emerald-800">{String(index + 1).padStart(2, '0')}</span>
                  <div><h3 className="text-sm font-semibold text-primary">{title}</h3><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div>
                </div>
              </SectionCard>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Execution and evidence notes">
          <SectionCard title="Why on-demand Actors" description="Background work runs in a bounded container only when dispatched. This replaces the always-running production worker path while keeping the same PostgreSQL-backed handlers and recovery records.">
            <p className="text-sm leading-6 text-muted">BullMQ and Redis remain available for deployments that choose a continuously available queue worker. Inline execution stays useful for local development and deterministic demos. These are supported modes, not separate business logic.</p>
          </SectionCard>
          <SectionCard title="Evidence and limits" description="Latest validation on 2026-09-18: 647 backend tests and 7 frontend tests passed. CI runs lint, type checks, tests and production builds.">
            <p className="text-sm leading-6 text-muted">There is no browser-level E2E suite yet; end-to-end request flows are covered by backend integration tests. Evaluation and benchmark outputs are labeled by method and environment. This page makes no claims about production throughput, AI accuracy, customer savings, or service-level latency.</p>
          </SectionCard>
        </section>
      </div>
    </AppShell>
  );
}

function ModeBadge({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"><p className="text-xs font-semibold text-white">{title}</p><p className="mt-0.5 text-[11px] text-slate-400">{detail}</p></div>;
}
