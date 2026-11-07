import Link from 'next/link';
import { AuthShell } from '../../components/AuthShell';
import { ArrowIcon, SignalIcon } from '../../components/landing/LandingIcons';

export default function ForgotPasswordPage() {
  return (
    <AuthShell mode="recovery">
      <div className="auth-form-card">
        <Link href="/login" className="auth-back-link">← Back to sign in</Link>
        <p className="product-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Let’s get you back in.</h1>
        <p className="auth-form-intro">Case Lens uses invitation-based accounts. Your workspace administrator can send a fresh password setup link to your approved email address.</p>
        <ol className="auth-recovery-steps">
          <li><span>01</span><div><strong>Contact your workspace administrator.</strong><p>Use your organization’s existing support channel and provide the email on your account.</p></div></li>
          <li><span>02</span><div><strong>Open your fresh invitation.</strong><p>Create a password using the one-time setup link. Your existing access role remains controlled by your administrator.</p></div></li>
        </ol>
        <div className="auth-notice"><SignalIcon type="shield" /> Password recovery is managed by your workspace administrator. This page does not send a reset email.</div>
        <Link href="/login" className="product-primary-button">Return to sign in <ArrowIcon /></Link>
        <div className="auth-sales-link"><p>Here to evaluate the product?</p><Link href="/login?mode=demo">Explore the read-only demo <ArrowIcon diagonal /></Link></div>
      </div>
    </AuthShell>
  );
}
