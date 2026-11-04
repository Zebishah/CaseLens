'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowIcon, IntelligenceMark } from './LandingIcons';

const links = [
  { href: '/#problem', label: 'Problem', match: 'problem' },
  { href: '/#ai-intelligence', label: 'AI intelligence', match: 'ai-intelligence' },
  { href: '/#impact', label: 'Impact', match: 'impact' },
  { href: '/#architecture', label: 'Architecture', match: 'architecture' },
  { href: '/engineering', label: 'Engineering', match: 'engineering' },
  { href: '/#faq', label: 'FAQ', match: 'faq' },
  { href: '/#live-demo', label: 'Live demo', match: 'live-demo' }
];

export function LandingNav({ immersive = false }: { immersive?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace('#', ''));
    const onScroll = () => setScrolled(window.scrollY > 16);
    syncHash();
    onScroll();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (match: string) => {
    if (pathname !== '/') {
      return false;
    }
    return hash === match;
  };

  if (immersive) {
    const primaryLinks = [
      { href: '/#product', label: 'The product' },
      { href: '/#workflow', label: 'How it works' },
      { href: '/#architecture', label: 'Built for trust' },
      { href: '/#reviewers', label: 'For reviewers' }
    ];
    return (
      <header className={`ai-navigation ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="ai-nav-inner">
          <Link href="/" className="ai-brand" aria-label="HR Intelligence home"><IntelligenceMark /><span>hr<span>intelligence</span><sup>AI</sup></span></Link>
          <nav className="ai-desktop-nav" aria-label="Landing">{primaryLinks.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
          <div className="ai-nav-actions"><Link href="/login" className="ai-sign-in">Sign in <ArrowIcon diagonal /></Link><Link href="/access?intent=customer" className="ai-nav-cta">Request a demo <ArrowIcon /></Link><button className="ai-menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ai-mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>{open ? 'Close' : 'Menu'}<span aria-hidden="true">{open ? '−' : '+'}</span></button></div>
        </div>
        {open && <nav id="ai-mobile-nav" className="ai-mobile-nav" aria-label="Mobile landing">{primaryLinks.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowIcon diagonal /></Link>)}<Link href="/access?intent=customer" onClick={() => setOpen(false)}>Request a product demo <ArrowIcon /></Link></nav>}
      </header>
    );
  }

  return (
    <header
      className={`relative z-50 transition-colors duration-200 ${
        scrolled ? 'bg-white/85 backdrop-blur-xl' : 'bg-mist'
      }`}
    >
      <div className="px-4 pt-4 pb-3 md:px-6">
        <div
          className={`nav-dock mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-primary/10 bg-white/80 px-3 py-2 backdrop-blur-md md:px-4 ${
            scrolled ? 'shadow-float' : ''
          }`}
        >
          <Link href="/" className="min-w-0 shrink-0 rounded-full px-2 py-1">
            <span className="block text-[10px] font-medium tracking-[0.2em] text-secondary">AI-POWERED B2B HR</span>
            <span className="block text-sm font-semibold text-primary">HR Intelligence</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted md:flex" aria-label="Landing">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={isActive(link.match)}
                className="nav-link rounded-full px-3.5 py-2 transition hover:bg-mist/70 hover:text-primary"
                onClick={() => setHash(link.match)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login" className="btn-primary rounded-full px-4 py-2 text-sm font-medium">
              Sign in
            </Link>
          </div>
          <button
            type="button"
            className="rounded-full border border-primary/15 px-3 py-2 text-sm text-primary md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        {open ? (
          <div
            id="mobile-nav"
            className="nav-dock mx-auto mt-3 max-w-6xl rounded-[1.8rem] border border-primary/10 bg-white/95 p-5 shadow-float md:hidden"
          >
            <nav className="flex flex-col gap-2 text-sm" aria-label="Mobile landing">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  data-active={isActive(link.match)}
                  className="nav-link rounded-full px-4 py-2.5"
                  onClick={() => {
                    setHash(link.match);
                    setOpen(false);
                  }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="btn-primary mt-1 inline-flex justify-center rounded-full px-4 py-2.5 font-medium"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
