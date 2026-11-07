import Link from 'next/link';
import { LandingNav } from '../../components/landing/LandingNav';
import { SiteFooter } from '../../components/landing/SiteFooter';

type IconName = 'layers' | 'database' | 'shield' | 'activity' | 'route' | 'cache' | 'worker' | 'check';

const capabilities = [
  ['Case intelligence', 'Turns conversations into structured cases with classification, identity evidence, and related history.'],
  ['Operational context', 'Connects directory, store, and stakeholder information so reviewers can act with context.'],
  ['Reviewer-safe access', 'Keeps synthetic walkthrough data and read-only reviewer access separate from administrative controls.']
] as const;

const decisions = [
  { icon: 'database' as IconName, title: 'Why PostgreSQL?', body: 'Business state, case snapshots, intake records, and job state need durable transactional storage. PostgreSQL remains authoritative across every execution mode.' },
  { icon: 'cache' as IconName, title: 'Why Redis?', body: 'Shared rate-limit counters and short-lived directory lookups benefit from fast cache-aside reads. When Redis is unavailable, the system degrades to safe local limits and PostgreSQL reads.' },
  { icon: 'worker' as IconName, title: 'Why Apify?', body: 'The production workload is bursty. On-demand Actors isolate background processing from the API without requiring an always-running worker process.' },
  { icon: 'route' as IconName, title: 'Why an outbox?', body: 'Generic intake commits business state and its dispatch intent together, so recovery can find work that was persisted before a handoff was interrupted.' },
  { icon: 'shield' as IconName, title: 'Why idempotency?', body: 'Repeated webhook delivery and job retries must not create duplicate business effects. Durable keys and revision-aware dispatch keep repeated work safe.' },
  { icon: 'activity' as IconName, title: 'Why explicit evidence?', body: 'Identity confidence, related-case matches, review flags, and safe operational aggregates stay visible so human reviewers can make the final decision.' }
] as const;

const reliabilityRows = [
  ['Duplicate webhook', 'Durable event identity and idempotent processing'],
  ['Worker interrupted', 'PostgreSQL job state plus bounded recovery'],
  ['Repeated job delivery', 'Revision-aware execution keys and stale-write protection'],
  ['Redis unavailable', 'Bypass cache, use PostgreSQL, and fall back to process-local limits'],
  ['Optional write-back fails', 'Keep the primary intelligence result and surface the secondary failure'],
  ['Configuration is incomplete', 'Validate required production settings during startup']
] as const;

const securityItems = [
  'Signed webhook and Canvas requests are verified before processing.',
  'Viewer and administrator capabilities are separated by backend authorization.',
  'Password hashing, rotating refresh sessions, and login throttling protect access.',
  'Input schemas, bounded bodies, CORS, Helmet, and safe production errors are enabled.',
  'Demo records are synthetic and provider credentials remain server-only.'
] as const;

const testingItems = [
  ['Backend', 'Unit, integration, contract, and provider adapter tests'],
  ['Frontend', 'React component tests for loading, error, access, and case views'],
  ['Browser', 'Playwright flows for landing, reviewer access, cases, and RBAC'],
  ['Accessibility', 'axe checks run against public and reviewer-facing screens'],
  ['Quality gates', 'Lint, strict type checking, production builds, and GitHub Actions']
] as const;

const observabilityItems = [
  'API request totals, 5xx counts, and latency aggregation',
  'Redis cache hits, misses, bypasses, and rate-limit fallbacks',
  'Apify dispatch and run outcomes',
  'AI provider request, failure, and latency counters',
  'Outbox recovery totals and safe readiness flags'
] as const;

function EngineeringIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.3-2.9 7.8-7 9-4.1-1.2-7-4.7-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    activity: <><path d="M4 12h3l2-6 3.5 12 2-6H20" /></>,
    route: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a4 4 0 0 1 4 4v6M16 18h-4a4 4 0 0 1-4-4V8" /></>,
    cache: <><path d="M5 8h14M5 16h14" /><path d="M7 5h10v14H7z" /><path d="M10 12h4" /></>,
    worker: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">{children}</p>;
}

function ArchitectureNode({ index, title, detail, tone }: { index: string; title: string; detail: string; tone: string }) {
  return (
    <li className={`relative rounded-2xl border p-4 shadow-sm ${tone}`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/75 font-mono text-[11px] font-semibold text-primary">{index}</span>
      <h3 className="mt-4 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </li>
  );
}

export default function EngineeringPage() {
  return (
    <div className="theme-light engineering-canvas min-h-screen overflow-x-hidden text-foreground">
      <LandingNav />
      <main>
        <section className="relative overflow-hidden bg-white text-foreground" aria-labelledby="engineering-title">
          <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
            <div className="absolute -left-24 -top-40 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute -right-24 bottom-[-16rem] h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-3xl" />
            <div className="engineering-grid absolute inset-0" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 md:px-6 md:pb-28 md:pt-24">
            <div className="max-w-4xl">
              <SectionLabel>Engineering case study</SectionLabel>
              <h1 id="engineering-title" className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl md:text-7xl">Engineering at Case Lens</h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-muted md:text-xl md:leading-9">A production-oriented case study in reliable background processing, secure HR workflows, caching, observability, and recruiter-safe demo architecture.</p>
              <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-foreground">
                {['Current production', 'PostgreSQL source of truth', 'Apify on-demand processing'].map((label) => <span key={label} className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5">{label}</span>)}
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="#architecture" className="inline-flex min-h-11 items-center rounded-full engineering-primary-action px-5 py-2.5 text-sm font-semibold transition">Read the current architecture <span className="ml-2" aria-hidden="true">↓</span></Link>
                <Link href="/login?mode=demo" className="inline-flex min-h-11 items-center rounded-full border border-primary/20 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-primary/5">Open the reviewer walkthrough <span className="ml-2" aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="mt-16 grid gap-3 border-t border-primary/10 pt-6 text-sm text-muted sm:grid-cols-3">
              <p><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">Problem</span><span className="mt-2 block">Fragmented HR conversations need consistent context.</span></p>
              <p><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">System</span><span className="mt-2 block">Durable case intelligence with isolated background work.</span></p>
              <p><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">Boundary</span><span className="mt-2 block">Human reviewers remain authoritative for decisions.</span></p>
            </div>
          </div>
        </section>

        <section id="overview" className="bg-white" aria-labelledby="overview-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="max-w-2xl"><SectionLabel>01 · Product overview</SectionLabel><h2 id="overview-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">From conversation to operational context.</h2><p className="mt-5 text-base leading-7 text-muted">Case Lens transforms Intercom and inbound email conversations into structured, searchable case intelligence while keeping uncertain decisions visible to human reviewers.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {capabilities.map(([title, body], index) => <article key={title} className="engineering-card group"><span className="engineering-number">0{index + 1}</span><h3 className="mt-8 text-lg font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-6 text-muted">{body}</p></article>)}
            </div>
          </div>
        </section>

        <section id="architecture" className="bg-paper" aria-labelledby="architecture-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><SectionLabel>02 · Current production architecture</SectionLabel><h2 id="architecture-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">A durable path for bursty background work.</h2><p className="mt-5 text-base leading-7 text-muted">Verified intake is persisted first. The API dispatches a private Actor for background intelligence, then the resulting snapshot is available to the dashboard and Intercom surfaces.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900"><span className="h-2 w-2 rounded-full bg-success" />Current production</span></div>
            <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="engineering-flow rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <p className="sr-only">Current production flow: Intercom or inbound events move through the Render API into PostgreSQL and durable job state, then a private Apify Actor runs intelligence processing. Persisted intelligence returns to the dashboard and Intercom surfaces.</p>
                <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Current production processing stages">
                  <ArchitectureNode index="01" title="Intercom / inbound events" detail="Verified webhook or normalized intake" tone="border-sky-200 bg-sky-50" />
                  <ArchitectureNode index="02" title="Render API" detail="Validate, deduplicate, and acknowledge" tone="border-sky-200 bg-sky-50" />
                  <ArchitectureNode index="03" title="PostgreSQL" detail="Case state and durable dispatch intent" tone="border-cyan-200 bg-cyan-50" />
                  <ArchitectureNode index="04" title="Transactional outbox" detail="Recoverable job state" tone="border-amber-200 bg-amber-50" />
                  <ArchitectureNode index="05" title="Private Apify Actor" detail="On-demand background execution" tone="border-cyan-200 bg-cyan-50" />
                  <ArchitectureNode index="06" title="AI + deterministic handlers" detail="Extraction, matching, related history" tone="border-orange-200 bg-orange-50" />
                  <ArchitectureNode index="07" title="Persisted intelligence" detail="Snapshot, review flags, run status" tone="border-cyan-200 bg-cyan-50" />
                  <ArchitectureNode index="08" title="Dashboard / Intercom" detail="Review, context, and optional write-back" tone="border-slate-200 bg-slate-50" />
                </ol>
              </div>
              <aside className="rounded-3xl border border-primary/15 bg-white p-5 text-foreground shadow-sm" aria-labelledby="redis-architecture-title">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary"><EngineeringIcon name="cache" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Beside the API</p><h3 id="redis-architecture-title" className="mt-1 text-lg font-semibold">Redis / Upstash</h3></div></div>
                <ul className="mt-6 space-y-3 text-sm text-muted"><li className="flex gap-2"><span className="text-primary">•</span>Distributed rate limiting</li><li className="flex gap-2"><span className="text-primary">•</span>Store-directory cache</li><li className="flex gap-2"><span className="text-primary">•</span>CC-routing cache</li></ul>
                <p className="mt-6 border-t border-primary/10 pt-5 text-xs leading-5 text-muted">Redis is ephemeral infrastructure. It is not the source of truth and it does not run production workers in Apify mode.</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="bg-white" aria-labelledby="decisions-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><SectionLabel>03 · Engineering decisions</SectionLabel><h2 id="decisions-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-primary md:text-5xl">Choose the boundary that makes the system easier to operate.</h2><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{decisions.map((decision) => <article key={decision.title} className="engineering-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-secondary"><EngineeringIcon name={decision.icon} /></span><h3 className="mt-5 text-base font-semibold text-primary">{decision.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{decision.body}</p></article>)}</div></div>
        </section>

        <section className="bg-mist" aria-labelledby="reliability-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="max-w-2xl"><SectionLabel>04 · Reliability</SectionLabel><h2 id="reliability-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Failure scenarios have an explicit next step.</h2><p className="mt-5 text-base leading-7 text-muted">The system is designed around durable state, bounded work, and safe degradation. It does not claim exactly-once delivery; it makes repeated and interrupted work visible and recoverable.</p></div><div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 md:px-7"><span>Scenario</span><span>Mitigation</span></div>{reliabilityRows.map(([scenario, mitigation]) => <div key={scenario} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 border-b border-slate-100 px-5 py-4 text-sm last:border-b-0 md:px-7"><span className="font-medium text-primary">{scenario}</span><span className="flex items-start gap-2 text-muted"><span className="mt-0.5 text-secondary"><EngineeringIcon name="check" /></span>{mitigation}</span></div>)}</div></div>
        </section>

        <section className="bg-white" aria-labelledby="redis-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="max-w-2xl"><SectionLabel>05 · Redis design</SectionLabel><h2 id="redis-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Fast where it helps, disposable where it should be.</h2><p className="mt-5 text-base leading-7 text-muted">Redis uses cache-aside reads for routing metadata and CC candidates, plus shared rate-limit counters. PostgreSQL remains authoritative for directory data and all durable case state.</p></div><div className="mt-10 grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-paper p-5 md:p-7"><p className="text-sm font-semibold text-primary">Cache-aside lookup</p><div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary"><span className="rounded-xl bg-white px-3 py-2 shadow-sm">Request</span><span className="text-secondary" aria-hidden="true">→</span><span className="rounded-xl bg-cyan-100 px-3 py-2">Redis cache</span><span className="text-secondary" aria-hidden="true">→</span><span className="rounded-xl bg-amber-100 px-3 py-2">Miss</span><span className="text-secondary" aria-hidden="true">→</span><span className="rounded-xl bg-sky-100 px-3 py-2">PostgreSQL</span></div><p className="mt-6 text-sm leading-6 text-muted">A successful database read is cached for a short period. Positive and negative lookups use bounded TTLs, so stale or absent entries do not become durable business state.</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 text-foreground md:p-7"><p className="text-sm font-semibold">Generation-based invalidation</p><div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-xl bg-primary/5 px-3 py-2">Directory update</span><span className="text-primary" aria-hidden="true">→</span><span className="rounded-xl bg-cyan-300/15 px-3 py-2 text-primary">Generation advances</span><span className="text-primary" aria-hidden="true">→</span><span className="rounded-xl bg-primary/5 px-3 py-2">Old entries ignored</span></div><p className="mt-6 text-sm leading-6 text-muted">The cache generation advances after a successful PostgreSQL commit. Old entries expire naturally, while reads reject values from an earlier generation.</p></div></div></div>
        </section>

        <section className="bg-paper" aria-labelledby="evolution-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="max-w-2xl"><SectionLabel>06 · Architecture evolution</SectionLabel><h2 id="evolution-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">A valid worker model became a simpler production path.</h2><p className="mt-5 text-base leading-7 text-muted">The business handlers and durable state stayed stable while the execution boundary changed to fit bursty workloads.</p></div><div className="relative mt-10 grid gap-4 lg:grid-cols-2"><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">V1 · Supported alternate</span><h3 className="mt-5 text-2xl font-semibold text-primary">API → Redis/BullMQ → persistent worker</h3><p className="mt-4 text-sm leading-6 text-muted">A continuously available worker consumes Redis queues with retries, backoff, and concurrency controls. This remains a valid deployment option when a team wants a dedicated worker process.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1.5">BullMQ retained</span><span className="rounded-full bg-slate-100 px-3 py-1.5">Redis queue</span><span className="rounded-full bg-slate-100 px-3 py-1.5">Worker mode</span></div></article><article className="rounded-3xl border border-cyan-200 bg-cyan-50/70 p-6 shadow-sm md:p-8"><span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">Current production</span><h3 className="mt-5 text-2xl font-semibold text-primary">API → Apify on-demand Actor</h3><p className="mt-4 text-sm leading-6 text-muted">A private Actor starts when background work is needed, which isolates long-running processing from the API and avoids idle worker capacity. PostgreSQL remains the durable source of truth.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-cyan-900"><span className="rounded-full bg-white/80 px-3 py-1.5">Bursty workload</span><span className="rounded-full bg-white/80 px-3 py-1.5">Isolated execution</span><span className="rounded-full bg-white/80 px-3 py-1.5">Redis for cache/limits</span></div></article></div></div>
        </section>

        <section className="bg-white" aria-labelledby="security-title"><div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"><div><SectionLabel>07 · Security boundaries</SectionLabel><h2 id="security-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Publicly explainable, privately configured.</h2><p className="mt-5 text-base leading-7 text-muted">Security details are intentionally summarized rather than exposing internal implementation specifics.</p></div><ul className="grid gap-3 sm:grid-cols-2">{securityItems.map((item) => <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-paper p-4 text-sm leading-6 text-primary"><span className="mt-0.5 text-secondary"><EngineeringIcon name="check" /></span>{item}</li>)}</ul></div></div></section>

        <section className="bg-mist" aria-labelledby="testing-title"><div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><SectionLabel>08 · Testing & quality</SectionLabel><h2 id="testing-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Current validation runs in GitHub Actions.</h2><p className="mt-5 text-base leading-7 text-muted">The checks focus on behavior and recoverability without calling real providers from browser tests.</p></div><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{testingItems.map(([label, detail], index) => <div key={label} className="flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 md:px-7"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 font-mono text-[11px] font-semibold text-cyan-800">0{index + 1}</span><div><h3 className="text-sm font-semibold text-primary">{label}</h3><p className="mt-1 text-sm text-muted">{detail}</p></div></div>)}</div></div></div></section>

        <section className="bg-white" aria-labelledby="observability-title"><div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="grid gap-10 lg:grid-cols-2 lg:items-start"><div><SectionLabel>09 · Observability</SectionLabel><h2 id="observability-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Designed to be operated, not just developed.</h2><p className="mt-5 text-base leading-7 text-muted">The protected metrics surface reports aggregate health signals without returning request bodies, employee content, prompts, or credentials.</p></div><ul className="grid gap-3">{observabilityItems.map((item) => <li key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-primary"><span className="text-secondary"><EngineeringIcon name="activity" /></span>{item}</li>)}</ul></div></div></section>

        <section className="bg-paper" aria-labelledby="limitations-title"><div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-9"><div className="max-w-2xl"><SectionLabel>10 · Known limitations</SectionLabel><h2 id="limitations-title" className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-5xl">Clear boundaries make the evidence stronger.</h2></div><div className="mt-8 grid gap-3 text-sm leading-6 text-muted md:grid-cols-2"><p className="rounded-2xl bg-paper p-4">This is a portfolio deployment with synthetic or sanitized reviewer data, not a claim about multi-region or high-scale production operation.</p><p className="rounded-2xl bg-paper p-4">Optional provider behavior depends on external APIs. Deterministic fixture mode keeps the public walkthrough stable when those providers are unavailable.</p><p className="rounded-2xl bg-paper p-4">The deployment is single-tenant and some authenticated access state remains in browser session storage.</p><p className="rounded-2xl bg-paper p-4">Local evaluation and benchmark values are labeled by method and environment; they are not live AI accuracy or customer-outcome metrics.</p></div></div></div></section>

        <section className="bg-mist text-foreground" aria-labelledby="engineering-cta-title"><div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20"><div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between"><div className="max-w-2xl"><SectionLabel>11 · Continue the review</SectionLabel><h2 id="engineering-cta-title" className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">See the engineering decisions in the product.</h2><p className="mt-5 text-base leading-7 text-muted">Explore the read-only walkthrough with synthetic cases, then return to the architecture view for the system boundary.</p></div><div className="flex flex-wrap gap-3"><Link href="/login?mode=demo" className="inline-flex min-h-11 items-center rounded-full engineering-primary-action px-5 py-2.5 text-sm font-semibold">Explore live demo <span className="ml-2" aria-hidden="true">→</span></Link><Link href="/architecture" className="inline-flex min-h-11 items-center rounded-full border border-primary/25 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary/5">View architecture</Link></div></div></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
