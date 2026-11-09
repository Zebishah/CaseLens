'use client';

import Link from 'next/link';
import { AuthActionSpinner } from '../../components/AuthActionSpinner';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthShell } from '../../components/AuthShell';
import { api } from '../../lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setToken(fragment.get('token') ?? '');
    // Never keep recovery secrets in the visible address or browser history.
    window.history.replaceState({}, '', '/reset-password');
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.confirmPasswordReset(token, password);
      setComplete(true);
      setToken('');
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset your password.');
    } finally { setSubmitting(false); }
  };

  return <AuthShell mode="recovery"><div className="auth-form-card">
    <p className="product-eyebrow">SECURE ACCOUNT RECOVERY</p>
    <h1>{complete ? 'Password updated.' : 'Create a new password.'}</h1>
    {complete ? <>
      <p className="auth-form-intro">Your password has been changed and previous sessions have been signed out.</p>
      <Link href="/login" className="product-primary-button">Return to sign in</Link>
    </> : <>
      <p className="auth-form-intro">Choose a new password. The reset link is valid for 30 minutes and can be used only once.</p>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {!/^[a-f0-9]{64}$/.test(token) ? <div className="auth-notice" role="status">This reset link is missing or invalid. Request a new one.</div> : (
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>New password
            <input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>Confirm new password
            <input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button className="product-primary-button" type="submit" disabled={submitting}>
            {submitting ? <><AuthActionSpinner label="Updating password" /> Updating password…</> : 'Reset password'}
          </button>
        </form>
      )}
      <Link href="/forgot-password" className="auth-back-link mt-5">Request a new reset link</Link>
    </>}
  </div></AuthShell>;
}
