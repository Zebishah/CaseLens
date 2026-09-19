'use client';

import { useEffect, useState } from 'react';

const steps = [
  { id: 'received', label: 'Case arrives', detail: 'Attendance case stored as queued' },
  { id: 'identity', label: 'Identity resolved', detail: 'Jordan Hale from subject and body' },
  { id: 'matched', label: 'Employee matched', detail: 'High-confidence directory match · store 1042' },
  { id: 'related', label: 'Related cases', detail: 'Prior attendance coaching surfaced' },
  { id: 'stakeholders', label: 'Stakeholders', detail: 'District manager routed' },
  { id: 'ready', label: 'Intelligence ready', detail: 'Snapshot written to PostgreSQL' }
];

const phases = [
  { label: 'Queued', className: 'status-queued' },
  { label: 'Processing', className: 'status-processing' },
  { label: 'Completed', className: 'status-completed' }
] as const;

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase(2);
      return;
    }

    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % phases.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  const status = phases[phase] ?? phases[0];
  const activeIndex = phase === 0 ? 0 : phase === 1 ? 3 : 5;

  if (compact) {
    return (
      <div className="panel overflow-hidden rounded-[1.75rem] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-primary">Attendance — Jordan Hale</p>
          <p className={`rounded-full px-2.5 py-1 text-xs ${status.className}`} aria-live="polite">
            {status.label}
          </p>
        </div>
        <ol className="space-y-2">
          {steps.slice(0, 4).map((step, index) => (
            <li key={step.id} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  index < activeIndex
                    ? 'pipeline-dot is-done'
                    : index === activeIndex
                      ? 'pipeline-dot is-active'
                      : 'pipeline-dot'
                }`}
              />
              <span className="text-foreground">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden rounded-[2rem] p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-secondary">Illustrated product flow</p>
          <p className="mt-1 text-lg font-semibold text-primary">Case arrives → system resolves → result appears</p>
        </div>
        <p className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`} aria-live="polite">
          {status.label}
        </p>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Uses the existing sample-case shape. Status changes here are decorative, not a live job.
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <article className="rounded-[1.6rem] bg-paper p-5">
          <p className="text-xs text-muted">Incoming case</p>
          <h3 className="mt-2 text-sm font-semibold text-primary">Attendance — Jordan Hale</h3>
          <p className="mt-2 text-xs leading-5 text-muted">
            From 1042@northwind.co · Store 1042 Manager. Late three times this week. Policy guidance
            requested.
          </p>
          <p className="mt-4 inline-block rounded-full px-2 py-1 text-xs status-queued">Queued</p>
        </article>
        <ol className="relative space-y-3">
          {steps.map((step, index) => (
            <li key={step.id} className="grid grid-cols-[14px_1fr] items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 rounded-full ${
                  index < activeIndex
                    ? 'pipeline-dot is-done'
                    : index === activeIndex
                      ? 'pipeline-dot is-active'
                      : 'pipeline-dot'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <article className="rounded-[1.6rem] border border-primary/10 bg-mist/40 p-5">
          <p className="text-xs text-muted">Intelligence result</p>
          <p className="mt-2 text-sm">
            Employee <span className="font-semibold text-primary">Jordan Hale</span>
          </p>
          <p className="text-xs text-muted">High confidence · store 1042 · attendance</p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            <li>Related: Write-up follow-up — Jordan Hale</li>
            <li>Stakeholder: Sam Patel · District manager</li>
            <li>Source label: Deterministic demo</li>
          </ul>
          <p className="mt-4 inline-block rounded-full px-2 py-1 text-xs status-completed">Completed</p>
        </article>
      </div>
    </div>
  );
}
