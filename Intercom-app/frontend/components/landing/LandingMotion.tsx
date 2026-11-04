'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Progressive enhancement: content stays visible without scripting or motion. */
export function LandingMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal], .section-heading, .capability-card, .demo-section-heading, .trust-intro, .trust-details, .ai-audience-paths > article'));
    const setup = () => {
      observer?.disconnect();
      elements.forEach(element => element.classList.remove('will-reveal', 'has-revealed'));
      if (media.matches) return;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('has-revealed');
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
      elements.forEach(element => {
        if (element.getBoundingClientRect().top < window.innerHeight - 20) return;
        element.classList.add('will-reveal');
        observer?.observe(element);
      });
    };
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      event.target.closest('.will-reveal')?.classList.add('has-revealed');
    };
    setup();
    media.addEventListener('change', setup);
    root.addEventListener('focusin', onFocus);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', setup);
      root.removeEventListener('focusin', onFocus);
      elements.forEach(element => element.classList.remove('will-reveal', 'has-revealed'));
    };
  }, []);
  return <div ref={rootRef} className="landing-motion-root">{children}</div>;
}
