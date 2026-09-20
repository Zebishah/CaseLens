'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '../../components/AppShell';
import { ApiError, api } from '../../lib/api';

type FormState = {
  fullName: string;
  workEmail: string;
  organization: string;
  role: string;
  workspaceId: string;
  purpose: string;
  consent: boolean;
  website: string;
};

const initialForm: FormState = {
  fullName: '',
  workEmail: '',
  organization: '',
  role: '',
  workspaceId: '',
  purpose: '',
  consent: false,
  website: ''
};

export default function AccessRequestPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.restoreSession()
      .then((session) => setAuthenticated(Boolean(session)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="theme-light min-h-screen bg-paper" aria-busy="true" />;
  }

  if (authenticated) {
    return <AppShell title="Reviewer access" description="Request a personal, read-only account for the sanitized HR Intelligence workspace. Intercom access is approved separately."><AccessRequestForm embedded /></AppShell>;
  }

  return <AccessRequestForm />;
}

function AccessRequestForm({ embedded = false }: { embedded?: boolean }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [state, setState] = useState<'idle' | 'submitting' | 'complete'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    if (!embedded) return;
    api.get<AccessStatus | null>('/api/access-requests/me')
      .then(setAccessStatus)
      .catch(() => setAccessStatus(null));
  }, [embedded]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setState('submitting');
    setError(null);
    try {
      await api.post('/api/access-requests', form);
      setAccessStatus({ status: 'pending', workspaceId: form.workspaceId || null, reviewNote: null });
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
    <main className={embedded ? 'min-h-0 text-foreground' : 'theme-light min-h-screen bg-paper text-foreground'}>
      {!embedded ? <header className="mx-3 mt-3 rounded-2xl border border-primary/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">HI</span>
            <span>
              <span className="block text-sm font-semibold text-primary">HR Intelligence</span>
              <span className="block text-[11px] text-muted">Organization access</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/overview"
              className="rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm font-medium text-primary shadow-sm transition hover:border-primary/30 hover:bg-paper"
            >
              ← Back to dashboard
            </Link>
            <Link href="/" className="hidden text-sm font-medium text-primary hover:text-primary-hover sm:inline">
              Landing page
            </Link>
          </div>
        </div>
      </header> : null}

      <div className={`mx-auto grid max-w-6xl gap-8 ${embedded ? 'px-0 py-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)]' : 'px-4 py-10 md:px-6 md:py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)]'}`}>
        <section className="lg:py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Controlled workspace access</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary md:text-5xl">
            Request a personal reviewer account.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            Access is invite-only because the workspace contains sensitive case context. Approved reviewers use their
            own email to create a password and receive read-only workspace access.
          </p>

          <div className="mt-8 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-primary">What you can review immediately</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>• The public product story, architecture, screenshots, and subtitled walkthrough.</li>
              <li>• The protected read-only workspace through a short-lived, server-issued demo session.</li>
              <li>• Sanitized case intelligence, directory matching, and system-design evidence.</li>
            </ul>
          </div>

          <div className="mt-5 rounded-2xl border border-secondary/20 bg-secondary/5 p-6">
            <h2 className="text-base font-semibold text-primary">After approval</h2>
            <ol className="mt-4 space-y-4">
              {[
                'If approved, Brevo sends a secure password setup link to the email submitted here.',
                'Create your password through the one-time link; your dashboard role is read-only.',
                'Sign in to inspect sanitized cases, directory context, architecture, and reliability evidence.',
                'Intercom workspace invitations remain separate and are sent only when explicitly approved.'
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

          <div className="mt-5 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">How the connection works</p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-muted">
              {[
                'Intercom receives a conversation or event.',
                'Intercom sends the authorized event to the HR Intelligence API.',
                'The API validates the request and processes the case asynchronously.',
                'Employee, store, and related-case intelligence is persisted.',
                'Results appear in the HR Intelligence dashboard.',
                'Where configured, safe output can also be written back to Intercom.'
              ].map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-primary">{index + 1}</span><span>{step}</span></li>)}
            </ol>
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Never paste Intercom API keys or access tokens here.</strong> Reviewer users submit only a non-secret workspace identifier. Provider credentials and webhook secrets stay server-side.</p>
          </div>
        </section>

        <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-lift md:p-8">
          {state === 'complete' ? (
            <div role="status" className="flex min-h-[34rem] flex-col justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-xl text-success">✓</span>
              <h2 className="mt-5 text-2xl font-semibold text-primary">Request received</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Your request is awaiting manual review. If approved, Brevo will send a secure password setup link to
                the email you provided. Submitting this form does not create an account automatically.
              </p>
              <div className="mt-6 rounded-xl bg-paper p-4 text-sm leading-6 text-muted">
                While you wait, use the public walkthrough and screenshots. They demonstrate the same synthetic Inbox,
                Canvas intelligence, and operational health views without requiring third-party access.
              </div>
              <AccessStatusPanel status={accessStatus ?? { status: 'pending', workspaceId: form.workspaceId || null, reviewNote: null }} />
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/overview" className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  Back to dashboard
                </Link>
                <Link href="/#live-demo" className="btn-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  Watch the walkthrough
                </Link>
                <Link href="/" className="btn-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  Return to product walkthrough
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Invitation request</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-primary">Tell us who is reviewing</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Access is manually approved and limited to a synthetic, read-only HR Intelligence workspace.
              </p>

              {accessStatus ? <AccessStatusPanel status={accessStatus} /> : null}

              {error ? (
                <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                <Field label="Full name" required>
                  <input required minLength={2} maxLength={120} autoComplete="name" className="dash-field mt-2" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} />
                </Field>
                <Field label="Work email" required hint="Your secure password setup link will be sent to this exact address if approved.">
                  <input required type="email" maxLength={255} autoComplete="email" className="dash-field mt-2" value={form.workEmail} onChange={(event) => update('workEmail', event.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organization">
                    <input maxLength={160} autoComplete="organization" className="dash-field mt-2" value={form.organization} onChange={(event) => update('organization', event.target.value)} />
                  </Field>
                  <Field label="Role">
                    <input maxLength={120} autoComplete="organization-title" className="dash-field mt-2" placeholder="HR reviewer, operator…" value={form.role} onChange={(event) => update('role', event.target.value)} />
                  </Field>
                </div>
                <Field label="Intercom Workspace ID" required={embedded} hint="Use the workspace identifier shown in Intercom. This is a non-secret identifier; do not enter an API key or access token.">
                  <input required={embedded} minLength={3} maxLength={64} pattern="[A-Za-z0-9_-]{3,64}" className="dash-field mt-2" placeholder="Example: workspace_123" value={form.workspaceId} onChange={(event) => update('workspaceId', event.target.value)} />
                </Field>
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
                  {state === 'submitting' ? 'Submitting securely…' : 'Request reviewer access'}
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

type AccessStatus = {
  status: 'pending' | 'approved' | 'invited' | 'declined' | 'expired';
  workspaceId?: string | null;
  reviewNote?: string | null;
};

function AccessStatusPanel({ status }: { status: AccessStatus }) {
  const copy = status.status === 'pending'
    ? 'Your reviewer access request is waiting for approval.'
    : status.status === 'approved' || status.status === 'invited'
      ? 'Your reviewer access request is approved. The connected workspace is used only after server-side linkage is confirmed.'
      : status.status === 'declined'
        ? status.reviewNote || 'Your request needs an update. Review the admin note and resubmit if allowed.'
        : 'This request is no longer active.';
  return <div role="status" className="mt-5 rounded-xl border border-secondary/20 bg-emerald-50/70 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Request status</p><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-primary">{status.status}</span></div><p className="mt-2 text-sm leading-6 text-muted">{copy}</p>{status.workspaceId ? <p className="mt-2 text-xs text-muted">Workspace ID submitted: <span className="font-mono text-primary">{status.workspaceId}</span></p> : null}</div>;
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
