'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { clearAdminToken, getAdminToken, getAdminUser, type AdminUser } from '../lib/auth-token';

const nav = [
  { href: '/overview', label: 'Overview', hint: 'Live stats' },
  { href: '/cases', label: 'Cases', hint: 'Processed tickets' },
  { href: '/directory', label: 'Directory', hint: 'Employees & stores' },
  { href: '/operations', label: 'Operations', hint: 'Ingestion health' },
  { href: '/evaluation', label: 'Evaluation', hint: 'Fixture checks' },
  { href: '/architecture', label: 'Architecture', hint: 'System design' }
];

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
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getAdminToken()));
    setUser(getAdminUser());
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signOut = () => {
    clearAdminToken();
    setSignedIn(false);
    setUser(null);
    window.location.href = '/';
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="theme-light dash-canvas min-h-screen text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 p-3 md:flex">
          <div className="dash-sidebar flex h-full w-full flex-col rounded-2xl bg-white px-3 py-4">
            <Link href="/" className="rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-secondary">Nagumo</p>
              <p className="mt-1 text-[1.05rem] font-semibold tracking-tight text-primary">HR Intelligence</p>
              <p className="mt-1 text-xs text-muted">Operator workspace</p>
            </Link>
            <nav className="mt-4 flex flex-1 flex-col gap-1 px-1" aria-label="Application">
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 transition ${
                      active ? 'bg-primary text-white' : 'text-muted hover:bg-paper hover:text-primary'
                    }`}
                  >
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-muted/80'}`}>
                      {item.hint}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto rounded-xl bg-paper px-4 py-4">
              {signedIn ? (
                <>
                  <p className="text-sm font-semibold text-primary">{user?.name ?? 'Operator'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{user?.email ?? 'Signed in'}</p>
                  <button type="button" className="mt-3 text-sm font-medium text-primary hover:text-primary-hover" onClick={signOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/login" className="text-sm font-medium text-primary hover:text-primary-hover">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4">
            <div className="nav-dock flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white/90 px-4 py-2.5 backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.18em] text-secondary md:hidden">HR Intelligence</p>
                <h1 className="truncate text-lg font-semibold tracking-tight text-primary md:text-xl">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/" className="hidden rounded-full px-3 py-1.5 text-sm text-muted hover:bg-paper hover:text-primary md:inline">
                  Home
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-primary/15 px-3 py-1.5 text-sm text-primary md:hidden"
                  aria-expanded={open}
                  aria-controls="mobile-app-nav"
                  onClick={() => setOpen((value) => !value)}
                >
                  {open ? 'Close' : 'Menu'}
                </button>
              </div>
            </div>
            {open ? (
              <nav
                id="mobile-app-nav"
                className="nav-dock mt-2 rounded-[1.6rem] border border-primary/10 bg-white/95 p-3 shadow-float md:hidden"
                aria-label="Mobile application"
              >
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-full px-4 py-2.5 text-sm ${
                      isActive(item.href) ? 'bg-primary text-white' : 'text-primary'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {signedIn ? (
                  <button type="button" className="mt-1 w-full rounded-full px-4 py-2.5 text-left text-sm text-muted" onClick={signOut}>
                    Sign out
                  </button>
                ) : (
                  <Link href="/login" className="mt-1 block rounded-full px-4 py-2.5 text-sm text-primary">
                    Sign in
                  </Link>
                )}
              </nav>
            ) : null}
          </header>
          <main id="main" className="relative flex-1 px-4 py-6 md:px-8 md:py-8">
            <div
              className="pointer-events-none absolute -right-10 top-8 hidden h-40 w-40 rounded-full bg-mist/40 md:block"
              aria-hidden="true"
            />
            {description ? <p className="reveal relative mb-6 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
