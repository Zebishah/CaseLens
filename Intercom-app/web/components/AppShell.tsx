'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import { PRODUCT_DEMO_URL } from '../lib/product-demo';
import { DemoVideoEmbed } from './DemoVideoEmbed';
import {
  AUTH_STATE_EVENT,
  getAdminUser,
  type AdminUser
} from '../lib/auth-token';

type IconName = 'overview' | 'cases' | 'directory' | 'operations' | 'quality' | 'access' | 'architecture';

type NavGroup = {
  label: string;
  adminOnly?: boolean;
  viewerOnly?: boolean;
  items: Array<{ href: string; label: string; hint: string; icon: IconName }>;
};

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/overview', label: 'Overview', hint: 'Performance and attention', icon: 'overview' },
      { href: '/cases', label: 'Case explorer', hint: 'Processed conversations', icon: 'cases' },
      { href: '/directory', label: 'People & stores', hint: 'Resolution directory', icon: 'directory' }
    ]
  },
  {
    label: 'Reliability',
    adminOnly: true,
    items: [
      { href: '/operations', label: 'Operations', hint: 'Ingestion and processing', icon: 'operations' },
      { href: '/evaluation', label: 'AI quality', hint: 'Measured evaluation', icon: 'quality' },
      { href: '/access-requests', label: 'Access requests', hint: 'Reviewer invitations', icon: 'access' }
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/architecture', label: 'Architecture', hint: 'Verified system design', icon: 'architecture' }
    ]
  },
  {
    label: 'Intercom demo',
    items: [
      { href: '/access', label: 'Request Intercom access', hint: 'Personal workspace invitation', icon: 'access' }
    ]
  }
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><path d="M4 13h6V4H4v9Z" /><path d="M14 20h6v-9h-6v9Z" /><path d="M4 20h6v-3H4v3Z" /><path d="M14 7h6V4h-6v3Z" /></>,
    cases: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    directory: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 6h5M18.5 3.5v5" /></>,
    operations: <><path d="M4 7h10M4 17h16M18 7h2" /><circle cx="15.5" cy="7" r="1.5" /><circle cx="8.5" cy="17" r="1.5" /></>,
    quality: <><path d="m12 3 2.2 5.2L20 10l-4.2 3.8L17 20l-5-3-5 3 1.2-6.2L4 10l5.8-1.8L12 3Z" /></>,
    access: <><path d="M4 20c.5-4 2.4-6 6-6s5.5 2 6 6" /><circle cx="10" cy="8" r="3" /><path d="M17 8h4M19 6v4" /></>,
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
  const [open, setOpen] = useState(false);

  const restore = useCallback(async () => {
    setStatus('checking');
    try {
      const session = await api.restoreSession();
      if (!session) {
        router.replace('/login?reason=session-expired');
        return;
      }
      setUser(session.user);
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
    const syncUser = () => setUser(getAdminUser());
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
  const visibleNavGroups = navGroups.filter(
    (group) => (isAdmin || !group.adminOnly) && (!group.viewerOnly || !isAdmin)
  );
  const intercomWorkspaceUrl = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_URL?.trim();
  const restrictedPath =
    !isAdmin && ['/operations', '/evaluation', '/access-requests'].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (status === 'ready' && restrictedPath) {
      router.replace('/overview');
    }
  }, [restrictedPath, router, status]);

  if (status !== 'ready' || restrictedPath) {
    return (
      <div className="theme-light flex min-h-screen items-center justify-center bg-paper px-6 text-foreground">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">HI</div>
          <h1 className="mt-5 text-xl font-semibold text-primary">
            {restrictedPath ? 'Opening the read-only showcase' : status === 'checking' ? 'Securing your workspace' : 'The service is starting'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {restrictedPath
              ? 'Administrative tools are not part of recruiter access.'
              : status === 'checking'
                ? 'Restoring the protected workspace session.'
                : 'The backend host may be waking up. Your session has not been discarded.'}
          </p>
          {status === 'unavailable' ? (
            <button type="button" className="btn-primary mt-5 rounded-lg px-4 py-2.5 text-sm font-semibold" onClick={() => void restore()}>
              Try again
            </button>
          ) : (
            <div className="mx-auto mt-5 h-1 w-28 overflow-hidden rounded-full bg-primary/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-secondary" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="theme-light dash-canvas min-h-screen text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className="dash-sidebar sticky top-3 m-3 mr-0 hidden h-[calc(100vh-1.5rem)] w-[17rem] shrink-0 overflow-hidden rounded-2xl border border-emerald-950/40 md:flex md:flex-col">
          <Link href="/overview" className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-slate-950">HI</span>
              <span>
                <span className="block text-sm font-semibold tracking-tight text-white">HR Intelligence</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">Case operations</span>
              </span>
            </div>
          </Link>

          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Application">
            {visibleNavGroups.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link key={item.href} href={item.href} className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}>
                        <span className={`mt-0.5 ${active ? 'text-secondary' : 'text-slate-500 group-hover:text-slate-300'}`}><NavIcon name={item.icon} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>{item.hint}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            {isAdmin && intercomWorkspaceUrl ? (
              <a
                href={intercomWorkspaceUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-4 flex items-center justify-between rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-300/15"
              >
                <span>Open Intercom inbox</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <Link
              href="/"
              className="mb-4 flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span>Back to landing page</span>
              <span aria-hidden="true">←</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold uppercase text-white">
                {(user?.name ?? user?.email ?? 'O').slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Operator'}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email ?? 'Authenticated'}</p>
              </div>
              <button type="button" onClick={() => void signOut()} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sign out">
                Exit
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-3 z-40 mx-3 mt-3 overflow-hidden rounded-2xl border border-primary/10 bg-white/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-4 md:px-8">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary md:hidden">HR Intelligence</p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {isAdmin ? 'Admin workspace' : 'Read-only showcase'}
                </span>
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
              {description ? <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
              {pathname === '/overview' ? (
                <section className="mb-8 overflow-hidden rounded-2xl border border-primary/10 bg-slate-950 shadow-lift" aria-labelledby="app-walkthrough-title">
                  <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Product walkthrough</p>
                      <h2 id="app-walkthrough-title" className="mt-1 text-lg font-semibold text-white">See HR Intelligence inside Intercom</h2>
                      <p className="mt-1 text-sm text-slate-400">A five-minute, subtitled tour of the workflow behind this page.</p>
                    </div>
                    <Link href="/demo" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                      Open interactive demo →
                    </Link>
                  </div>
                  <div className="p-4 md:p-6">
                    <DemoVideoEmbed videoUrl={PRODUCT_DEMO_URL} />
                  </div>
                </section>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
