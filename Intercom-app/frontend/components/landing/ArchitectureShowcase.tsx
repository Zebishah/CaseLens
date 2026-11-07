'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StepArrow } from './StepArrow';

const modes = {
  portfolio: {
    label: 'Inline workspace processing',
    caption: 'Reviewer sample cases finish inline in the API request. Intercom webhooks still persist first, then process.',
    nodes: [
      { title: 'Case submitted', detail: 'Demo, email, or Intercom become one case event' },
      { title: 'Processed inline', detail: 'Shared intelligence runs without a worker' },
      { title: 'Result stored', detail: 'Snapshot written back to PostgreSQL' }
    ]
  },
  production: {
    label: 'Production architecture',
    caption: 'Intercom is the operator inbox. This app is the intelligence layer behind it.',
    nodes: [
      { title: 'Intercom webhook', detail: 'Verified, idempotent ingest into PostgreSQL' },
      { title: 'Shared processor', detail: 'BullMQ worker runs processCaseIntelligence' },
      { title: 'Optional write-back', detail: 'Internal note and tags return to Intercom' }
    ]
  }
} as const;

const sources = ['Demo form', 'Inbound email', 'Intercom'];

const pipeline = [
  'Intercom Developer Workspace',
  'Webhook (HMAC verified)',
  'Intercom adapter',
  'Source-agnostic ingestion',
  'PostgreSQL · inbound_events · outbox',
  'BullMQ worker or inline processor',
  'Shared intelligence · Gemini',
  'Case snapshot in PostgreSQL',
  'Optional Intercom note/tag write-back'
];

const technologies = [
  'Next.js',
  'TypeScript',
  'Express',
  'PostgreSQL',
  'Redis',
  'BullMQ',
  'Gemini',
  'Intercom'
] as const;

export function ArchitectureShowcase({ showNotesLink = true }: { showNotesLink?: boolean }) {
  const [mode, setMode] = useState<keyof typeof modes>('portfolio');
  const active = modes[mode];

  return (
    <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col">
        <p className="text-sm font-medium tracking-[0.18em] text-secondary">Architecture</p>
        <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-primary md:text-5xl">
          Intercom is the inbox. This is the intelligence layer.
        </h2>
        <p className="mt-5 max-w-md text-muted">
          Operators work in Intercom. Case Lens verifies events, resolves employees, finds related
          cases, and can write a concise note back into the conversation.
        </p>
        <div
          className="mt-8 inline-flex flex-wrap rounded-full bg-white p-1 shadow-lift"
          role="tablist"
          aria-label="Processing architecture"
        >
          {(Object.keys(modes) as Array<keyof typeof modes>).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mode === key ? 'bg-primary text-white' : 'text-muted hover:text-primary'
              }`}
              onClick={() => setMode(key)}
            >
              <span className="sm:hidden">{key === 'portfolio' ? 'Inline' : 'Distributed'}</span>
              <span className="hidden sm:inline">{modes[key].label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-md text-sm text-muted">{active.caption}</p>
        {showNotesLink ? (
          <Link
            href="/architecture"
            className="mt-8 inline-flex rounded-full border border-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-white"
          >
            Read the system notes
          </Link>
        ) : null}
        <div className="mt-8 flex-1 rounded-[1.6rem] border border-primary/10 bg-white/60 p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-[0.16em] text-secondary">Shared path</p>
              <h3 className="mt-2 text-base font-semibold text-primary">One durable route for every source</h3>
            </div>
            <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-medium text-primary">09 steps</span>
          </div>
          <ol className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {pipeline.map((step, index) => (
              <li key={step} className="flex gap-2.5 text-sm leading-5 text-primary">
                <span className="shrink-0 font-mono text-[11px] text-secondary">{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2.2rem] bg-white p-5 shadow-float md:p-7">
        <div
          className="pointer-events-none absolute -right-10 top-8 h-32 w-32 rounded-full bg-mist"
          aria-hidden="true"
        />
        <p className="text-[11px] font-medium tracking-[0.16em] text-secondary">Case flow</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {sources.map((source) => (
            <span key={source} className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-primary">
              {source}
            </span>
          ))}
        </div>

        <div className="relative mt-10">
          <ol className="flex flex-col md:flex-row md:items-stretch">
            {active.nodes.map((node, index) => (
              <li key={node.title} className="flex flex-1 flex-col md:flex-row md:items-stretch">
                {index > 0 ? <StepArrow vertical /> : null}
                {index > 0 ? <StepArrow /> : null}
                <div className="lift-hover w-full flex-1 rounded-[1.6rem] bg-paper p-4 text-left">
                  <p className="font-mono text-xs text-secondary">{String(index + 1).padStart(2, '0')}</p>
                  <p className="mt-3 font-semibold text-primary">{node.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{node.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <article className="rounded-[1.5rem] bg-mist/50 p-4">
            <p className="text-xs text-muted">Intelligence</p>
            <p className="mt-2 text-sm font-semibold text-primary">Identity · related cases · stakeholders</p>
          </article>
          <article className="rounded-[1.5rem] bg-primary p-4 text-white">
            <p className="text-xs text-white/70">Stored result</p>
            <p className="mt-2 text-sm font-semibold">Snapshot stays on the case</p>
          </article>
        </div>

        <div className="mt-6 border-t border-primary/10 pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-secondary">
            Core technology
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Core technology stack">
            {technologies.map((technology) => (
              <li
                key={technology}
                className="rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
              >
                {technology}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
