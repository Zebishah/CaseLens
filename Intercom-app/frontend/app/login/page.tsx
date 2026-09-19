'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';

const capabilities = [
  ['Case intelligence', 'Classifies HR reports and resolves employee identity.'],
  ['Connected history', 'Surfaces related cases with transparent matching evidence.'],
  ['Reliable ingestion', 'Tracks webhooks, processing state, retries, and failures.']
];

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
    } else if (reason === 'signed-out') {
      setNotice('You have been signed out securely.');
    }

    const sessionCheck = (launchDemo
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
      if (err instanceof ApiError && err.status === 401) {
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
    <div className="theme-light min-h-screen bg-slate-950 text-slate-900">
      <a href="#login-form" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900">
        Skip to sign in
      </a>
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
        <section className="relative hidden overflow-hidden px-12 py-12 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 login-grid opacity-70" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-slate-950">HI</span>
            <div>
              <p className="text-sm font-semibold">HR Intelligence</p>
              <p className="text-xs text-slate-400">Case operations platform</p>
            </div>
          </div>

          <div className="relative my-auto max-w-xl py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Protected HR Intelligence workspace</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Turn every HR conversation into actionable case intelligence.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Review employee matches, related history, stakeholder routing, and processing health from one protected workspace. Reviewer accounts are read-only.
            </p>
            <div className="mt-10 space-y-5">
              {capabilities.map(([title, copy], index) => (
                <div key={title} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/10 text-xs font-semibold text-emerald-300">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs text-slate-500">Synthetic reviewer data only · Role-based access</p>
        </section>

        <section className="relative flex min-h-screen items-center justify-center bg-slate-50 px-5 py-16 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-5 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Secure workspace access</span>
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                <span aria-hidden="true">←</span>
                Back to landing page
              </Link>
            </div>
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">HI</span>
              <span className="text-sm font-semibold text-slate-900">HR Intelligence</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Secure access</p>
              <h2 id="login-form" className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in with your issued workspace account. This account is separate from an approved
                Intercom teammate invitation.
              </p>

              {checking ? (
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Checking your existing session…
                </div>
              ) : null}
              {notice && !checking ? (
                <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">{notice}</div>
              ) : null}
              {error ? (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
              ) : null}

              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Read-only reviewer walkthrough</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-900/70">
                      Enter a short-lived, server-issued read-only session for sanitized cases, directory evidence, and architecture.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                    Viewer
                  </span>
                </div>
                <button
                  type="button"
                  disabled={demoLoading || checking}
                  className="mt-3 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void enterDemo()}
                >
                  {demoLoading ? 'Opening secure demo…' : 'Enter read-only demo'}
                </button>
              </div>

              <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input required type="email" autoComplete="username" autoFocus className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" placeholder="operator@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                  <span className="mt-2 flex rounded-lg border border-slate-300 bg-white shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                    <input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3.5 py-3 text-slate-900 focus:outline-none" value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button type="button" className="px-3.5 text-xs font-medium text-slate-500 hover:text-slate-900" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>
                <button type="submit" disabled={loading || checking} className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Signing in…' : 'Sign in to workspace'}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></svg>
                  <span>Demo sessions expire automatically. Accounts are invite-controlled; public registration is disabled.</span>
                </div>
                <div className="mt-4 rounded-xl bg-paper p-4">
                  <p className="text-sm font-semibold text-primary">Need reviewer access?</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Start with the public walkthrough, use the controlled demo above, or request a personal invitation using your own email.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href="/forgot-password" className="text-primary hover:text-primary-hover">Forgot password?</Link>
                    <Link href="/#live-demo" className="text-primary hover:text-primary-hover">Watch public walkthrough</Link>
                    <Link href="/access" className="text-secondary hover:text-primary">Request Intercom access →</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
