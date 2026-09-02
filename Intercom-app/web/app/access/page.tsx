'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ApiError, api } from '../../lib/api';

type FormState = {
  fullName: string;
  workEmail: string;
  organization: string;
  role: string;
  purpose: string;
  consent: boolean;
  website: string;
};

const initialForm: FormState = {
  fullName: '',
  workEmail: '',
  organization: '',
  role: '',
  purpose: '',
  consent: false,
  website: ''
};

export default function AccessRequestPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [state, setState] = useState<'idle' | 'submitting' | 'complete'>('idle');
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setState('submitting');
    setError(null);
    try {
      await api.post('/api/access-requests', form);
      setState('complete');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests were submitted from this network. Please try again later.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Please review the form fields and submit the request again.');
      } else if (err instanceof ApiError && err.sleeping) {
        setError('The invitation service is starting. Please retry in a moment.');
      } else {
        setError('The invitation service is temporarily unavailable. Please try again shortly.');
      }
      setState('idle');
    }
  };

  return (
    <main className="theme-light min-h-screen bg-paper text-foreground">
      <header className="mx-3 mt-3 rounded-2xl border border-primary/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">HI</span>
            <span>
              <span className="block text-sm font-semibold text-primary">HR Intelligence</span>
              <span className="block text-[11px] text-muted">Recruiter access</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-primary hover:text-primary-hover">
            Return to showcase
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)]">
        <section className="lg:py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Controlled workspace access</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">
            Request a personal invitation to the Intercom demo.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            Intercom protects new-device sign-ins with email verification, so shared credentials are neither reliable
            nor secure. Approved reviewers are invited using their own email address.
          </p>

          <div className="mt-8 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-primary">What you can review immediately</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>• The public product story, architecture, screenshots, and subtitled walkthrough.</li>
              <li>• The protected read-only dashboard using separately issued reviewer credentials.</li>
              <li>• Sanitized case intelligence, directory matching, and system-design evidence.</li>
            </ul>
          </div>

          <div className="mt-5 rounded-2xl border border-secondary/20 bg-secondary/5 p-6">
            <h2 className="text-base font-semibold text-primary">After approval</h2>
            <ol className="mt-4 space-y-4">
              {[
                'You receive an official Intercom invitation at the email submitted here.',
                'Accept the invitation and complete Intercom’s own identity verification.',
                'Select Nagumo Workspace [DEV], then open Inbox → All or Unassigned.',
                'Open a synthetic ticket and inspect the HR Intelligence panel on the right.'
              ].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-muted">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-lift md:p-8">
          {state === 'complete' ? (
            <div role="status" className="flex min-h-[34rem] flex-col justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-xl text-success">✓</span>
              <h2 className="mt-5 text-2xl font-semibold text-primary">Request received</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Your request is awaiting manual review. If approved, an official Intercom invitation will be sent to
                the email you provided. Submitting this form does not create an Intercom account automatically.
              </p>
              <div className="mt-6 rounded-xl bg-paper p-4 text-sm leading-6 text-muted">
                While you wait, use the public walkthrough and screenshots. They demonstrate the same synthetic Inbox,
                Canvas intelligence, and operations dashboard without requiring third-party access.
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/#live-demo" className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  Watch the walkthrough
                </Link>
                <Link href="/" className="btn-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  Return to showcase
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Invitation request</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-primary">Tell us who is reviewing</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Access is manually approved and limited to a synthetic portfolio workspace.
              </p>

              {error ? (
                <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                <Field label="Full name" required>
                  <input required minLength={2} maxLength={120} autoComplete="name" className="dash-field mt-2" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} />
                </Field>
                <Field label="Work email" required hint="The Intercom invitation will be sent to this exact address.">
                  <input required type="email" maxLength={255} autoComplete="email" className="dash-field mt-2" value={form.workEmail} onChange={(event) => update('workEmail', event.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organization">
                    <input maxLength={160} autoComplete="organization" className="dash-field mt-2" value={form.organization} onChange={(event) => update('organization', event.target.value)} />
                  </Field>
                  <Field label="Role">
                    <input maxLength={120} autoComplete="organization-title" className="dash-field mt-2" placeholder="Recruiter, Engineer…" value={form.role} onChange={(event) => update('role', event.target.value)} />
                  </Field>
                </div>
                <Field label="Reason for access" required hint="Minimum 20 characters. Do not include confidential information.">
                  <textarea required minLength={20} maxLength={800} rows={5} className="dash-field mt-2 resize-y" placeholder="I am reviewing this project for…" value={form.purpose} onChange={(event) => update('purpose', event.target.value)} />
                </Field>

                <label className="flex items-start gap-3 rounded-xl bg-paper p-4 text-sm leading-6 text-muted">
                  <input required type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 accent-primary" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} />
                  <span>I agree that these details may be stored solely to review and manage this access request.</span>
                </label>

                <div className="hidden" aria-hidden="true">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} />
                  </label>
                </div>

                <button type="submit" disabled={state === 'submitting'} className="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                  {state === 'submitting' ? 'Submitting securely…' : 'Request Intercom invitation'}
                </button>
              </form>

              <p className="mt-5 text-xs leading-5 text-muted">
                Requests are reviewed manually. Access may be declined, time-limited, or revoked. No customer or
                employer data exists in this workspace.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="ml-1 text-danger">*</span> : null}
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}
