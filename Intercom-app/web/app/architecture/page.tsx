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
    copy: 'Intercom webhooks, Resend email, and recruiter demo cases all become one PostgreSQL case with inbound_events idempotency.'
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
      description="Intercom remains the operator-facing HR case workspace. HR Intelligence is the integration and intelligence layer behind it."
    >
      <ArchitectureShowcase showNotesLink={false} />
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
