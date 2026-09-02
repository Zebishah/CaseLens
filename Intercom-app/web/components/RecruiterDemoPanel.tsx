'use client';

import { useState, type ReactNode } from 'react';

type CopyTarget = 'email' | 'password' | null;

export function RecruiterDemoPanel({ compact = false }: { compact?: boolean }) {
  const workspaceUrl = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_URL?.trim();
  const workspaceName = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_NAME?.trim() || 'HR Intelligence demo';
  const demoEmail = process.env.NEXT_PUBLIC_INTERCOM_DEMO_EMAIL?.trim();
  const demoPassword = process.env.NEXT_PUBLIC_INTERCOM_DEMO_PASSWORD?.trim();
  const videoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL?.trim();
  const [copied, setCopied] = useState<CopyTarget>(null);
  const credentialsReady = Boolean(demoEmail && demoPassword);

  const copy = async (target: Exclude<CopyTarget, null>, value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className={compact ? 'dash-panel overflow-hidden !p-0' : 'overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-lift'}>
      <div className={compact ? 'border-b border-slate-200 px-5 py-5' : 'border-b border-primary/10 px-6 py-6 md:px-8'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Live recruiter demo</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary md:text-2xl">
              Follow a processed case into the real Intercom inbox.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              This shared workspace contains synthetic portfolio data only. Use the demo teammate to inspect
              conversations and the HR Intelligence Canvas; please do not reply, edit, or close tickets.
            </p>
          </div>
          {workspaceUrl ? (
            <a
              href={workspaceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Open Intercom inbox ↗
            </a>
          ) : null}
        </div>
      </div>

      <div className={`grid ${compact ? 'xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]' : 'lg:grid-cols-2'}`}>
        <div className={compact ? 'p-5' : 'p-6 md:p-8'}>
          <h3 className="text-sm font-semibold text-primary">Demo teammate access</h3>
          {credentialsReady ? (
            <div className="mt-4 space-y-3">
              <CredentialRow
                label="Email"
                value={demoEmail!}
                copied={copied === 'email'}
                onCopy={() => void copy('email', demoEmail)}
              />
              <CredentialRow
                label="Password"
                value={demoPassword!}
                copied={copied === 'password'}
                onCopy={() => void copy('password', demoPassword)}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-primary/15 bg-paper px-4 py-4 text-sm leading-6 text-muted">
              Shared demo credentials are being prepared. The dashboard remains available for the complete
              read-only product walkthrough.
            </div>
          )}

          <ol className="mt-6 space-y-3 text-sm leading-6 text-muted">
            <DemoStep number="1">Open Intercom and sign in with the demo teammate credentials.</DemoStep>
            <DemoStep number="2">If prompted, select the <strong className="text-primary">{workspaceName}</strong> workspace.</DemoStep>
            <DemoStep number="3">Open <strong className="text-primary">Inbox</strong>, then choose <strong className="text-primary">All</strong> or <strong className="text-primary">Unassigned</strong>.</DemoStep>
            <DemoStep number="4">Open any synthetic HR ticket and inspect the HR Intelligence panel on the right.</DemoStep>
          </ol>
          <p className="mt-5 text-xs leading-5 text-muted">
            Shared demonstration account · Synthetic records · Access may be rotated without notice
          </p>
        </div>

        <div className={compact ? 'border-t border-slate-200 bg-slate-950 p-5 xl:border-l xl:border-t-0' : 'border-t border-primary/10 bg-slate-950 p-6 lg:border-l lg:border-t-0 md:p-8'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Guided walkthrough</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Watch the complete subtitled demo</h3>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">3–5 min</span>
          </div>
          {videoUrl ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
              <div className="aspect-video">
                <iframe
                  src={videoUrl}
                  title="HR Intelligence product walkthrough"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="mt-5 flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.04] px-6 text-center">
              <div>
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-lg text-white">▶</span>
                <p className="mt-4 text-sm font-medium text-white">Subtitled walkthrough coming soon</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">The live Intercom workspace remains available above.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-paper px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-1 truncate font-mono text-sm font-medium text-primary">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-lg border border-primary/15 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-mist"
        aria-label={`Copy demo ${label.toLowerCase()}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function DemoStep({ number, children }: { number: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-primary">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}
