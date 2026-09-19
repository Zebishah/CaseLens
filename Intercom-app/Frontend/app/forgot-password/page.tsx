'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="theme-light flex min-h-screen items-center justify-center bg-paper px-5 py-16 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-primary/10 bg-white p-6 shadow-lift sm:p-8">
        <Link href="/login" className="text-sm font-medium text-primary hover:text-primary-hover">← Back to sign in</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Account recovery</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Forgot your password?</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Enter your account email. Recovery is invite-controlled so sensitive HR workspace access cannot be self-granted.</p>
        {submitted ? (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900" role="status">If an account exists, the recovery request is now handled through the approved invite-controlled process.</div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
            <label className="block text-sm font-medium text-slate-700">Email address<input required type="email" autoComplete="email" className="dash-field mt-2 h-11" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <button type="submit" className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold">Request recovery review</button>
          </form>
        )}
        <p className="mt-6 text-xs leading-5 text-muted">No public signup is available. Need access instead? <Link href="/access" className="font-semibold text-primary hover:text-primary-hover">Request an invitation.</Link></p>
      </section>
    </main>
  );
}
