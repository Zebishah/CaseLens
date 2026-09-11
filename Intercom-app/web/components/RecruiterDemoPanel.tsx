import Link from 'next/link';
import type { ReactNode } from 'react';
import { PRODUCT_DEMO_HIGHLIGHTS, PRODUCT_DEMO_URL } from '../lib/product-demo';
import { DemoVideoEmbed } from './DemoVideoEmbed';

type Screenshot = {
  title: string;
  description: string;
  alt: string;
  url: string;
};

export function RecruiterDemoPanel({ compact = false }: { compact?: boolean }) {
  const videoUrl = PRODUCT_DEMO_URL;
  const screenshots: Screenshot[] = [
    {
      title: 'Intercom case inbox',
      description: 'A single-name mention is resolved to Sarah Saffari with confidence evidence and relevant case history.',
      alt: 'Intercom Inbox showing HR Intelligence matching a Sarah mention to Sarah Saffari and listing closely related cases.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_INBOX_URL?.trim() ||
        '/product-screenshots/sarah-identity-resolution.webp'
    },
    {
      title: 'Name-variant resolution',
      description: 'The system preserves the reported spelling, surfaces a possible duplicate, and explains why prior cases are related.',
      alt: 'Intercom HR Intelligence panel showing Ayesha Sophy matched to Ayesha Sophie with possible-same-person and related-case evidence.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_CANVAS_URL?.trim() ||
        '/product-screenshots/ayesha-related-case-evidence.webp'
    },
    {
      title: 'Structured case intelligence',
      description: 'An exact directory match appears beside category, processing version, routing controls, and connected cases.',
      alt: 'Intercom conversation showing an exact Darren Watkins employee match, Conduct category, processing metadata, and related cases.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_DASHBOARD_URL?.trim() ||
        '/product-screenshots/darren-exact-match.webp'
    }
  ];

  return (
    <section className={compact ? 'dash-panel overflow-hidden !p-0' : 'overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-lift'}>
      <div className={compact ? 'border-b border-slate-200 px-5 py-5' : 'border-b border-primary/10 px-6 py-6 md:px-8'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Guided product access</p>
            <h2 className="mt-2 max-w-3xl text-xl font-semibold tracking-tight text-primary md:text-2xl">
              Explore the complete workflow without shared-account security shortcuts.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              The dashboard explains system behavior and operational evidence. Intercom is the real operator
              workspace where synthetic conversations arrive and HR intelligence appears beside each ticket.
            </p>
          </div>
          <Link href="/access" className="btn-primary inline-flex shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold">
            Request Intercom access
          </Link>
        </div>
      </div>

      <div className={`grid ${compact ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'lg:grid-cols-2'}`}>
        <div className={compact ? 'p-5' : 'p-6 md:p-8'}>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-secondary">Two connected workspaces</p>
          <div className="mt-4 space-y-3">
            <WorkspaceCard
              number="01"
              title="Portfolio dashboard"
              copy="Read-only case intelligence, directory evidence, reliability status, and verified architecture. The demo session is issued by the server and expires automatically."
            />
            <WorkspaceCard
              number="02"
              title="Intercom Inbox"
              copy="The third-party operator UI for opening synthetic conversations and inspecting the embedded HR Intelligence panel and write-back."
            />
          </div>

          <div className="mt-6 rounded-xl border border-primary/10 bg-paper p-4">
            <h3 className="text-sm font-semibold text-primary">Why an invitation is required</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Intercom verifies unfamiliar sign-ins by email. Shared credentials cannot provide reliable or secure
              access, so approved reviewers receive an invitation at their own email address.
            </p>
          </div>

          <ol className="mt-6 space-y-3 text-sm leading-6 text-muted">
            <DemoStep number="1">Submit your name, work email, and review context.</DemoStep>
            <DemoStep number="2">After approval, accept the official Intercom invitation sent to that email.</DemoStep>
            <DemoStep number="3">Select <strong className="text-primary">Nagumo Workspace [DEV]</strong>.</DemoStep>
            <DemoStep number="4">Open <strong className="text-primary">Inbox → All or Unassigned</strong>, then select a synthetic ticket.</DemoStep>
          </ol>

          <p className="mt-5 text-xs leading-5 text-muted">
            Manual approval · Synthetic records only · Access may be time-limited or revoked
          </p>
        </div>

        <div className={compact ? 'border-t border-slate-200 bg-slate-950 p-5 xl:border-l xl:border-t-0' : 'border-t border-primary/10 bg-slate-950 p-6 lg:border-l lg:border-t-0 md:p-8'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Immediate walkthrough</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Watch the complete subtitled demo</h3>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">5 min</span>
          </div>
          <div className="mt-5">
            <DemoVideoEmbed videoUrl={videoUrl} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="#product-screenshots" className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10">View screenshots</a>
            <Link href="/access" className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-100">
              Request invitation
            </Link>
          </div>
          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">What the walkthrough covers</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PRODUCT_DEMO_HIGHLIGHTS.map((highlight, index) => (
                <article key={highlight.title} className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-[11px] font-semibold text-emerald-300">{index + 1}</span>
                    <div><h4 className="text-sm font-semibold text-white">{highlight.title}</h4><p className="mt-1 text-xs leading-5 text-slate-400">{highlight.description}</p></div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">5-minute guided tour · Captions included · Synthetic demonstration data only</p>
          </div>
        </div>
      </div>

      <div id="product-screenshots" className={compact ? 'scroll-mt-6 border-t border-slate-200 px-5 py-5' : 'scroll-mt-6 border-t border-primary/10 px-6 py-6 md:px-8'}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-primary">Product screenshots</h3>
            <p className="mt-1 text-sm text-muted">A visual tour using the same sanitized portfolio environment.</p>
          </div>
          <Link href="/access" className="text-sm font-semibold text-primary hover:text-primary-hover">Request personal access →</Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {screenshots.map((screenshot) => (
            <ScreenshotCard key={screenshot.title} screenshot={screenshot} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkspaceCard({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white p-4">
      <div className="flex gap-3">
        <span className="text-xs font-semibold tracking-[0.12em] text-secondary">{number}</span>
        <div>
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function DemoStep({ number, children }: { number: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-primary">{number}</span>
      <span>{children}</span>
    </li>
  );
}

function ScreenshotCard({ screenshot }: { screenshot: Screenshot }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <a
        href={screenshot.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open full-size screenshot: ${screenshot.title}`}
        className="block overflow-hidden border-b border-primary/10 bg-slate-950"
      >
        <div
          role="img"
          aria-label={screenshot.alt}
          className="aspect-[16/10] bg-contain bg-center bg-no-repeat transition duration-300 group-hover:scale-[1.015]"
          style={{ backgroundImage: `url("${screenshot.url}")` }}
        />
      </a>
      <div className="p-4">
        <h4 className="text-sm font-semibold text-primary">{screenshot.title}</h4>
        <p className="mt-1 text-xs leading-5 text-muted">{screenshot.description}</p>
        <a href={screenshot.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-primary hover:text-primary-hover">
          View full size →
        </a>
      </div>
    </article>
  );
}
