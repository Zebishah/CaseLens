'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StepArrow } from './StepArrow';

const beats = [
  {
    n: '01',
    title: 'Case arrives',
    copy: 'A recruiter session creates a queued case. Demo, email, and Intercom all become the same event.',
    chip: 'Queued',
    chipClass: 'status-queued'
  },
  {
    n: '02',
    title: 'System resolves',
    copy: 'Intelligence claims the row, extracts people and category, and matches the employee directory.',
    chip: 'Processing',
    chipClass: 'status-processing'
  },
  {
    n: '03',
    title: 'Result appears',
    copy: 'Related cases, stakeholders, and the snapshot land on the case. Operators keep working in Intercom.',
    chip: 'Completed',
    chipClass: 'status-completed'
  }
];

const scenes = [
  {
    kicker: 'Incoming case',
    title: 'Attendance — Jordan Hale',
    body: 'From 1042@northwind.co. Late three times this week. Policy guidance requested.',
    notes: ['Store 1042', 'Queued for processing']
  },
  {
    kicker: 'Resolving',
    title: 'Matching Jordan Hale',
    body: 'Name, store, and sender domain are compared against the directory.',
    notes: ['Identity extracted', 'Category: attendance']
  },
  {
    kicker: 'Intelligence ready',
    title: 'Case file complete',
    body: 'Employee found, prior coaching surfaced, district manager routed.',
    notes: ['Related history', 'Stakeholder ready']
  }
];

const dossier = [
  { label: 'Identity', value: 'Jordan Hale', meta: 'Directory match · store 1042' },
  { label: 'Related cases', value: 'Write-up follow-up', meta: 'Same employee · attendance' },
  { label: 'Stakeholder', value: 'Sam Patel', meta: 'District manager · routed' }
];

export function WorkflowStory() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      return;
    }
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % beats.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const scene = scenes[active] ?? scenes[0];
  const beat = beats[active] ?? beats[0];

  return (
    <section id="product" className="relative bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <p className="text-sm font-medium tracking-[0.18em] text-secondary">Product story</p>
        <div className="mt-4 grid items-end gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-primary md:text-5xl md:leading-[1.08]">
            See the system think through a case.
          </h2>
          <p className="max-w-md text-muted">
            A recruiter session creates a case, claims processing, and runs the shared intelligence
            function. Custom live AI is optional and rate-limited.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[2.4rem] bg-mist/60 p-5 shadow-lift md:p-8 lg:p-10">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/70"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-secondary/20"
            aria-hidden="true"
          />

          <ol className="relative flex flex-col md:flex-row md:items-stretch">
            {beats.map((item, index) => {
              const selected = index === active;
              return (
                <li key={item.n} className="flex flex-1 flex-col md:flex-row md:items-stretch">
                  {index > 0 ? <StepArrow vertical /> : null}
                  {index > 0 ? <StepArrow /> : null}
                  <button
                    type="button"
                    className={`lift-hover w-full flex-1 rounded-[1.8rem] border bg-white p-5 text-left transition ${
                      selected ? 'border-secondary/50 shadow-float' : 'border-transparent shadow-lift'
                    }`}
                    aria-pressed={selected}
                    onClick={() => setActive(index)}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mist text-xs font-semibold text-primary">
                        {item.n}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${item.chipClass}`}>{item.chip}</span>
                    </span>
                    <span className="mt-4 block text-xl font-semibold text-primary">{item.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-muted">{item.copy}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="relative mt-8 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <article className="rounded-[1.9rem] bg-white p-6 shadow-float md:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.16em] text-muted">{scene.kicker}</p>
                  <h3 className="mt-2 text-2xl font-bold text-primary">{scene.title}</h3>
                </div>
                <p className={`rounded-full px-3 py-1 text-xs font-medium ${beat.chipClass}`} aria-live="polite">
                  {beat.chip}
                </p>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-muted">{scene.body}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {scene.notes.map((note) => (
                  <li key={note} className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-primary">
                    {note}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted">Status changes here are decorative, not a live job.</p>
            </article>

            <aside className="rounded-[1.9rem] bg-primary p-6 text-white shadow-float md:p-7">
              <p className="text-[11px] tracking-[0.18em] text-secondary">Resolved file</p>
              <h3 className="mt-2 text-xl font-semibold">What lands on the case</h3>
              <ol className="relative mt-6 space-y-5">
                <span className="pointer-events-none absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-secondary to-white/20" />
                {dossier.map((item) => (
                  <li key={item.label} className="grid grid-cols-[14px_1fr] gap-3">
                    <span className="relative z-10 mt-1.5 h-3.5 w-3.5 rounded-full bg-secondary" />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">{item.label}</p>
                      <p className="mt-1 font-semibold">{item.value}</p>
                      <p className="text-sm text-white/70">{item.meta}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium">
            Open the application
          </Link>
          <Link href="/overview" className="btn-secondary rounded-full px-5 py-2.5 text-sm">
            Application overview
          </Link>
        </div>
      </div>
    </section>
  );
}
