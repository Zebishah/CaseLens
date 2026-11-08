'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthShell } from '../../components/AuthShell';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || cooldown) return;
    setSubmitting(true);
    setError('');
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a reset link. Try again.');
    } finally { setSubmitting(false); }
  };

  return <AuthShell mode="recovery"><div className="auth-form-card">
    <Link href="/login" className="auth-back-link">← Back to sign in</Link>
    <p className="product-eyebrow">ACCOUNT RECOVERY</p>
    <h1>{sent ? 'Check your inbox.' : 'Forgot your password?'}</h1>
    <p className="auth-form-intro">{sent
      ? 'If that email belongs to an eligible workspace account, a reset link is on its way. Check spam too. The link expires in 30 minutes.'
      : 'Enter your workspace email address. We will send a secure, one-time reset link if an eligible account exists.'}</p>
    {error ? <div className="auth-error" role="alert">{error}</div> : null}
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label>Email address
        <input type="email" required autoComplete="email" maxLength={255} value={email}
          onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
      </label>
      <button type="submit" disabled={submitting || cooldown} className="product-primary-button">
        {submitting ? 'Sending…' : cooldown ? 'You can request another link in one minute' : sent ? 'Resend reset link' : 'Send reset link'}
      </button>
    </form>
    <p className="auth-fine-print">For invited users and administrators. If you registered using a different sign-in provider, contact your workspace administrator.</p>
  </div></AuthShell>;
}
