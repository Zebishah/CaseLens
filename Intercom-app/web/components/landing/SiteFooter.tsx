import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-[#214f5c] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-sm md:grid-cols-3 md:px-6">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-secondary">Portfolio</p>
          <p className="mt-2 text-lg font-semibold">HR Intelligence</p>
          <p className="mt-3 max-w-xs text-white/70">
            HR case operations built as a real backend: Postgres, identity matching, related cases,
            and a shared intelligence processor. Not a customer system of record.
          </p>
        </div>
        <div>
          <p className="text-white/50">Product</p>
          <ul className="mt-3 space-y-2 text-white/80">
            <li>
              <Link href="/login" className="hover:text-white">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/architecture" className="hover:text-white">
                Architecture
              </Link>
            </li>
            <li>
              <Link href="/evaluation" className="hover:text-white">
                AI Evaluation
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-white/50">Project</p>
          <ul className="mt-3 space-y-2 text-white/80">
            <li>
              <Link href="/overview" className="hover:text-white">
                Application overview
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white">
                Administrator sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
