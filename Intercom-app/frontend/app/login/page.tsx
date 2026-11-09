'use client';

import Link from 'next/link';
import { AuthActionSpinner } from '../../components/AuthActionSpinner';
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

  const submit = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await api.login(email.trim(), password);
      router.replace('/overview');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_REQUIRED') {
        // Credentials have already been validated by the backend.
        // Send the OTP before opening the dedicated verification screen.
        try {
          await api.resendVerification(email.trim(), password);
          router.replace(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
        } catch (deliveryError) {
          // The verification screen also provides a safe resend option.
          router.replace(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        }
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
        <p className="product-eyebrow">YOUR CASELENS WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="auth-form-intro">Sign in to review HR cases, understand employee context, and bring the right people into the conversation.</p>
        {checking ? <div className="auth-notice" role="status">Checking your existing session…</div> : null}
        {notice && !checking ? <div className="auth-notice" role="status">{notice}</div> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label>Email address<input required type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => { setEmail(event.target.value); }} /></label>
          <label>Password<span className="auth-password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
          <div className="auth-form-links"><span><SignalIcon type="shield" /> Protected workspace</span><Link href="/forgot-password">Forgot password?</Link></div>
          <button type="submit" disabled={loading || checking} className="product-primary-button">{loading ? <><AuthActionSpinner label="Signing in" /> Signing in…</> : <>Sign in to workspace <ArrowIcon /></>}</button>
        </form>
        <div className="auth-demo-option"><span className="auth-option-icon"><SignalIcon type="spark" /></span><div><h2>See what Case Lense can do.</h2><p>Evaluating it for your team or reviewing the project? Explore real product behavior using synthetic cases.</p></div><button type="button" disabled={demoLoading || checking} onClick={() => void enterDemo()} className="product-secondary-button">{demoLoading ? <><AuthActionSpinner label="Opening demo" /> Opening secure demo…</> : <>Enter read-only demo <ArrowIcon /></>}</button></div>
        <div className="auth-sales-link"><p>Bringing this to your organization?</p><Link href="/access?intent=customer">Request a product demo <ArrowIcon diagonal /></Link></div>
        <p className="auth-fine-print">Workspace accounts are invitation-based. Product demos use synthetic records; Intercom access is approved separately.</p>
      </div>
    </AuthShell>
  );
}
