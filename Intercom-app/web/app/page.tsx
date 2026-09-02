import Link from 'next/link';
import { ArchitectureShowcase } from '../components/landing/ArchitectureShowcase';
import { CtaBand } from '../components/landing/CtaBand';
import { FeatureGallery } from '../components/landing/FeatureGallery';
import { HeroVisual } from '../components/landing/HeroVisual';
import { LandingNav } from '../components/landing/LandingNav';
import { SiteFooter } from '../components/landing/SiteFooter';
import { UseCases } from '../components/landing/UseCases';
import { WaveEdge } from '../components/landing/WaveEdge';
import { WorkflowStory } from '../components/landing/WorkflowStory';

export default function LandingPage() {
  const intercomUrl = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_URL?.trim();

  return (
    <div className="theme-light landing-canvas relative min-h-screen overflow-x-hidden text-foreground">
      <LandingNav />
      <main>
        <section className="relative overflow-hidden bg-mist">
          <div
            className="pointer-events-none absolute -left-32 top-[-8rem] hidden h-[34rem] w-[34rem] rounded-full bg-white lg:block"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-16 top-8 h-36 w-36 rounded-full bg-primary/15 md:-right-24 md:top-24 md:h-72 md:w-72"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-6 top-4 h-24 w-24 rounded-full bg-secondary/25 md:right-24 md:top-12 md:h-40 md:w-40"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 pt-10 md:px-6 md:pb-4 md:pt-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <p className="reveal text-sm font-medium tracking-[0.14em] text-primary">
                AI-powered HR case intelligence
              </p>
              <h1 className="reveal reveal-delay-1 mt-5 max-w-xl text-[2.15rem] font-bold leading-[1.08] tracking-[-0.04em] text-primary sm:text-[2.6rem] md:text-6xl">
                Turn fragmented employee cases into actionable intelligence.
              </h1>
              <p className="reveal reveal-delay-2 mt-6 max-w-lg text-base leading-7 text-muted md:text-lg">
                Ingest HR cases from Intercom, email, or demo, resolve employee identity, connect related
                conversations, and inspect auditable intelligence — without replacing the Intercom inbox.
              </p>
              <div className="reveal reveal-delay-3 mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium">
                  Open recruiter showcase
                </Link>
                <Link href="#product" className="btn-secondary rounded-full px-5 py-2.5 text-sm">
                  Explore the system
                </Link>
                <Link href="#architecture" className="text-sm text-muted hover:text-primary">
                  View architecture
                </Link>
              </div>
            </div>
            <div className="reveal reveal-delay-2 relative lg:-mb-16 lg:translate-y-6">
              <HeroVisual />
            </div>
          </div>
          <WaveEdge fill="#ffffff" className="relative mt-4 h-16 md:h-24" />
        </section>

        <WorkflowStory />

        <div className="bg-white">
          <WaveEdge fill="#f2f2f2" className="h-14 md:h-20" />
        </div>

        <FeatureGallery />

        <section id="architecture" className="relative overflow-hidden bg-mist/50">
          <div
            className="pointer-events-none absolute -right-16 top-10 h-48 w-48 rounded-full bg-white/80"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
            <ArchitectureShowcase />
          </div>
        </section>

        <section id="use-cases" className="relative overflow-hidden bg-paper">
          <div
            className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-white/80"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
            <p className="text-sm font-medium tracking-[0.18em] text-secondary">Use cases</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-primary md:text-5xl">
              The same case looks different once it is intelligence.
            </h2>
            <p className="mt-5 max-w-2xl text-muted">
              Store leadership, HR review, and operations all need the same case to become a person,
              a history, and a next action — not another unread thread.
            </p>
            <div className="mt-10">
              <UseCases />
            </div>
            <p className="mt-8 text-sm">
              <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                Sign in to inspect sanitized cases
              </Link>
            </p>
          </div>
        </section>

        <section id="live-demo" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
            <div className="max-w-3xl">
              <p className="text-sm font-medium tracking-[0.18em] text-secondary">Live product proof</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">
                Review the system in two connected workspaces.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-muted">
                The recruiter dashboard presents sanitized case intelligence and verified system behavior.
                Intercom remains the operator inbox where conversations arrive and intelligence is written back.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-3xl border border-primary/10 bg-paper p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">01 · Recruiter showcase</p>
                <h3 className="mt-3 text-2xl font-semibold text-primary">Read-only intelligence dashboard</h3>
                <p className="mt-3 leading-7 text-muted">
                  Inspect case classification, employee resolution, related history, stakeholder routing,
                  and the production architecture without access to administrative controls.
                </p>
                <Link href="/login" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white">
                  Open recruiter dashboard
                </Link>
              </article>
              <article className="rounded-3xl border border-primary/10 bg-primary p-7 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">02 · Operator workflow</p>
                <h3 className="mt-3 text-2xl font-semibold">Intercom inbox and Canvas</h3>
                <p className="mt-3 leading-7 text-white/75">
                  Follow the same case in Intercom, from signed webhook ingestion to the Canvas intelligence
                  panel and internal-note write-back. Access is granted by individual invitation.
                </p>
                {intercomUrl ? (
                  <a href={intercomUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-white">
                    Open invited Intercom workspace ↗
                  </a>
                ) : (
                  <p className="mt-6 text-sm font-medium text-emerald-200">
                    Live Intercom access is provided during a scheduled review.
                  </p>
                )}
              </article>
            </div>
            <p className="mt-6 text-sm text-muted">
              Portfolio environment only · Synthetic records · No employer or customer data
            </p>
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
