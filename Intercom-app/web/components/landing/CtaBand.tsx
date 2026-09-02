import Link from 'next/link';

export function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-primary text-white">
      <div
        className="pointer-events-none absolute -left-24 top-[-4rem] h-72 w-72 rounded-full bg-secondary/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-[-5rem] h-80 w-80 rounded-full bg-mist/30"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">See the workflow end to end.</h2>
          <p className="mt-5 max-w-xl text-white/80">
            Sign in to the operator workspace and inspect how the system resolves identity, related
            cases, stakeholders, and intelligence on real seeded cases.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-white hover:bg-[#459d8b]">
              Sign in
            </Link>
            <Link
              href="/architecture"
              className="rounded-full border border-white/30 px-5 py-2.5 text-sm text-white hover:bg-white/10"
            >
              View Architecture
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
