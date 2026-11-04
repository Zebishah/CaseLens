import Image from 'next/image';
import Link from 'next/link';
import { ArrowIcon, SignalIcon } from '../landing/LandingIcons';

export function WorkspaceLaunchpad() {
  return (
    <section className="workspace-launchpad" aria-labelledby="workspace-start-title">
      <div className="workspace-start-copy"><p className="dashboard-section-label">YOUR NEXT STEP</p><h2 id="workspace-start-title">Start with a case.<br /><span>Keep the full context.</span></h2><p>Explore employee matches, connected history, and suggested stakeholders in one place.</p></div>
      <nav className="workspace-quick-actions" aria-label="Workspace quick actions">
        <Link href="/cases"><SignalIcon type="message" /><span><strong>Review HR cases</strong><small>Identity, history & next steps</small></span><ArrowIcon diagonal /></Link>
        <Link href="/directory"><SignalIcon type="person" /><span><strong>Explore your directory</strong><small>People, stores & stakeholders</small></span><ArrowIcon diagonal /></Link>
      </nav>
      <Link href="/demo" className="workspace-preview"><Image src="/product-screenshots/sarah-identity-resolution.webp" alt="Synthetic HR case with employee identity and related conversation evidence in Intercom" width={600} height={380} sizes="(max-width: 650px) 85vw, 260px" /><span>See a complete case <ArrowIcon diagonal /></span></Link>
    </section>
  );
}
