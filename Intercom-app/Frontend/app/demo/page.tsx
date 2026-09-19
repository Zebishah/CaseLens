'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, DashboardIcon, SectionCard } from '../../components/dashboard/ui';
import { DemoVideoEmbed } from '../../components/DemoVideoEmbed';
import { ApiError, api } from '../../lib/api';
import { PRODUCT_DEMO_HIGHLIGHTS, PRODUCT_DEMO_URL } from '../../lib/product-demo';

type Session = {
  token?: string;
  receivingAddress: string;
  expiresAt: string;
  remainingCases: number;
  remainingEmails: number;
  remainingLiveLlm: number;
};

type Scenario = { id: string; title: string; summary: string };

type ProcessResult = {
  conversationId: number;
  status: string;
  outcome: string;
  snapshot: {
    processingMode?: string;
    employeeMatches?: Array<{ canonicalName: string; confidenceScore: number }>;
    relatedCases?: Array<{ subject?: string }>;
    ccRecipients?: { recipients?: Array<{ name: string; email: string; role: string }> };
    requiresManualReview?: boolean;
    caseType?: string;
  } | null;
  safeError: string | null;
};

const statusLabel = (status: string | null): string => {
  if (status === 'pending' || status === 'queued') return 'Queued';
  if (status === 'processing') return 'Processing';
  if (status === 'ready' || status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  return status ?? 'Queued';
};

export default function DemoPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [mode, setMode] = useState<'fixture' | 'live'>('fixture');
  const [liveAi, setLiveAi] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [custom, setCustom] = useState({
    senderEmail: '1042@northwind.co',
    subject: 'Attendance — Jordan Hale',
    content: 'Jordan Hale was late three times this week at store 1042. Please advise.'
  });

  const start = async () => {
    setError(null);
    try {
      const ready = await api.ready();
      if (ready.status !== 'ready') {
        setSleeping(true);
        return;
      }
      setSleeping(false);
      const created = await api.post<{
        session: Session;
        scenarios: Scenario[];
        llmModeDefault?: string;
        liveAiConfigured?: boolean;
      }>('/api/demo/sessions', {});
      if (created.session.token) {
        sessionStorage.setItem('demoToken', created.session.token);
      }
      setSession(created.session);
      setScenarios(created.scenarios);
      setLiveAi(created.liveAiConfigured === true);
      if (created.llmModeDefault === 'live' && created.liveAiConfigured) {
        setMode('live');
      } else {
        setMode('fixture');
      }
    } catch (err) {
      if (err instanceof ApiError && err.sleeping) {
        setSleeping(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not start demo session');
    }
  };

  useEffect(() => {
    void start();
  }, []);

  const runProcess = async (conversationId: number, force = false) => {
    setPhase('processing');
    const processed = await api.post<ProcessResult>(`/api/demo/cases/${conversationId}/process`, {
      force
    });
    setResult(processed);
    setPhase(processed.status === 'failed' || processed.outcome === 'failed' ? 'failed' : 'completed');
  };

  const submitScenario = async (scenarioId: string) => {
    setError(null);
    setResult(null);
    setCaseId(null);
    setBusy(true);
    setPhase('queued');
    try {
      const submitted = await api.post<{ conversationId: number | null }>('/api/demo/sample', {
        scenarioId,
        processingMode: 'fixture'
      });
      if (!submitted.conversationId) {
        setError('The case was accepted but no id was returned.');
        setPhase('failed');
        return;
      }
      setCaseId(submitted.conversationId);
      await runProcess(submitted.conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the sample case.');
      setPhase('failed');
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = async () => {
    setError(null);
    setResult(null);
    setCaseId(null);
    setBusy(true);
    setPhase('queued');
    try {
      const submitted = await api.post<{ conversationId: number | null }>('/api/demo/custom', {
        ...custom,
        processingMode: mode
      });
      if (!submitted.conversationId) {
        setError('The case was accepted but no id was returned.');
        setPhase('failed');
        return;
      }
      setCaseId(submitted.conversationId);
      await runProcess(submitted.conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the custom case.');
      setPhase('failed');
    } finally {
      setBusy(false);
    }
  };

  const snapshot = result?.snapshot;

  return (
    <AppShell
      title="Product walkthrough & access"
      description="Understand the HR Intelligence workflow, the two controlled access paths, and a safe sample case. Organization overview stays focused on live operating stats."
    >
      <section aria-labelledby="product-walkthrough-title" className="reveal mb-8 overflow-hidden rounded-[2rem] border border-primary/15 bg-slate-950 shadow-lift">
        <div className="border-b border-white/10 px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Dedicated product tour</p>
              <h2 id="product-walkthrough-title" className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                See HR Intelligence inside Intercom
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Follow a conversation from intake to explainable matching, related history, stakeholder routing, and a safe write-back.
              </p>
            </div>
            <a href={PRODUCT_DEMO_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
              Open video in new tab ↗
            </a>
          </div>
        </div>
        <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:p-8">
          <DemoVideoEmbed videoUrl={PRODUCT_DEMO_URL} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {PRODUCT_DEMO_HIGHLIGHTS.map((highlight, index) => (
              <article key={highlight.title} className="lift-hover rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-xs font-semibold text-emerald-300">0{index + 1}</span>
                  <h3 className="text-sm font-semibold text-white">{highlight.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{highlight.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="access-paths-title" className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Controlled access</p>
            <h2 id="access-paths-title" className="mt-2 text-2xl font-semibold tracking-tight text-primary">Choose how you want to review</h2>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">No shared credentials</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="reveal reveal-delay-1 lift-hover overflow-hidden rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-emerald-300"><DashboardIcon name="shield" /></span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">Fastest</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-primary">Instant workspace walkthrough</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Start a short-lived, server-issued viewer session with synthetic data. No account setup and no admin tools are exposed.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/login?mode=demo" className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">Enter read-only demo →</Link>
              <span className="text-xs text-muted">Read-only · temporary · sanitized</span>
            </div>
          </article>
          <article className="reveal reveal-delay-2 lift-hover overflow-hidden rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary"><DashboardIcon name="users" /></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Personal</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-primary">Request approved access</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Submit your work email for review. After approval, you receive a one-time password setup email and your own read-only workspace account.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/access" className="btn-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">Request access →</Link>
              <span className="text-xs text-muted">Admin approved · your email · viewer role</span>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="workspace-guide-title" className="mb-10 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Reviewer guide</p>
          <h2 id="workspace-guide-title" className="mt-2 text-2xl font-semibold tracking-tight text-primary">How to use the two workspaces together</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Use Intercom to see the conversation and the HR Intelligence workspace to see the intelligence, evidence, and processing state built around it.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-paper p-5">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">01</span><h3 className="font-semibold text-primary">Open the workspace</h3></div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-muted">
              <li><span className="font-semibold text-primary">Overview.</span> Start with cases processed, identity matches, related history, and attention items.</li>
              <li><span className="font-semibold text-primary">Case operations.</span> Open a case to inspect evidence, timeline, routing, and the explainable result.</li>
              <li><span className="font-semibold text-primary">Directory intelligence.</span> Check organizational records and the matching context used by the processor.</li>
              <li><span className="font-semibold text-primary">Architecture.</span> Follow the webhook, queue, intelligence, and snapshot path.</li>
            </ol>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-300 text-sm font-bold text-slate-950">02</span><h3 className="font-semibold">Open Intercom separately</h3></div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li><span className="font-semibold text-white">Accept the official invitation.</span> Intercom access is separate from the dashboard account and is never created by public sign-up.</li>
              <li><span className="font-semibold text-white">Open the assigned workspace.</span> Review the synthetic inbox conversation that triggered the case.</li>
              <li><span className="font-semibold text-white">Inspect the intelligence panel.</span> Compare the original message with identity, related-case, and routing evidence.</li>
              <li><span className="font-semibold text-white">Keep access private.</span> Use your own invitation and contact the administrator if the link expires.</li>
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="sample-lab-title" className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Interactive sample lab</p>
        <h2 id="sample-lab-title" className="mt-2 text-2xl font-semibold tracking-tight text-primary">Try the processing workflow</h2>
        <p className="mt-2 text-sm leading-6 text-muted">These actions use temporary demonstration records. Do not submit personal or confidential information.</p>
      </section>

      {sleeping ? (
        <AlertBanner
          tone="warning"
          title="Starting the service"
          action={
            <button type="button" className="btn-primary rounded-full px-4 py-2 text-sm font-medium" onClick={() => void start()}>
              Retry
            </button>
          }
        >
          The host may be waking from sleep. This is not an application error.
        </AlertBanner>
      ) : null}
      {error ? (
        <div className="mb-4">
          <AlertBanner tone="danger" title="Something went wrong">
            {error}
          </AlertBanner>
        </div>
      ) : null}
      {session ? (
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <SectionCard title="Temporary inbound address" className="md:col-span-2">
            <p className="break-all font-mono text-sm text-primary">{session.receivingAddress}</p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-primary hover:text-primary-hover"
              onClick={() => {
                void navigator.clipboard.writeText(session.receivingAddress);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </SectionCard>
          <SectionCard title="Session">
            <p className="text-sm text-muted">Expires {new Date(session.expiresAt).toLocaleString()}</p>
            <p className="mt-2 text-sm">Cases left: {session.remainingCases}</p>
            <p className="text-sm">Emails left: {session.remainingEmails}</p>
            <p className="text-sm">Live AI left: {session.remainingLiveLlm}</p>
          </SectionCard>
        </section>
      ) : (
        !sleeping && <div className="mb-6 h-32 animate-pulse rounded-[1.8rem] bg-white/80" />
      )}

      {phase !== 'idle' ? (
        <SectionCard title="Processing" className="mb-6">
          <ol className="flex flex-wrap gap-2 text-sm">
            {(['queued', 'processing', 'completed'] as const).map((step) => {
              const active =
                (step === 'queued' &&
                  (phase === 'queued' || phase === 'processing' || phase === 'completed' || phase === 'failed')) ||
                (step === 'processing' && (phase === 'processing' || phase === 'completed' || phase === 'failed')) ||
                (step === 'completed' && phase === 'completed');
              return (
                <li
                  key={step}
                  className={`rounded-full px-3 py-1 ${
                    step === 'queued' ? 'status-queued' : step === 'processing' ? 'status-processing' : 'status-completed'
                  } ${active ? '' : 'opacity-40'}`}
                >
                  {step === 'queued' ? 'Queued' : step === 'processing' ? 'Processing' : 'Completed'}
                </li>
              );
            })}
          </ol>
          {phase === 'processing' ? (
            <p className="mt-4 h-2 w-48 animate-pulse rounded-full bg-secondary/40" aria-live="polite">
              <span className="sr-only">Processing case intelligence</span>
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            {phase === 'failed' ? result?.safeError ?? 'Processing failed. You can retry the same case.' : statusLabel(result?.status ?? phase)}
          </p>
          {caseId ? <p className="mt-2 font-mono text-xs text-muted">Case {caseId}</p> : null}
          {phase === 'failed' && caseId ? (
            <button
              type="button"
              className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void runProcess(caseId, true)
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Retry failed');
                    setPhase('failed');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Retry processing
            </button>
          ) : null}
        </SectionCard>
      ) : null}

      {snapshot && phase === 'completed' ? (
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <SectionCard title="Extraction">
            <p className="text-sm">Mode: {snapshot.processingMode === 'live' ? 'Live AI' : 'Deterministic sample'}</p>
            <p className="text-sm">Category: {snapshot.caseType ?? '—'}</p>
            <p className="text-sm">
              Employee: {snapshot.employeeMatches?.[0]?.canonicalName ?? 'Not matched'} (
              {snapshot.employeeMatches?.[0]?.confidenceScore ?? 0}%)
            </p>
            <p className="text-sm">Manual review: {snapshot.requiresManualReview ? 'Yes' : 'No'}</p>
          </SectionCard>
          <SectionCard title="Related cases and routing">
            <p className="text-sm">Related: {snapshot.relatedCases?.length ?? 0}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(snapshot.relatedCases ?? []).map((related, index) => (
                <li key={index} className="border-l-2 border-secondary pl-3">
                  {related.subject ?? 'Related case'}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-semibold text-primary">Stakeholders</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(snapshot.ccRecipients?.recipients ?? []).map((recipient) => (
                <li key={recipient.email}>
                  {recipient.name} · {recipient.role}
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>
      ) : null}

      <h2 className="mb-2 text-xl font-semibold text-primary">Sample scenarios</h2>
      <p className="mb-4 text-sm text-muted">These run through the real processor with a deterministic fixture, not a live model.</p>
      <ul className="mb-10 grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <li key={scenario.id}>
            <SectionCard title={scenario.title}>
              <p className="text-sm text-muted">{scenario.summary}</p>
              <button
                type="button"
                className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  void submitScenario(scenario.id).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Submission failed');
                    setPhase('failed');
                  })
                }
              >
                Run sample
              </button>
            </SectionCard>
          </li>
        ))}
      </ul>

      <SectionCard title="Custom case">
        <p className="mb-4 text-sm text-muted">
          Enter any reasonable new case. Sample scenarios stay deterministic. Custom Live AI uses the configured
          server-side model and counts against the session live AI limit.
        </p>
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-primary">Source label</legend>
          <label className="mr-4 text-sm">
            <input type="radio" name="mode" checked={mode === 'fixture'} onChange={() => setMode('fixture')} /> Deterministic
          </label>
          <label className={`text-sm ${liveAi ? '' : 'text-muted'}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'live'}
              disabled={!liveAi}
              onChange={() => setMode('live')}
            />{' '}
            Live AI
          </label>
          {!liveAi ? (
            <p className="mt-2 text-xs text-muted">Live AI is not enabled in this deployment.</p>
          ) : null}
        </fieldset>
        <form
          className="max-w-2xl space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCustom().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Submission failed');
              setPhase('failed');
            });
          }}
        >
          <label className="block text-sm text-primary">
            Sender email
            <input
              required
              type="email"
              className="dash-field mt-1"
              value={custom.senderEmail}
              onChange={(event) => setCustom({ ...custom, senderEmail: event.target.value })}
            />
          </label>
          <label className="block text-sm text-primary">
            Subject
            <input
              required
              minLength={3}
              className="dash-field mt-1"
              value={custom.subject}
              onChange={(event) => setCustom({ ...custom, subject: event.target.value })}
            />
          </label>
          <label className="block text-sm text-primary">
            Message
            <textarea
              required
              minLength={20}
              maxLength={8000}
              rows={5}
              className="dash-field mt-1"
              value={custom.content}
              onChange={(event) => setCustom({ ...custom, content: event.target.value })}
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50">
            Submit custom case
          </button>
        </form>
      </SectionCard>
    </AppShell>
  );
}
