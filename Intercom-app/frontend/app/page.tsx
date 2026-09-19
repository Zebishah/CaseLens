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
import { RecruiterDemoPanel } from '../components/RecruiterDemoPanel';
import { ProductStorySections } from '../components/landing/ProductStorySections';

export default function LandingPage() {
  return (
    <div className="theme-light landing-canvas relative min-h-screen overflow-x-hidden text-foreground">
      <LandingNav />
      <main>
        <section className="relative overflow-hidden bg-mist">
          <div
            className="hero-glow pointer-events-none absolute -left-40 -top-40 hidden h-[36rem] w-[36rem] lg:block"
            aria-hidden="true"
          />
          <div
            className="landing-grid pointer-events-none absolute inset-0 hidden opacity-40 md:block"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 pt-10 md:px-6 md:pb-4 md:pt-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <p className="reveal text-sm font-medium tracking-[0.14em] text-primary">
                AI-Powered B2B HR Intelligence Platform
              </p>
              <h1 className="reveal reveal-delay-1 mt-5 max-w-xl text-[2.15rem] font-bold leading-[1.08] tracking-[-0.04em] text-primary sm:text-[2.6rem] md:text-6xl">
                Turn fragmented HR conversations into explainable case intelligence.
              </h1>
              <p className="reveal reveal-delay-2 mt-6 max-w-lg text-base leading-7 text-muted md:text-lg">
                HR Intelligence helps organizations transform Intercom and email conversations into structured employee
                identity, related history, stakeholder context, and auditable case intelligence — while keeping human
                reviewers in control.
              </p>
              <div className="reveal reveal-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="#live-demo" className="btn-primary inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 sm:w-auto">
                  Watch product walkthrough
                </Link>
                <Link href="/login?mode=demo" className="btn-secondary inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 sm:w-auto">
                  Explore reviewer walkthrough
                </Link>
                <Link href="/access" className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-white/50 hover:text-primary-hover sm:w-auto">
                  Request reviewer access <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <div className="reveal reveal-delay-2 relative lg:-mb-16 lg:translate-y-6">
              <HeroVisual />
            </div>
          </div>
          <WaveEdge fill="#ffffff" className="relative mt-4 h-16 md:h-24" />
        </section>

        <ProductStorySections />

        <WorkflowStory />

        <div className="bg-white">
          <WaveEdge fill="#f2f2f2" className="h-14 md:h-20" />
        </div>

        <FeatureGallery />

        <section id="architecture" className="relative overflow-hidden bg-mist/50">
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <ArchitectureShowcase />
          </div>
        </section>

        <section id="use-cases" className="relative overflow-hidden bg-paper">
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
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
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="max-w-3xl">
              <p className="text-sm font-medium tracking-[0.18em] text-secondary">Live product proof</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">
                See HR Intelligence across the organization workflow.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-muted">
                The reviewer workspace presents sanitized case intelligence, directory context, quality signals, and
                operational health. Intercom remains the operator inbox where conversations arrive and intelligence is
                written back.
              </p>
            </div>
            <div className="mt-10">
              <RecruiterDemoPanel />
            </div>
            <p className="mt-6 text-sm text-muted">
              Reviewer environment · Synthetic records · No employer or customer data
            </p>
          </div>
        </section>

        <section className="bg-paper" aria-labelledby="engineering-teaser-title">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <div className="engineering-card flex flex-col gap-8 overflow-hidden bg-slate-950 text-white md:flex-row md:items-center md:justify-between md:p-9">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Engineering case study</p>
                <h2 id="engineering-teaser-title" className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Built as an engineering case study.</h2>
                <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base">Explore the architecture, reliability patterns, testing strategy, security boundaries, and infrastructure decisions behind HR Intelligence.</p>
              </div>
              <Link href="/engineering" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">Explore the engineering <span className="ml-2" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
