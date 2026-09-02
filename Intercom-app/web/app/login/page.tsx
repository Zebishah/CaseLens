'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProductPreview } from '../../components/landing/ProductPreview';
import { ApiError, api } from '../../lib/api';
import { setAdminToken } from '../../lib/auth-token';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{
        token: string;
        user?: { name?: string; email?: string };
      }>('/api/auth/login', { email, password });
      if (!result.token) {
        throw new Error('Sign in did not return a session');
      }
      setAdminToken(result.token, result.user ? { name: result.user.name, email: result.user.email } : undefined);
      router.push('/overview');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid credentials');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-light landing-canvas min-h-screen bg-paper text-foreground">
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to sign in
      </a>
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <section className="relative hidden overflow-hidden bg-mist px-10 py-12 lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute -left-16 top-[-5rem] h-72 w-72 rounded-full bg-white"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-10 bottom-[-4rem] h-64 w-64 rounded-full bg-primary/15"
            aria-hidden="true"
          />
          <Link href="/" className="relative text-sm font-semibold text-primary">
            HR Intelligence
          </Link>
          <div className="relative mt-16 max-w-xl">
            <p className="text-sm font-medium tracking-[0.18em] text-secondary">Administrator access</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-primary">Welcome back.</h1>
            <p className="mt-4 text-muted">
              Access case intelligence, operations, evaluation, and system workflows. This is the
              operator application, not a scripted demo walkthrough.
            </p>
          </div>
          <div className="relative mt-auto max-w-xl pb-6">
            <ProductPreview compact />
          </div>
        </section>
        <section className="flex flex-col justify-center px-4 py-10 sm:px-8">
          <div className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 shadow-lift sm:p-8">
            <Link href="/" className="mb-8 inline-block text-sm font-medium text-primary lg:hidden">
              HR Intelligence
            </Link>
            <h2 id="login-form" className="text-2xl font-bold text-primary">
              Sign in
            </h2>
            <p className="mt-2 text-sm text-muted">
              Administrator access uses a Bearer JWT. Public registration is disabled.
            </p>
            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {error ? (
                <p className="rounded-2xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <label className="block text-sm text-primary">
                Email
                <input
                  required
                  type="email"
                  autoComplete="username"
                  className="mt-1 w-full rounded-2xl border border-primary/15 bg-paper px-3 py-2.5 text-foreground focus:border-secondary"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="block text-sm text-primary">
                Password
                <span className="mt-1 flex rounded-2xl border border-primary/15 bg-paper focus-within:border-secondary">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full bg-transparent px-3 py-2.5 text-foreground focus:outline-none"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="px-3 text-xs text-muted"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted">
              Use the operator account you were given. Public registration is disabled.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
