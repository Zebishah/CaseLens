'use client';

import Link from 'next/link';
import { AuthActionSpinner } from '../../components/AuthActionSpinner';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthShell } from '../../components/AuthShell';
import { api } from '../../lib/api';
import { ArrowIcon } from '../../components/landing/LandingIcons';

export default function VerifyEmailPage() {
  const initialized = useRef(false);
  const [email, setEmail] = useState('');
  const [legacyToken, setLegacyToken] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [status, setStatus] = useState<'ready' | 'verifying' | 'verified'>('ready');
  const [submitting, setSubmitting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const query = new URLSearchParams(window.location.search);
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? query.get('token') ?? '';
    const address = query.get('email') ?? '';
    const sent = query.get('sent') === '1';
    setEmail(address);
    if (/^[a-f0-9]{64}$/.test(token)) setLegacyToken(token);
    if (sent) {
      setNotice('A six-digit code has been requested. Check your inbox and spam folder.');
      setCooldownUntil(Date.now() + 60_000);
    }
    // Remove single-use link secrets and one-time navigation parameters from browser history.
    window.history.replaceState({}, '', '/verify-email');
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || status === 'verified' || (legacyToken ? false : !/^[0-9]{6}$/.test(code))) return;
    setSubmitting(true);
    setError('');
    setStatus('verifying');
    try {
      if (legacyToken) await api.verifyEmail(legacyToken);
      else await api.verifyEmailCode(email, code);
      setStatus('verified');
      setCode('');
      setLegacyToken('');
      setPassword('');
    } catch (cause) {
      setStatus('ready');
      setError(cause instanceof Error ? cause.message : 'The code is invalid or expired. Please try again.');
    } finally { setSubmitting(false); }
  };

  const resend = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || remaining > 0) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const result = await api.resendVerification(email, password);
      setNotice(result.message);
      setPassword('');
      setShowResend(false);
      setCooldownUntil(Date.now() + 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a new code.');
    } finally { setSubmitting(false); }
  };

  return <AuthShell mode="recovery"><section className="auth-form-card">
    <p className="product-eyebrow">SECURE EMAIL VERIFICATION · STEP 2 OF 2</p>
    <h1>{status === 'verified' ? 'Email verified.' : 'Check your inbox.'}</h1>
    <p className="auth-form-intro">{status === 'verified'
      ? 'Your email address is verified. You can now sign in to CaseLens.'
      : legacyToken ? 'Confirm your email address using the one-time verification link.'
      : 'Enter the six-digit verification code sent to your email. Codes expire after 10 minutes and allow five attempts.'}</p>
    {email && <p className="auth-notice" role="status">Verification for <strong>{email}</strong></p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    {status === 'verified'
      ? <Link href="/login" className="product-primary-button">Continue to sign in <ArrowIcon /></Link>
      : <form className="auth-form" onSubmit={(event) => void confirm(event)}>
          {!legacyToken && <label>Six-digit verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
              maxLength={6} required className="text-center text-xl tracking-[0.35em]"
              placeholder="000000" value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>}
          {!legacyToken && !email && <label>Email address
            <input type="email" required maxLength={255} autoComplete="email"
              value={email} onChange={event => setEmail(event.target.value.trim())} />
          </label>}
          <button type="submit" className="product-primary-button"
            disabled={submitting || (!legacyToken && (!/^[0-9]{6}$/.test(code) || !email))}>
            {status === 'verifying' ? <><AuthActionSpinner label="Verifying email" /> Verifying…</> : <>{legacyToken ? 'Confirm email address' : 'Verify email'} <ArrowIcon /></>}
          </button>
        </form>}
    {!legacyToken && status !== 'verified' && <div className="mt-6">
      {showResend ? <form onSubmit={(event) => void resend(event)} className="auth-form">
        <p className="auth-form-intro">Confirm your account password to request another code. Your password is not saved on this page.</p>
        <label>Email address<input type="email" required autoComplete="email" value={email}
          onChange={event => setEmail(event.target.value.trim())} /></label>
        <label>Account password<input type="password" required autoComplete="current-password"
          value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button type="submit" className="product-secondary-button" disabled={submitting || remaining > 0}>
          {submitting ? <><AuthActionSpinner label="Sending code" /> Sending…</> : remaining ? `Resend available in ${remaining}s` : 'Send another code'}
        </button>
      </form> : <button type="button" className="product-secondary-button"
        disabled={remaining > 0} onClick={() => setShowResend(true)}>
        {remaining ? `Resend available in ${remaining}s` : 'Did not receive a code? Resend'}
      </button>}
    </div>}
    <Link href="/login" className="auth-back-link mt-5">← Back to sign in</Link>
  </section></AuthShell>;
}
