'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AuthShell } from '../../components/AuthShell';
import { api } from '../../lib/api';

export default function VerifyEmailPage() {
  const initialized = useRef(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'ready' | 'verifying' | 'verified'>('ready');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const value = new URLSearchParams(window.location.search).get('token') ?? '';
    // Remove the secret from the address bar and browser history before other navigation.
    window.history.replaceState({}, '', '/verify-email');
    if (!/^[a-f0-9]{64}$/.test(value)) setError('This verification link is incomplete or invalid. Request another from sign in.');
    else setToken(value);
  }, []);

  const verify = async () => {
    setStatus('verifying'); setError(null);
    try { await api.verifyEmail(token); setStatus('verified'); setToken(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to verify your email.'); setStatus('ready'); }
  };

  return <AuthShell mode="recovery"><section className="auth-form-card">
    <p className="product-eyebrow">EMAIL VERIFICATION</p>
    <h1>{status === 'verified' ? 'Email verified.' : 'Verify your email.'}</h1>
    <p className="auth-form-intro">{status === 'verified' ? 'Your email address is verified. Sign in to open your workspace.' : 'Confirm your email address to enable workspace sign in.'}</p>
    {error ? <div className="auth-error" role="alert">{error}</div> : null}
    {token && status !== 'verified' ? <button type="button" disabled={status === 'verifying'} onClick={() => void verify()} className="product-primary-button">{status === 'verifying' ? 'Verifying…' : 'Verify email address'}</button> : null}
    <Link href="/login" className="auth-back-link mt-5">Return to sign in</Link>
  </section></AuthShell>;
}
