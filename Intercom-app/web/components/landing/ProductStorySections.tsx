import Link from 'next/link';

const capabilities = [
  ['Case intelligence', 'Extracts a structured category and case context from incoming conversations.', 'Less repetitive reading before an operator can start the right investigation.'],
  ['Identity resolution', 'Uses exact, alias, token, and fuzzy evidence with a manual-review fallback.', 'Safer employee linking when names are incomplete or inconsistent.'],
  ['Related-case discovery', 'Surfaces historical conversations using stored employee, name, category, and time-scope evidence.', 'Less manual searching across old conversations.'],
  ['Stakeholder routing', 'Uses store, company, employee, and directory context to recommend relevant contacts.', 'Less repetitive lookup while keeping the operator in control.'],
  ['AI assistant', 'Explains product, case, reliability, and evaluation context through bounded read-only tools.', 'A faster way to find context without granting an AI system write access.'],
  ['Evaluation', 'Separates reproducible fixture quality from live environment activity.', 'Engineering claims stay inspectable instead of becoming unverified marketing metrics.']
] as const;

const faqs = [
  ['What problem does HR Intelligence solve?', 'It reduces the manual work of reading, identifying employees, finding related history, determining store context, and locating stakeholders across fragmented HR conversations.'],
  ['Does it replace Intercom?', 'No. Intercom remains the operator workspace. HR Intelligence adds an intelligence layer and can write the persisted result back beside the case.'],
  ['How does it reduce manual operator work?', 'It automates repetitive case-analysis steps and centralizes identity, related cases, and routing context. Human review remains available when evidence is uncertain.'],
  ['How does the system prevent duplicate processing?', 'Inbound event identifiers, idempotency controls, and deterministic jobs prevent repeated provider deliveries from becoming duplicate logical work.'],
  ['What happens if queue dispatch or AI fails?', 'The transactional outbox makes pending delivery recoverable, while retries, recorded processing states, and deterministic fallbacks keep failures visible and isolated from intake.'],
  ['Does the product walkthrough use real employee data?', 'No. The reviewer workspace uses synthetic or sanitized records. Intercom access is invitation-based and separately controlled.'],
  ['What does the evaluation dashboard measure?', 'It reports versioned fixture evaluation for extraction, classification, identity resolution, related-case behavior, and safe review decisions. It is clearly separate from live production quality.'],
  ['How is sensitive HR data protected?', 'Access is role-gated, assistant tools are read-only and bounded, and raw provider payloads, tokens, SQL, shell commands, and arbitrary browsing are not exposed to the assistant.']
] as const;

const impactItems = [
  { label: 'Less manual searching', icon: 'search' },
  { label: 'Less duplicate logical processing', icon: 'layers' },
  { label: 'Safer identity matching', icon: 'shield' },
  { label: 'Less context switching', icon: 'switch' },
  { label: 'Better traceability', icon: 'route' },
  { label: 'More reliable async processing', icon: 'pulse' },
  { label: 'More consistent intake', icon: 'inbox' },
  { label: 'Measured AI quality', icon: 'chart' }
] as const;

export function ProductStorySections() {
  return (
    <>
      <section id="problem" className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-3xl">
            <p className="text-sm font-medium tracking-[0.18em] text-secondary">The problem</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">HR teams do not need another inbox. They need context.</h2>
            <p className="mt-5 text-lg leading-8 text-muted">Important employee information can be spread across conversations, name variants, directory records, store context, prior cases, and stakeholder lists. The operator still owns the decision; the system should make the investigation easier to start.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {['Conversations arrive without structured employee context.', 'Names can be incomplete, inconsistent, or misspelled.', 'Related history is difficult to find quickly.', 'Store and stakeholder context may require manual lookup.', 'Repeated provider events create duplicate-processing risk.', 'Operators need traceability when AI evidence is uncertain.'].map((item, index) => (
              <article key={item} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm"><span className="text-xs font-semibold text-secondary">0{index + 1}</span><p className="mt-3 text-sm font-medium leading-6 text-primary">{item}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-3xl"><p className="text-sm font-medium tracking-[0.18em] text-secondary">What we changed</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">One explainable intelligence layer around the operator’s existing workflow.</h2><p className="mt-5 text-muted">Intercom, inbound email, and demo intake normalize through the same processing model. The result is stored as an auditable snapshot and remains available beside the case.</p></div>
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {['Conversation arrives', 'Identity is resolved', 'History and routing appear', 'Operator reviews in Intercom'].map((step, index) => <div key={step} className="relative rounded-2xl border border-primary/10 bg-mist p-5"><span className="text-xs font-semibold text-secondary">STEP {index + 1}</span><h3 className="mt-3 text-base font-semibold text-primary">{step}</h3><p className="mt-2 text-sm leading-6 text-muted">{['A signed or validated event enters the shared ingestion path.', 'Evidence is preserved instead of silently forcing uncertain matches.', 'Related cases and stakeholder context become easier to find.', 'The human remains in control, with intelligence next to the conversation.'][index]}</p></div>)}
          </div>
          <div className="mt-8 rounded-2xl bg-primary p-6 text-white md:p-8"><p className="text-sm font-semibold text-emerald-300">Before → after</p><p className="mt-3 text-sm leading-7 text-white/80"><span className="font-semibold text-white">Before:</span> manual reading → employee search → old-case search → store lookup → stakeholder lookup → context carried by hand.</p><p className="mt-2 text-sm leading-7 text-white/80"><span className="font-semibold text-white">After:</span> conversation → HR Intelligence → identity → history → routing → auditable snapshot → operator review in Intercom.</p></div>
        </div>
      </section>

      <section id="ai-intelligence" className="bg-mist/60">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <p className="text-sm font-medium tracking-[0.18em] text-secondary">AI intelligence</p><h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-primary md:text-5xl">Automation that explains its evidence.</h2><p className="mt-5 max-w-2xl text-muted">AI helps structure and explain the case. Deterministic identity, retrieval, authorization, and review rules remain authoritative.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{capabilities.map(([title, what, value]) => <article key={title} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm"><h3 className="text-base font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-6 text-muted"><span className="font-medium text-primary">What it does:</span> {what}</p><p className="mt-2 text-sm leading-6 text-muted"><span className="font-medium text-primary">Operator value:</span> {value}</p></article>)}</div>
        </div>
      </section>

      <section id="impact" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="text-sm font-medium tracking-[0.18em] text-secondary">Organization / operational impact</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">Less searching, safer review, better traceability.</h2><p className="mt-5 leading-7 text-muted">The platform does not invent savings or production volumes. Its defensible value is visible in the workflow: fragmented context is centralized, repetitive analysis is automated, uncertainty is surfaced, and reliability controls are inspectable.</p><Link href="/login" className="btn-primary mt-7 inline-flex rounded-full px-5 py-2.5 text-sm font-medium">Inspect the evidence</Link></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {impactItems.map((item, index) => (
              <article
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-mist/70 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-secondary/35 hover:shadow-lift"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-secondary/10 transition duration-500 group-hover:scale-150" aria-hidden="true" />
                <div className="relative flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-secondary shadow-sm transition duration-300 group-hover:scale-110 group-hover:rotate-3" aria-hidden="true">
                    <ImpactIcon name={item.icon} />
                  </span>
                  <div>
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-secondary">0{index + 1}</span>
                    <h3 className="mt-1 text-sm font-semibold leading-5 text-primary">{item.label}</h3>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="engineering-proof" className="bg-mist/60">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
          <p className="text-sm font-medium tracking-[0.18em] text-secondary">Engineering proof</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-primary md:text-5xl">The quality story is inspectable.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['3 intake paths', 'Intercom, inbound email, and demo cases share one normalized ingestion model.'],
              ['1 durable source of truth', 'PostgreSQL stores the case, snapshot, directory context, and processing state.'],
              ['Read-only by design', 'Assistant tools are bounded and role-aware; deterministic identity and retrieval stay authoritative.'],
              ['Versioned evaluation', 'Fixture quality is reproducible and clearly separated from live environment activity.']
            ].map(([label, copy]) => <article key={label} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm"><h3 className="text-base font-semibold text-primary">{label}</h3><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-paper">
        <div className="mx-auto max-w-4xl px-4 py-20 md:px-6 md:py-28"><p className="text-sm font-medium tracking-[0.18em] text-secondary">FAQ</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">Product value and engineering detail, in plain language.</h2><div className="mt-8 space-y-3">{faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-primary/10 bg-white px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-primary"><span>{question}</span><span className="text-xl font-normal text-secondary transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{answer}</p></details>)}</div></div>
      </section>
    </>
  );
}

function ImpactIcon({ name }: { name: (typeof impactItems)[number]['icon'] }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    layers: <><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    switch: <><path d="M5 7h11M15 4l3 3-3 3M19 17H8M9 14l-3 3 3 3" /></>,
    route: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a4 4 0 0 1 4 4v6" /></>,
    pulse: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>,
    chart: <><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19h18" /></>
  } as const;

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
