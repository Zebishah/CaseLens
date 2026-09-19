'use client';

import { useEffect, useState } from 'react';

const phases = [
  { label: 'Queued', className: 'status-queued' },
  { label: 'Processing', className: 'status-processing' },
  { label: 'Completed', className: 'status-completed' }
] as const;

const rails = [
  { label: 'Case', detail: 'Attendance intake' },
  { label: 'Match', detail: 'Jordan Hale' },
  { label: 'History', detail: 'Prior coaching' },
  { label: 'Route', detail: 'Sam Patel' }
];

const findings = [
  { initials: 'JH', title: 'Jordan Hale', meta: 'Identity matched · high confidence', tone: 'bg-mist' },
  { initials: '04', title: 'Write-up follow-up', meta: 'Related attendance history', tone: 'bg-paper' },
  { initials: 'SP', title: 'Sam Patel', meta: 'District manager · routed', tone: 'bg-primary text-white' }
];

const Check = () => (
  <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function HeroVisual() {
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
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  const status = phases[phase] ?? phases[0];
  const railActive = phase === 0 ? 0 : phase === 1 ? 1 : 3;
  const fillHeight = `${(railActive / (rails.length - 1)) * 100}%`;
  const unlocked = phase === 0 ? 1 : phase === 1 ? 2 : 3;

  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2.4rem] bg-gradient-to-br from-white/80 via-mist/50 to-secondary/20 blur-xl"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-[1.7rem] border border-white/80 bg-white shadow-float">
        <div className="flex items-center gap-3 border-b border-primary/10 bg-paper/80 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#d65c5c]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d8a24a]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3ca678]/80" />
          </span>
          <p className="text-xs font-medium tracking-[0.14em] text-muted">Case intelligence</p>
          <p className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`} aria-live="polite">
            {status.label}
          </p>
        </div>

        <div className="grid lg:grid-cols-[11.5rem_minmax(0,1fr)]">
          <aside className="border-b border-primary/10 p-5 lg:border-b-0 lg:border-r">
            <div className="relative">
              <span className="pointer-events-none absolute bottom-3 left-[9px] top-3 w-1 overflow-hidden rounded-full bg-mist">
                <span className="step-track-fill absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-secondary to-primary" style={{ height: fillHeight }} />
              </span>
              <ol className="relative space-y-5">
                {rails.map((item, index) => {
                  const done = index < railActive;
                  const current = index === railActive;
                  const waiting = index > railActive;
                  return (
                    <li key={item.label} className="grid grid-cols-[22px_1fr] items-start gap-3">
                      <span
                        className={`relative z-10 mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-white ${
                          done
                            ? 'bg-secondary'
                            : current
                              ? 'step-pulse bg-primary'
                              : 'border-2 border-mist bg-white'
                        }`}
                      >
                        {done ? <Check /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                      </span>
                      <div className={waiting ? 'opacity-45' : ''}>
                        <p className={`text-sm font-semibold ${current || done ? 'text-primary' : 'text-muted'}`}>
                          {item.label}
                        </p>
                        <p className="text-[11px] text-muted">{item.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          <div key={phase} className="scene-swap p-5 md:p-6">
            <p className="text-[11px] tracking-[0.16em] text-secondary">Attendance case</p>
            <h3 className="mt-1 text-xl font-semibold text-primary">Jordan Hale · Store 1042</h3>
            <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-sm leading-6 text-muted">
              “Late three times this week. Policy guidance requested.”
            </p>
            <ul className="mt-5 space-y-2.5">
              {findings.map((item, index) => {
                const open = index < unlocked;
                return (
                  <li
                    key={item.title}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-500 ${
                      item.tone
                    } ${open ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-35'}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        item.tone.includes('text-white') ? 'bg-white/15 text-white' : 'bg-white text-primary'
                      }`}
                    >
                      {item.initials}
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${item.tone.includes('text-white') ? 'text-white' : 'text-primary'}`}>
                        {item.title}
                      </span>
                      <span className={`block text-[11px] ${item.tone.includes('text-white') ? 'text-white/70' : 'text-muted'}`}>
                        {item.meta}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
