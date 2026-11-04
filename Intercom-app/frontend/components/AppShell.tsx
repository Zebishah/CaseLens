'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import { DashboardHero, type DashboardIconName } from './dashboard/ui';
import { ArrowIcon, IntelligenceMark } from './landing/LandingIcons';
import { WorkspaceLoader } from './WorkspaceLoader';
import {
  AUTH_STATE_EVENT,
  getAdminUser,
  isDemoRecruiter,
  type AdminUser
} from '../lib/auth-token';

type IconName = 'overview' | 'cases' | 'directory' | 'operations' | 'quality' | 'access' | 'architecture' | 'demo';

type NavGroup = {
  label: string;
  items: Array<{
    href: string;
    label: string;
    hint: string;
    icon: IconName;
    adminOnly?: boolean;
    demoOnly?: boolean;
    hideForDemo?: boolean;
  }>;
};

type ReviewerAccessStatus = {
  status: 'pending' | 'approved' | 'invited' | 'declined' | 'expired';
  workspaceId?: string | null;
  reviewNote?: string | null;
  connectedInboxUrl?: string | null;
};

const navGroups: NavGroup[] = [
  {
    label: 'Organization workspace',
    items: [
      { href: '/overview', label: 'Organization overview', hint: 'Performance and attention', icon: 'overview' },
      { href: '/cases', label: 'Case operations', hint: 'Explainable case records', icon: 'cases' },
      { href: '/directory', label: 'Directory intelligence', hint: 'People, stores, and ownership', icon: 'directory' }
    ]
  },
  {
    label: 'Reliability',
    items: [
      { href: '/operations', label: 'Operational health', hint: 'Ingestion and processing', icon: 'operations', demoOnly: true },
      { href: '/evaluation', label: 'AI quality', hint: 'Measured evaluation', icon: 'quality', demoOnly: true },
      { href: '/access-requests', label: 'Access management', hint: 'Reviewer invitations', icon: 'access', adminOnly: true }
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/architecture', label: 'Architecture', hint: 'Verified system design', icon: 'architecture' }
    ]
  },
  {
    label: 'Product tour & access',
    items: [
      { href: '/demo', label: 'Product walkthrough', hint: 'Video and guided tour', icon: 'demo' },
      { href: '/access', label: 'Reviewer access', hint: 'Controlled workspace invitation', icon: 'access' }
    ]
  }
];

const heroByPath: Record<string, { eyebrow: string; title: string; icon: DashboardIconName; meta: string }> = {
  '/overview': { eyebrow: 'Organization overview', title: 'Your HR conversations. One connected picture.', icon: 'activity', meta: 'Live operating view' },
  '/cases': { eyebrow: 'Case operations', title: 'Every HR case, with the context to move forward.', icon: 'cases', meta: 'Persisted case evidence' },
  '/directory': { eyebrow: 'Directory intelligence', title: 'Resolve people, stores, and ownership with confidence.', icon: 'users', meta: 'Organization context' },
  '/operations': { eyebrow: 'Operational health', title: 'Keep intake, processing, and write-back observable.', icon: 'activity', meta: 'Runtime health' },
  '/evaluation': { eyebrow: 'AI quality', title: 'Measure assistance before it reaches an operator.', icon: 'spark', meta: 'Versioned baseline' },
  '/architecture': { eyebrow: 'Intercom-integrated architecture', title: 'See how conversations become explainable case intelligence.', icon: 'link', meta: 'Verified flow' },
  '/demo': { eyebrow: 'Product walkthrough', title: 'Review the HR Intelligence workflow from intake to human review.', icon: 'spark', meta: 'Guided platform tour' },
  '/access': { eyebrow: 'Reviewer access', title: 'Choose a secure path into the HR Intelligence workspace.', icon: 'shield', meta: 'Invite-only access' },
  '/access-requests': { eyebrow: 'Access management', title: 'Review who should receive organization workspace access.', icon: 'shield', meta: 'Admin approval queue' }
};

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><path d="M4 13h6V4H4v9Z" /><path d="M14 20h6v-9h-6v9Z" /><path d="M4 20h6v-3H4v3Z" /><path d="M14 7h6V4h-6v3Z" /></>,
    cases: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    directory: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 6h5M18.5 3.5v5" /></>,
    operations: <><path d="M4 7h10M4 17h16M18 7h2" /><circle cx="15.5" cy="7" r="1.5" /><circle cx="8.5" cy="17" r="1.5" /></>,
    quality: <><path d="m12 3 2.2 5.2L20 10l-4.2 3.8L17 20l-5-3-5 3 1.2-6.2L4 10l5.8-1.8L12 3Z" /></>,
    access: <><path d="M4 20c.5-4 2.4-6 6-6s5.5 2 6 6" /><circle cx="10" cy="8" r="3" /><path d="M17 8h4M19 6v4" /></>,
    demo: <><path d="m8 5 11 7-11 7V5Z" /><path d="M4 5v14" /></>,
    architecture: <><rect x="3" y="4" width="7" height="6" /><rect x="14" y="14" width="7" height="6" /><path d="M10 7h4a3 3 0 0 1 3 3v4M7 10v7h7" /></>
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function AppShell({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [reviewerAccess, setReviewerAccess] = useState<ReviewerAccessStatus | null>(null);
  const [reviewerAccessLoading, setReviewerAccessLoading] = useState(false);

  const restore = useCallback(async () => {
    setStatus('checking');
    try {
      const session = await api.restoreSession();
      if (!session) {
        router.replace('/login?reason=session-expired');
        return;
      }
      setUser(session.user);
      setDemoMode(isDemoRecruiter());
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.sleeping) {
        setStatus('unavailable');
        return;
      }
      router.replace('/login?reason=session-expired');
    }
  }, [router]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const syncUser = () => {
      setUser(getAdminUser());
      setDemoMode(isDemoRecruiter());
    };
    window.addEventListener(AUTH_STATE_EVENT, syncUser);
    return () => window.removeEventListener(AUTH_STATE_EVENT, syncUser);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await api.logout();
    router.replace('/login?reason=signed-out');
  };

  const isAdmin = user?.role === 'admin';
  const isDemoRecruiterMode = demoMode && !isAdmin;
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (!item.adminOnly || isAdmin) &&
        (!item.demoOnly || isDemoRecruiterMode || isAdmin) &&
        (!item.hideForDemo || !isDemoRecruiterMode)
      )
    }))
    .filter((group) => group.items.length > 0);
  const intercomWorkspaceUrl = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_URL?.trim();
  const restrictedPath =
    ((!isAdmin && !isDemoRecruiterMode) && ['/operations', '/evaluation', '/access-requests'].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )) ||
    (isDemoRecruiterMode && ['/access-requests'].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    ));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const hero = pathname.startsWith('/cases/') ? null : heroByPath[pathname] ?? null;

  useEffect(() => {
    if (status === 'ready' && restrictedPath) {
      router.replace('/overview');
    }
  }, [restrictedPath, router, status]);

  useEffect(() => {
    if (!inboxModalOpen || !isDemoRecruiterMode) return;
    let active = true;
    setReviewerAccessLoading(true);
    api.get<ReviewerAccessStatus | null>('/api/access-requests/me')
      .then((result) => { if (active) setReviewerAccess(result); })
      .catch(() => { if (active) setReviewerAccess(null); })
      .finally(() => { if (active) setReviewerAccessLoading(false); });
    return () => { active = false; };
  }, [inboxModalOpen, isDemoRecruiterMode]);

  const openIntercomInbox = () => {
    setOpen(false);
    setInboxModalOpen(true);
  };

  if (status !== 'ready' || restrictedPath) {
    return (
      <WorkspaceLoader
        title={restrictedPath ? 'Opening the read-only reviewer workspace' : status === 'checking' ? 'Securing your workspace' : 'The service is starting'}
        description={restrictedPath
          ? 'Administrative tools are not part of reviewer access.'
          : status === 'checking'
            ? 'Restoring the protected workspace session.'
            : 'The backend host may be waking up. Your session has not been discarded.'}
        busy={status !== 'unavailable'}
      >
        {status === 'unavailable' ? (
          <button type="button" className="btn-primary mt-5 rounded-lg px-4 py-2.5 text-sm font-semibold" onClick={() => void restore()}>
            Try again
          </button>
        ) : null}
      </WorkspaceLoader>
    );
  }

  return (
    <div className="product-workspace theme-light dash-canvas min-h-screen text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className="dash-sidebar sticky top-3 m-3 mr-0 hidden h-[calc(100vh-1.5rem)] w-[17rem] shrink-0 overflow-hidden rounded-2xl border border-emerald-950/40 md:flex md:flex-col">
          <Link href="/overview" className="border-b border-primary/15 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="workspace-brand-mark"><IntelligenceMark /></span>
              <span>
                <span className="block text-sm font-semibold tracking-tight text-foreground">HR Intelligence</span>
                <span className="mt-0.5 block text-[11px] text-muted">AI-powered HR case intelligence</span>
              </span>
            </div>
          </Link>

          <div className="workspace-sidebar-context"><span>THE CONTEXT ENGINE</span><p>People. History. A clearer next step.</p></div>
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Application">
            {visibleNavGroups.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-mist text-foreground' : 'text-muted hover:bg-mist hover:text-foreground'}`}>
                        <span className={`mt-0.5 ${active ? 'text-secondary' : 'text-muted group-hover:text-muted'}`}><NavIcon name={item.icon} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${active ? 'text-muted' : 'text-muted'}`}>{item.hint}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-primary/15 p-4">
            {isAdmin && intercomWorkspaceUrl ? (
              <a
                href={intercomWorkspaceUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/15"
              >
                <span>Open Intercom inbox</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : isDemoRecruiterMode ? (
              <button type="button" onClick={openIntercomInbox} className="mb-4 flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/15">
                <span>Open Intercom inbox</span>
                <span aria-hidden="true">↗</span>
              </button>
            ) : null}
            <Link
              href="/"
              className="mb-4 flex items-center justify-between rounded-lg border border-primary/15 px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-mist hover:text-foreground"
            >
              <span>Back to landing page</span>
              <span aria-hidden="true">←</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold uppercase text-foreground">
                {(user?.name ?? user?.email ?? 'O').slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? 'Operator'}</p>
                <p className="truncate text-[11px] text-muted">{user?.email ?? 'Authenticated'}</p>
              </div>
              <button type="button" onClick={() => void signOut()} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-mist hover:text-foreground" aria-label="Sign out">
                Exit
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="workspace-header sticky top-3 z-40 mx-3 mt-3 overflow-hidden rounded-2xl border border-primary/10 bg-white/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-4 md:px-8">
              <div className="min-w-0">
                <p className="workspace-context-label">HR INTELLIGENCE / WORKSPACE</p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {isAdmin ? 'Admin workspace' : isDemoRecruiterMode ? 'Product demo · Read-only' : 'Read-only reviewer workspace'}
                </span>
                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm transition hover:border-secondary/50 hover:bg-primary/10 sm:flex"
                  onClick={() => window.dispatchEvent(new CustomEvent('hr-assistant:open'))}
                >
                  <span className="text-secondary" aria-hidden="true">✦</span>
                  Ask assistant
                </button>
                <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm md:hidden" aria-expanded={open} aria-controls="mobile-app-nav" onClick={() => setOpen((value) => !value)}>
                  {open ? 'Close' : 'Menu'}
                </button>
              </div>
            </div>
            {open ? (
              <nav id="mobile-app-nav" className="border-t border-slate-100 bg-white p-3 md:hidden" aria-label="Mobile application">
                {visibleNavGroups.flatMap((group) => group.items).map((item) => (
                  <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive(item.href) ? 'bg-primary text-white' : 'text-slate-700'}`}>
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                ))}
                {isAdmin && intercomWorkspaceUrl ? (
                  <a href={intercomWorkspaceUrl} target="_blank" rel="noreferrer" className="mt-2 block border-t border-slate-100 px-3 pt-3 text-sm font-medium text-secondary">
                    Open Intercom inbox ↗
                  </a>
                ) : isDemoRecruiterMode ? (
                  <button type="button" onClick={openIntercomInbox} className="mt-2 block w-full border-t border-slate-100 px-3 pt-3 text-left text-sm font-medium text-secondary">
                    Open Intercom inbox ↗
                  </button>
                ) : null}
                <Link href="/" className="mt-2 block border-t border-slate-100 px-3 pt-3 text-sm font-medium text-slate-700">
                  Back to landing page
                </Link>
                <button type="button" className="mt-2 w-full border-t border-slate-100 px-3 pt-3 text-left text-sm font-medium text-danger" onClick={() => void signOut()}>
                  Sign out
                </button>
              </nav>
            ) : null}
          </header>

          <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-[96rem]">
              {isDemoRecruiterMode ? <div className="workspace-demo-banner"><span><IntelligenceMark /><span><strong>Your preview of connected HR work.</strong> Explore a read-only product demo with synthetic records.</span></span><Link href="/access?intent=customer">For your organization <ArrowIcon diagonal /></Link></div> : null}
              {hero ? (
                <DashboardHero
                  eyebrow={hero.eyebrow}
                  title={hero.title}
                  description={description}
                  icon={hero.icon}
                  meta={isDemoRecruiterMode ? 'Synthetic evaluation workspace' : hero.meta}
                />
              ) : description ? <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
              {children}
            </div>
          </main>
        </div>
      </div>
      {isDemoRecruiterMode ? (
        <IntercomOnboardingModal
          open={inboxModalOpen}
          loading={reviewerAccessLoading}
          access={reviewerAccess}
          onClose={() => setInboxModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function IntercomOnboardingModal({
  open,
  loading,
  access,
  onClose
}: {
  open: boolean;
  loading: boolean;
  access: ReviewerAccessStatus | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const statusLabel = access?.status === 'approved' || access?.status === 'invited'
    ? 'Approved'
    : access?.status === 'pending'
      ? 'Pending'
      : access?.status === 'declined'
        ? 'Needs update'
        : access?.status === 'expired'
          ? 'Expired'
          : 'Not requested';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="intercom-onboarding-title" className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/15 bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="dashboard-section-label">Connected inbox</p>
            <h2 id="intercom-onboarding-title" className="mt-2 text-2xl font-semibold tracking-tight text-primary">Connect an Intercom workspace</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Close</button>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">To use the connected Intercom experience, first create or use a test/demo Intercom workspace. Then provide your workspace identifier through Reviewer Access. Once the access request is approved, HR Intelligence can associate your reviewer account with that workspace.</p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Reviewer access status</p><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary">{loading ? 'Checking…' : statusLabel}</span></div>
          <p className="mt-2 text-sm leading-6 text-muted">{loading ? 'Checking your latest reviewer access request.' : access?.status === 'pending' ? 'Your reviewer access request is waiting for approval.' : access?.status === 'approved' || access?.status === 'invited' ? access.connectedInboxUrl ? 'Your reviewer account is connected to the approved Intercom workspace.' : 'Your request is approved, but this environment does not have a safe direct inbox link configured.' : access?.status === 'declined' ? access.reviewNote || 'Your request needs an update. Review the admin note and resubmit if allowed.' : 'No reviewer access request has been submitted yet.'}</p>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {['Create or sign in to a test Intercom workspace.', 'Find the workspace identifier in Intercom.', 'Open Reviewer Access and submit it.', 'Wait for admin approval.', 'Return here to open the connected inbox.'].map((step, index) => <li key={step} className="flex gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{index + 1}</span><span>{step}</span></li>)}
        </ol>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900"><strong>Never paste Intercom API keys or access tokens here.</strong> Only the workspace identifier is required; provider credentials and webhook secrets stay securely configured on the server.</div>
        <div className="mt-6 flex flex-wrap gap-3">
          {access?.connectedInboxUrl ? <a href={access.connectedInboxUrl} target="_blank" rel="noreferrer" className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">Open connected inbox ↗</a> : null}
          <Link href="/access" onClick={onClose} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold">Request reviewer access</Link>
          <Link href="/architecture" onClick={onClose} className="btn-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">Learn how integration works</Link>
        </div>
      </div>
    </div>
  );
}
