import Link from 'next/link';

type Screenshot = {
  title: string;
  description: string;
  url?: string;
};

export function RecruiterDemoPanel({ compact = false }: { compact?: boolean }) {
  const videoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL?.trim();
  const screenshots: Screenshot[] = [
    {
      title: 'Intercom case inbox',
      description: 'Synthetic HR conversations in the operator workspace.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_INBOX_URL?.trim()
    },
    {
      title: 'HR Intelligence panel',
      description: 'Identity, category, related history, routing, and review evidence.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_CANVAS_URL?.trim()
    },
    {
      title: 'Operations dashboard',
      description: 'Case visibility, delivery health, and architecture evidence.',
      url: process.env.NEXT_PUBLIC_DEMO_SCREENSHOT_DASHBOARD_URL?.trim()
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
              copy="Read-only case intelligence, directory evidence, reliability status, and verified architecture. Reviewer credentials are issued separately."
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
                <p className="mt-1 text-xs leading-5 text-slate-400">Use the visual tour below while the final recording is prepared.</p>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="#product-screenshots" className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10">
              View screenshots
            </a>
            <Link href="/access" className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-100">
              Request invitation
            </Link>
          </div>
        </div>
      </div>

      <div id="product-screenshots" className={compact ? 'border-t border-slate-200 px-5 py-5' : 'border-t border-primary/10 px-6 py-6 md:px-8'}>
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

function DemoStep({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-primary">{number}</span>
      <span>{children}</span>
    </li>
  );
}

function ScreenshotCard({ screenshot }: { screenshot: Screenshot }) {
  return (
    <article className="overflow-hidden rounded-xl border border-primary/10 bg-white">
      {screenshot.url ? (
        <div
          role="img"
          aria-label={screenshot.title}
          className="aspect-[16/10] bg-slate-100 bg-cover bg-center"
          style={{ backgroundImage: `url("${screenshot.url}")` }}
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-paper px-5 text-center">
          <div>
            <span className="mx-auto block h-8 w-8 rounded-lg border border-dashed border-primary/20" />
            <p className="mt-3 text-xs font-medium text-muted">Screenshot placeholder</p>
          </div>
        </div>
      )}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-primary">{screenshot.title}</h4>
        <p className="mt-1 text-xs leading-5 text-muted">{screenshot.description}</p>
      </div>
    </article>
  );
}
