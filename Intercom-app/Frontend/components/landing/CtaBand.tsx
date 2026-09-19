import Link from 'next/link';

export function CtaBand() {
  const intercomUrl = process.env.NEXT_PUBLIC_INTERCOM_WORKSPACE_URL?.trim();

  return (
    <section className="relative overflow-hidden bg-primary text-white">
      <div
        className="pointer-events-none absolute -left-24 top-[-4rem] h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-[-5rem] h-80 w-80 rounded-full bg-mist/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Guided product review</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">See the workflow end to end.</h2>
          <p className="mt-5 max-w-xl text-white/80">
            Start in the read-only workspace, inspect sanitized case intelligence, then follow an invited
            case into Intercom to see the real operator experience and write-back.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-white hover:bg-[#459d8b]">
              Open reviewer workspace
            </Link>
            {intercomUrl ? (
              <a href={intercomUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/30 px-5 py-2.5 text-sm text-white hover:bg-white/10">
                Open invited Intercom workspace ↗
              </a>
            ) : (
              <Link href="/architecture" className="rounded-full border border-white/30 px-5 py-2.5 text-sm text-white hover:bg-white/10">
                View architecture
              </Link>
            )}
          </div>
          <p className="mt-4 text-xs text-white/55">Intercom access requires an individual workspace invitation.</p>
        </div>
      </div>
    </section>
  );
}
