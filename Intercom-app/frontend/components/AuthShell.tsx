import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowIcon, IntelligenceMark, SignalIcon } from './landing/LandingIcons';
import { ProductJourney } from './ProductJourney';

export function AuthShell({ children, mode = 'signin' }: { children: ReactNode; mode?: 'signin' | 'access' | 'recovery' }) {
  return (
    <main className={`product-auth auth-mode-${mode}`}>
      <a href="#auth-content" className="product-skip-link">Skip to form</a>
      <header className="auth-navigation">
        <Link href="/" className="product-brand"><IntelligenceMark /><span>Case <span>Lense</span><sup>AI</sup></span></Link>
        <Link href="/" className="auth-home-link"><span aria-hidden="true">←</span> Back to product</Link>
      </header>
      <div className="auth-layout">
        <aside className="auth-product-story" aria-label="About Case Lense">
          <p className="product-eyebrow"><span /> AI-POWERED HR CASE INTELLIGENCE</p>
          <h2>Your inbox has the messages.<br /><span>Give your team the full picture.</span></h2>
          <p>Turn Intercom and email conversations into clear HR cases, connected employee history, and informed next steps.</p>
          <ProductJourney />
          <div className="auth-case-visual">
            <div className="auth-case-message"><SignalIcon type="message" /><span>“Jordan has been late three times this week…”</span></div>
            <div className="auth-case-connector" aria-hidden="true"><span /><IntelligenceMark /><span /></div>
            <div className="auth-case-result"><span className="auth-case-avatar">JH</span><div><strong>Jordan Hale</strong><span>Identity resolved · Related history connected</span></div><span className="auth-case-check">✓</span></div>
            <p>Illustrative case · AI assists, people decide</p>
          </div>
          <Link href="/#live-demo" className="auth-product-preview">
            <Image src="/product-screenshots/sarah-identity-resolution.webp" alt="Synthetic Intercom conversation with Case Lense employee matching and related-case evidence" width={1100} height={700} sizes="(max-width: 900px) 90vw, 540px" />
            <span><span>INSIDE THE PRODUCT<strong>Context, right beside the conversation.</strong></span><ArrowIcon diagonal /></span>
          </Link>
          <div className="auth-audiences"><span><SignalIcon type="person" /> For HR teams and operators</span><Link href="/engineering">Recruiter? Explore the engineering <ArrowIcon diagonal /></Link></div>
        </aside>
        <section id="auth-content" className="auth-form-region" aria-label="Workspace access">{children}</section>
      </div>
      <footer className="auth-footer"><span>AI-assisted. Evidence-led. Human-reviewed.</span><span>Product evaluation uses synthetic data.</span></footer>
    </main>
  );
}
