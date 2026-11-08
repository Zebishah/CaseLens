'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';
import { ArrowIcon, SignalIcon } from '../../components/landing/LandingIcons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendWait, setResendWait] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    const launchDemo = new URLSearchParams(window.location.search).get('mode') === 'demo';
    if (reason === 'session-expired') {
      setNotice('Your access session ended. Sign in again to continue.');
    } else if (reason === 'password-changed') {
      setNotice('Your password was changed and all previous sessions ended. Sign in with your new password.');
    } else if (reason === 'signed-out') {
      setNotice('You have been signed out securely.');
    }

    void (launchDemo
      ? api.enterDemo().then(() => { router.replace('/overview'); })
      : api.restoreSession().then((session) => {
          if (session) {
            router.replace('/overview');
          }
        }))
      .catch((err: unknown) => {
        if (launchDemo) setError(err instanceof ApiError && err.sleeping ? 'The demo service is starting. Please try again in a moment.' : 'The reviewer walkthrough is temporarily unavailable. Please try again shortly.');
      })
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (!resendAvailableAt) return;
    const remaining = Math.max(0, resendAvailableAt - Date.now());
    setResendWait(remaining > 0);
    const timeout = window.setTimeout(() => setResendWait(false), remaining);
    return () => window.clearTimeout(timeout);
  }, [resendAvailableAt]);

  const resendVerification = async () => {
    setError(null);
    setResending(true);
    try {
      const result = await api.resendVerification(email.trim(), password);
      setNotice(result.message);
      setResendAvailableAt(Date.now() + 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally { setResending(false); }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    setNeedsVerification(false);
    try {
      await api.login(email.trim(), password);
      router.replace('/overview');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setNeedsVerification(true);
        setError('Your email address needs verification. Send a six-digit code to finish signing in.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('The email or password is incorrect.');
      } else if (err instanceof ApiError && err.sleeping) {
        setError('The service is starting. Please try again in a moment.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setVerifyingCode(true);
    try {
      await api.verifyEmailCode(email.trim(), password, verificationCode);
      setNeedsVerification(false);
      setVerificationCode('');
      await api.login(email.trim(), password);
      router.replace('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify your code.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const enterDemo = async () => {
    setError(null);
    setNotice(null);
    setDemoLoading(true);
    try {
      await api.enterDemo();
      router.replace('/overview');
    } catch (err) {
      setError(err instanceof ApiError && err.sleeping ? 'The demo service is starting. Please try again in a moment.' : 'The reviewer walkthrough is temporarily unavailable. Please try again shortly.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-form-card">
        <p className="product-eyebrow">YOUR CASE LENSE WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="auth-form-intro">Sign in to review HR cases, understand employee context, and bring the right people into the conversation.</p>
        {checking ? <div className="auth-notice" role="status">Checking your existing session…</div> : null}
        {notice && !checking ? <div className="auth-notice" role="status">{notice}</div> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label>Email address<input required type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => { setEmail(event.target.value); setNeedsVerification(false); setVerificationCode(''); }} /></label>
          <label>Password<span className="auth-password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
          <div className="auth-form-links"><span><SignalIcon type="shield" /> Protected workspace</span><Link href="/forgot-password">Forgot password?</Link></div>
          <button type="submit" disabled={loading || checking} className="product-primary-button">{loading ? 'Signing in…' : 'Sign in to workspace'}<ArrowIcon /></button>
        </form>
        {needsVerification ? <div className="auth-notice" aria-label="Email verification">
          <h2 className="font-semibold text-slate-900">Verify your email</h2>
          <p className="mt-2 text-sm">We&apos;ll send a six-digit code to {email.trim()}. Enter it here to finish signing in.</p>
          <button type="button" className="product-secondary-button mt-3" disabled={resending || resendWait || !email || !password} onClick={() => void resendVerification()}>
            {resending ? 'Sending code…' : resendWait ? 'Resend available in one minute' : 'Send verification code'}
          </button>
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
            <label className="block text-sm font-medium">Six-digit code
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-xl tracking-[0.3em]" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            </label>
            <button type="submit" className="product-primary-button mt-3" disabled={verifyingCode || verificationCode.length !== 6}>
              {verifyingCode ? 'Verifying…' : 'Verify and sign in'}<ArrowIcon />
            </button>
          </form>
          <p className="mt-2 text-xs">Codes expire after 10 minutes and allow up to five attempts.</p>
        </div> : null}
        <div className="auth-demo-option"><span className="auth-option-icon"><SignalIcon type="spark" /></span><div><h2>See what Case Lense can do.</h2><p>Evaluating it for your team or reviewing the project? Explore real product behavior using synthetic cases.</p></div><button type="button" disabled={demoLoading || checking} onClick={() => void enterDemo()} className="product-secondary-button">{demoLoading ? 'Opening secure demo…' : 'Enter read-only demo'}<ArrowIcon /></button></div>
        <div className="auth-sales-link"><p>Bringing this to your organization?</p><Link href="/access?intent=customer">Request a product demo <ArrowIcon diagonal /></Link></div>
        <p className="auth-fine-print">Workspace accounts are invitation-based. Product demos use synthetic records; Intercom access is approved separately.</p>
      </div>
    </AuthShell>
  );
}
