import Link from 'next/link';
import { LandingMotion } from '../components/landing/LandingMotion';
import { ProductEvidence } from '../components/landing/ProductEvidence';
import { HeroVisual } from '../components/landing/HeroVisual';
import { LandingNav } from '../components/landing/LandingNav';
import { ArrowIcon, IntelligenceMark, SignalIcon } from '../components/landing/LandingIcons';
import { IntelligenceWorkflow, ProductFilm } from '../components/landing/IntelligenceWorkflow';
import './landing.css';

const faqs = [
  ['What exactly does Case Lense do?', 'It turns Intercom and email conversations into structured case intelligence: employee identity, relevant history, store context, and suggested stakeholders. An auditable snapshot keeps the evidence together for the reviewer.'],
  ['Does it replace our existing inbox?', 'Intercom remains the operator workspace. Case Lense adds context alongside the conversation, so your team can review cases without carrying information between disconnected tools.'],
  ['What happens when the AI is uncertain?', 'Identity matching preserves its evidence, and uncertain cases can be flagged for manual review. AI helps interpret the conversation; deterministic matching and review rules keep people in control.'],
  ['Can I explore it without connecting company data?', 'Yes. The reviewer walkthrough uses synthetic records in a read-only workspace. You can inspect case intelligence, directory context, operations, and fixture evaluations without providing real employee data.'],
  ['How do I explore this for my organization?', 'Request a product demo to discuss your organization’s workflow, or request reviewer access to inspect the project. Evaluation begins with synthetic records. Intercom invitations and workspace linkage are approved separately.']
];

export default function LandingPage() {
  return (
    <LandingMotion>
      <div className="ai-landing">
        <a href="#main-content" className="ai-skip-link">Skip to content</a>
        <LandingNav immersive />
        <main id="main-content">
          <section className="ai-hero" aria-labelledby="hero-title">
            <div className="hero-ambient" aria-hidden="true" />
            <div className="hero-copy">
              <p className="hero-announcement"><span className="status-light" /> AI-POWERED HR CASE INTELLIGENCE FOR INTERCOM <span aria-hidden="true">↗</span></p>
              <h1 id="hero-title">HR conversations.<br /><span>Clearer decisions.</span></h1>
              <p className="hero-description"><strong>AI-powered case intelligence for HR teams using Intercom and email.</strong><br className="desktop-break" /> Classify conversations, match employees, connect history, and suggest stakeholders.</p>
              <div className="hero-actions"><Link className="ai-button ai-button-primary" href="/access?intent=customer">Request a product demo <ArrowIcon /></Link><Link className="ai-button ai-button-ghost" href="/login?mode=demo"><span className="mini-play" aria-hidden="true">▷</span> Explore the product</Link></div>
              <p className="hero-footnote">For HR teams, store leaders, and operations. AI assists. Your team decides.</p>
            </div>
            <HeroVisual />
            <div className="hero-foundation"><span>AN INTELLIGENCE LAYER.<br /><strong>RIGHT WHERE YOU WORK.</strong></span><div><span className="integration-name"><SignalIcon type="message" /> Intercom</span><span className="integration-plus">+</span><span className="integration-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 6 9 7 9-7" /></svg> Email</span><span className="integration-plus">→</span><span className="integration-name integration-result"><IntelligenceMark /> Connected intelligence</span></div><a href="#ai-intelligence" className="discover-link">Discover the difference <span aria-hidden="true">↓</span></a></div>
          </section>

          <section id="product" className="ai-product-evidence ai-section" aria-labelledby="product-evidence-title">
            <p className="ai-eyebrow"><span /> THIS IS CASE LENSE</p>
            <div className="section-heading-row"><h2 id="product-evidence-title">Your conversations.<br /><span>The missing context, connected.</span></h2><p>An AI layer for HR casework, right inside your existing inbox. Explore actual product screens to see what your team receives.</p></div>
            <ProductEvidence />
          </section>

          <section id="ai-intelligence" className="ai-capabilities ai-section">
            <div className="section-heading"><p className="ai-eyebrow"><span /> 01 / THE BIGGER PICTURE</p><div className="section-heading-row"><h2>Find the person.<br /><span>Understand the case.</span></h2><p>Fragmented conversations make simple questions hard. Bring every signal into focus, so your team can move forward with context.</p></div></div>
            <div className="capability-grid">
              <article className="capability-card capability-identity"><div className="capability-top"><span className="capability-icon"><SignalIcon type="person" /></span><span>01 / IDENTITY</span><ArrowIcon diagonal /></div><div className="identity-graphic" aria-label="Name variants Jordan, J. Hale, and Jordan Hale connected to one directory identity"><span className="name-chip chip-one">Jordan</span><span className="name-chip chip-two">J. Hale</span><span className="name-chip chip-three">Jordan Hale</span><div className="identity-beam" /><span className="identity-target"><span>JH</span><i>✓</i></span><span className="identity-caption">ONE DIRECTORY IDENTITY</span></div><h3>The person behind<br />every mention.</h3><p>Connect incomplete names, aliases, and spelling variants to directory records, with match evidence you can inspect.</p></article>
              <article className="capability-card capability-history"><div className="capability-top"><span className="capability-icon"><SignalIcon type="history" /></span><span>02 / CONTEXT</span><ArrowIcon diagonal /></div><div className="history-graphic" aria-hidden="true"><div><span className="history-node" /><span>Prior conversation</span><i>CONNECTED</i></div><div><span className="history-node" /><span>Coaching history</span><i>RELATED</i></div><div className="history-current"><span className="history-node" /><span>The case in front of you</span><SignalIcon type="spark" /></div></div><h3>A conversation.<br />With its whole history.</h3><p>Surface related cases and understand why they matter, with employee, category, and time-window evidence.</p></article>
              <article className="capability-card capability-routing"><div className="capability-top"><span className="capability-icon"><SignalIcon type="route" /></span><span>03 / DIRECTION</span><ArrowIcon diagonal /></div><div className="routing-graphic" aria-hidden="true"><span className="route-center"><IntelligenceMark /></span><span className="route-person route-person-one">HR<small>HR TEAM</small></span><span className="route-person route-person-two">SP<small>MANAGER</small></span><span className="route-person route-person-three"><SignalIcon type="shield" /><small>REVIEWER</small></span><svg viewBox="0 0 300 160"><path d="M150 80 65 37M150 80l90-43M150 80v62" /></svg></div><h3>The right context.<br />The right people.</h3><p>Suggest stakeholders using store and directory context. Keep the human reviewer at the center of every next step.</p></article>
            </div>
            <div id="impact" className="capability-note"><span><SignalIcon type="spark" /> AI makes the connections.</span><span><SignalIcon type="shield" /> Your team makes the decisions.</span></div>
          </section>

          <section id="workflow" className="ai-workflow ai-section">
            <div className="section-heading"><p className="ai-eyebrow"><span /> 02 / FROM MESSAGE TO MEANING</p><div className="section-heading-row"><h2>One conversation.<br /><span>A clearer way forward.</span></h2><p>Intelligence that fits your workflow.<br />Follow a case from its first message to an informed human review.</p></div></div>
            <IntelligenceWorkflow />
          </section>

          <section id="live-demo" className="ai-demo ai-section">
            <div className="demo-section-heading"><div><p className="ai-eyebrow"><span /> 03 / THE PRODUCT, IN PRACTICE</p><h2>Real workflow.<br /><span>Visible intelligence.</span></h2></div><Link href="/login?mode=demo" className="ai-button ai-button-outline">Explore the read-only product demo <ArrowIcon diagonal /></Link></div>
            <ProductFilm />
            <div className="film-bottom"><span><span className="status-light" /> Synthetic records. Real product behavior.</span><Link href="/access?intent=customer">Explore it for your organization <ArrowIcon diagonal /></Link></div>
          </section>

          <section id="architecture" className="ai-trust ai-section">
            <div className="trust-intro"><p className="ai-eyebrow"><span /> 04 / INTELLIGENCE WITH ACCOUNTABILITY</p><h2>Advanced AI.<br /><span>Grounded in trust.</span></h2><p>Good intelligence should explain itself. Follow the evidence, inspect the architecture, and see where the human stays in control.</p><Link href="/engineering" className="ai-text-link">Explore the engineering <ArrowIcon diagonal /></Link></div>
            <div className="trust-details"><article><span className="trust-icon"><SignalIcon type="shield" /></span><div><h3>Human authority, built in.</h3><p>Evidence stays visible. Uncertain identity matches are surfaced for review, with role-based access around the workspace.</p></div></article><article><span className="trust-icon"><SignalIcon type="history" /></span><div><h3>Every case leaves a trail.</h3><p>Recorded case summaries keep employee matches, related history, and processing status available for review. Recoverable work stays visible when processing is interrupted.</p></div></article><article><span className="trust-icon"><SignalIcon type="spark" /></span><div><h3>Quality you can examine.</h3><p>Inspect reproducible evaluations for case classification, identity matching, and related history. Test results are kept separate from live AI behavior.</p><Link href="/evaluation">Explore AI quality <ArrowIcon diagonal /></Link></div></article></div>
            <div className="architecture-flow"><span className="architecture-label">BEHIND THE INTELLIGENCE</span><div><span>Conversation<small>Intercom / Email</small></span><ArrowIcon /><span>Durable intake<small>PostgreSQL + outbox</small></span><ArrowIcon /><span className="architecture-active"><IntelligenceMark /> AI processing<small>On-demand Apify Actor</small></span><ArrowIcon /><span>Human review<small>Evidence + context</small></span></div></div>
          </section>

          <section id="reviewers" className="ai-audience-paths ai-section" aria-label="Find your next step">
            <article className="customer-path"><p className="ai-eyebrow"><span /> FOR YOUR ORGANIZATION</p><h2>Bring context to<br /><span>your HR workflow.</span></h2><p>Handling employee questions, attendance cases, or store-level escalations? Tell us how your team works and explore where Case Lense can help.</p><Link href="/access?intent=customer" className="ai-button ai-button-primary">Request a product demo <ArrowIcon /></Link></article>
            <article className="reviewer-path"><p className="ai-eyebrow">FOR RECRUITERS & PROJECT REVIEWERS</p><SignalIcon type="spark" /><h3>Explore the product.<br />Inspect the engineering.</h3><p>Review the implementation, architecture, reliability patterns, and AI evaluation. Start with a read-only demo using synthetic records.</p><Link href="/login?mode=demo" className="ai-text-link">Explore reviewer walkthrough <ArrowIcon diagonal /></Link><Link href="/engineering" className="reviewer-engineering-link">Read the engineering case study ↗</Link></article>
          </section>

          <section id="faq" className="ai-faq ai-section"><div><p className="ai-eyebrow"><span /> GOOD QUESTIONS</p><h2>A little more<br /><span>clarity.</span></h2><p>Curious about the details?<br />Here’s where to start.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

          <section className="ai-final-cta"><div className="cta-orbit" aria-hidden="true" /><p className="ai-eyebrow">THE NEXT CHAPTER OF HR WORK</p><h2>A bigger picture.<br /><span>A better place to start.</span></h2><p>Give your HR team employee context, connected history, and a clearer next step.</p><Link href="/access?intent=customer" className="ai-button ai-button-primary">Explore it for your team <ArrowIcon /></Link><span className="cta-footnote">Personal demo request · Start with synthetic records · Human-reviewed access</span></section>
        </main>
        <footer className="ai-footer"><div className="footer-top"><div><Link href="/" className="ai-brand"><IntelligenceMark /><span>Case <span>Lense</span><sup>AI</sup></span></Link><p>Human context. Superhuman clarity.</p></div><nav aria-label="Footer product"><span>EXPLORE</span><Link href="#ai-intelligence">The intelligence</Link><Link href="#workflow">How it works</Link><Link href="#live-demo">Product walkthrough</Link></nav><nav aria-label="Footer resources"><span>GO DEEPER</span><Link href="/engineering">Engineering</Link><Link href="/architecture">Architecture</Link><Link href="#faq">Common questions</Link></nav><nav aria-label="Footer access"><span>YOUR NEXT STEP</span><Link href="/login">Sign in <ArrowIcon diagonal /></Link><Link href="/access?intent=customer">Request a product demo <ArrowIcon diagonal /></Link><Link href="/access?intent=reviewer">Reviewer access <ArrowIcon diagonal /></Link></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Case Lense</span><span>AI-assisted. Evidence-led. Human-reviewed.</span><a href="#main-content">Back to top ↑</a></div></footer>
      </div>
    </LandingMotion>
  );
}
