'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '../../components/AppShell';
import { ApiError, api } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';
import { ArrowIcon, SignalIcon } from '../../components/landing/LandingIcons';

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
  const [customerIntent, setCustomerIntent] = useState(false);

  useEffect(() => {
    const customer = new URLSearchParams(window.location.search).get('intent') === 'customer';
    setCustomerIntent(customer);
    if (customer) {
      setChecking(false);
      return;
    }
    api.restoreSession()
      .then((session) => setAuthenticated(Boolean(session)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="product-auth min-h-screen" aria-busy="true" aria-label="Preparing workspace access" />;
  }

  if (authenticated && !customerIntent) {
    return <AppShell title="Reviewer access" description="Request a personal, read-only account for the sanitized Case Lens workspace. Intercom access is approved separately."><AccessRequestForm embedded customerIntent={customerIntent} /></AppShell>;
  }

  return <AccessRequestForm customerIntent={customerIntent} />;
}

function AccessRequestForm({ embedded = false, customerIntent = false }: { embedded?: boolean; customerIntent?: boolean }) {
  const [customer, setCustomer] = useState(customerIntent);
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
    if (customer && form.purpose.length > 740) {
      setError('Please keep the workflow description to 740 characters or fewer.');
      return;
    }
    setState('submitting');
    setError(null);
    try {
      await api.post('/api/access-requests', { ...form, workspaceId: form.workspaceId.trim() || undefined, purpose: customer ? `[Customer product demo] ${form.purpose}` : form.purpose });
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

  const content = (
    <section className={`auth-form-card ${embedded ? 'embedded-access-card' : ''}`}>
      <p className="product-eyebrow">{customer ? 'FOR YOUR ORGANIZATION' : 'PRODUCT & PROJECT ACCESS'}</p>
      <h1>{customer ? 'Put your HR workflow in the picture.' : 'Request a personal reviewer account.'}</h1>
      <p className="auth-form-intro">{customer ? 'Tell us how your team handles HR conversations. Request a product demo to explore case classification, employee matching, related history, and stakeholder routing.' : 'Explore the product and the engineering behind it with a personal, read-only account. Evaluation records are synthetic; Intercom invitations are approved separately.'}</p>
      {!embedded && state !== 'complete' ? <div className="access-audience" role="group" aria-label="What brings you here?"><button type="button" aria-pressed={customer} onClick={() => setCustomer(true)}><SignalIcon type="person" /><span>For my organization<small>Evaluate the product</small></span></button><button type="button" aria-pressed={!customer} onClick={() => setCustomer(false)}><SignalIcon type="spark" /><span>Review the project<small>Recruiters & reviewers</small></span></button></div> : null}
      {state === 'complete' ? (
        <div className="access-complete" role="status">
          <span className="access-success-icon">✓</span><h2>Request received</h2>
          <p>{customer ? 'Your product demo request is waiting for review. Your organization and workflow details will help shape the conversation. You can explore the synthetic product demo while you wait.' : 'Your request is awaiting manual review. If approved, a secure password setup link will be sent to the email you provided.'}</p>
          <AccessStatusPanel status={accessStatus ?? { status: 'pending', workspaceId: form.workspaceId || null, reviewNote: null }} />
          <Link href="/login?mode=demo" className="product-primary-button">Explore the read-only demo <ArrowIcon /></Link>
          <Link href="/#live-demo" className="auth-back-link">Watch the product walkthrough ↗</Link>
        </div>
      ) : <>
        {accessStatus ? <AccessStatusPanel status={accessStatus} /> : null}
        {error ? <div role="alert" className="auth-error">{error}</div> : null}
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="auth-field-grid"><Field label="Full name" required><input required minLength={2} maxLength={120} autoComplete="name" placeholder="Your name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></Field><Field label="Work email" required><input required type="email" maxLength={255} autoComplete="email" placeholder="you@company.com" value={form.workEmail} onChange={(event) => update('workEmail', event.target.value)} /></Field></div>
          <div className="auth-field-grid"><Field label="Organization" required={customer}><input required={customer} maxLength={160} autoComplete="organization" placeholder="Your company" value={form.organization} onChange={(event) => update('organization', event.target.value)} /></Field><Field label="Role"><input maxLength={120} autoComplete="organization-title" placeholder="HR lead, operator, recruiter…" value={form.role} onChange={(event) => update('role', event.target.value)} /></Field></div>
          <Field label="Intercom Workspace ID" required={embedded} hint="Optional for a product demo. Enter only the non-secret workspace ID, never an API key or access token."><input required={embedded} minLength={3} maxLength={64} pattern="[A-Za-z0-9_-]{3,64}" placeholder="workspace_123" value={form.workspaceId} onChange={(event) => update('workspaceId', event.target.value)} /></Field>
          <Field label={customer ? 'What would you like to explore?' : 'Reason for access'} required hint="At least 20 characters. Please leave out confidential employee information."><textarea required minLength={20} maxLength={customer ? 740 : 800} rows={4} placeholder={customer ? 'Tell us about your team, current HR workflow, and what you would like to improve…' : 'Tell us what you are reviewing and the access you need…'} value={form.purpose} onChange={(event) => update('purpose', event.target.value)} /></Field>
          <label className="auth-consent"><input required type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} /><span>I agree that these details may be stored solely to review and manage this request.</span></label>
          <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} /></label></div>
          <button type="submit" disabled={state === 'submitting'} className="product-primary-button">{state === 'submitting' ? 'Submitting securely…' : customer ? 'Request a product demo' : 'Request reviewer access'}<ArrowIcon /></button>
        </form>
        <p className="auth-fine-print">{customer ? 'Requests are reviewed manually. Product evaluation starts with synthetic records and a read-only walkthrough.' : 'Personal invitations are reviewed manually. Approved accounts are read-only; Intercom access is arranged separately.'}</p>
        <div className="auth-sales-link"><p>Want to see the workflow now?</p><Link href="/login?mode=demo">Explore the read-only demo <ArrowIcon diagonal /></Link></div>
      </>}
    </section>
  );
  return embedded ? content : <AuthShell mode="access">{content}</AuthShell>;
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
