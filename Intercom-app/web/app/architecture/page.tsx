import { AppShell } from '../../components/AppShell';
import { SectionCard } from '../../components/dashboard/ui';
import { ArchitectureShowcase } from '../../components/landing/ArchitectureShowcase';

const notes = [
  {
    title: 'Intercom is the operator workspace',
    copy: 'Teammates read, reply, and assign in the Intercom Developer Workspace. This app does not recreate that inbox.'
  },
  {
    title: 'One ingestion layer',
    copy: 'Intercom webhooks, Resend email, and reviewer sample cases all become one PostgreSQL case with inbound_events idempotency.'
  },
  {
    title: 'One processor',
    copy: 'processCaseIntelligence runs inline for demo or on BullMQ for production. Gemini, identity, related cases, and stakeholders stay shared.'
  },
  {
    title: 'Optional write-back',
    copy: 'After intelligence completes, an internal Intercom note and a small tag set can sync. Write-back failure does not fail the case.'
  }
];

export default function ArchitecturePage() {
  return (
    <AppShell
      title="Architecture"
      description="Intercom remains the operator-facing workspace. HR Intelligence is the explainable intelligence layer for identity, history, routing, and human review."
    >
      <ArchitectureShowcase showNotesLink={false} />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <FlowCard
          label="Core processing"
          title="Reliable case intelligence"
          steps={['Intercom / email event', 'Idempotent ingestion', 'PostgreSQL case state', 'Identity, history & routing', 'Optional Intercom write-back']}
        />
        <FlowCard
          label="AI assistant"
          title="Bounded explanations"
          steps={['Authorized question', 'Safe product + case context', 'Grounded provider or fallback', 'Read-only answer with source']}
        />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {notes.map((note, index) => (
          <SectionCard key={note.title} className={index % 2 ? 'card-asymmetric-alt' : 'card-asymmetric'}>
            <p className="font-mono text-xs text-secondary">{String(index + 1).padStart(2, '0')}</p>
            <h2 className="mt-3 text-xl font-semibold text-primary">{note.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{note.copy}</p>
          </SectionCard>
        ))}
      </div>
    </AppShell>
  );
}

function FlowCard({ label, title, steps }: { label: string; title: string; steps: string[] }) {
  return <section className="dash-panel"><p className="dashboard-section-label">{label}</p><h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2><div className="mt-5 flex flex-wrap items-center gap-2">{steps.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="rounded-lg border border-secondary/25 bg-emerald-50 px-3 py-2 text-xs font-semibold text-primary">{step}</span>{index < steps.length - 1 ? <span className="text-secondary" aria-hidden="true">→</span> : null}</div>)}</div></section>;
}
