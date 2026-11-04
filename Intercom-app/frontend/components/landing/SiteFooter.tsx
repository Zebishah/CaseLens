import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-white text-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-sm md:grid-cols-3 md:px-6">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-secondary">AI-POWERED B2B HR INTELLIGENCE</p>
          <p className="mt-2 text-lg font-semibold">HR Intelligence</p>
          <p className="mt-3 max-w-xs text-muted">
            Explainable HR case intelligence for organizations using Intercom and email. AI assists interpretation;
            deterministic systems verify and resolve; human reviewers remain authoritative.
          </p>
        </div>
        <div>
          <p className="text-muted">Product</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/architecture" className="hover:text-foreground">
                Architecture
              </Link>
            </li>
            <li>
              <Link href="/engineering" className="hover:text-foreground">
                Engineering case study
              </Link>
            </li>
            <li>
              <Link href="/evaluation" className="hover:text-foreground">
                AI Evaluation
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-muted">Workspace</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/overview" className="hover:text-foreground">
                Organization overview
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Administrator access
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
