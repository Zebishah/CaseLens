'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';

export default function SetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [name, setName] = useState('reviewer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const inviteToken = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(inviteToken);
    if (!inviteToken) {
      setError('This setup link is missing its invitation token.');
      setLoading(false);
      return;
    }
    api.inspectInvite(inviteToken)
      .then((invite) => { setName(invite.name); setEmail(invite.email); setInviteValid(true); })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'This setup link is invalid or expired.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.acceptInvite(token, password);
      router.replace('/overview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The password could not be saved. Request a new invite if the link expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return <AuthShell mode="recovery">
    <section className="auth-form-card">
      <Link href="/login" className="text-sm font-medium text-primary hover:text-primary-hover">← Back to sign in</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Approved reviewer access</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Create your password</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Creating your password also verifies the invited email address. Your invitation gives you read-only access to HR case intelligence: employee matches, related history, and routing context. This evaluation workspace uses synthetic records.</p>
      {loading ? <div className="mt-7 rounded-xl bg-paper px-4 py-4 text-sm text-muted" role="status">Verifying your invitation…</div> : null}
      {error ? <div className="mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-700" role="alert">{error}</div> : null}
      {!loading && inviteValid ? <form className="mt-7 space-y-5" onSubmit={submit}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3"><p className="text-sm font-semibold text-emerald-950">{name}</p><p className="mt-1 text-xs text-emerald-900/70">{email}</p></div>
        <label className="block text-sm font-medium text-slate-700">New password<input required minLength={12} maxLength={72} type="password" autoComplete="new-password" className="dash-field mt-2" value={password} onChange={(event) => setPassword(event.target.value)} /><span className="mt-1.5 block text-xs font-normal text-muted">Use at least 12 characters.</span></label>
        <label className="block text-sm font-medium text-slate-700">Confirm password<input required minLength={12} maxLength={72} type="password" autoComplete="new-password" className="dash-field mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button type="submit" disabled={submitting} className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Securing your account…' : 'Create password and enter workspace'}</button>
      </form> : null}
      <p className="mt-6 text-xs leading-5 text-muted">This link can be used once and expires automatically. If it no longer works, ask the administrator to send a new invitation.</p>
    </section>
  </AuthShell>;
}
