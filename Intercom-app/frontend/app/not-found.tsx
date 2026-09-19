import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <section className="w-full max-w-lg rounded-3xl border border-primary/10 bg-white p-8 text-center shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">404 · Not found</p>
        <h1 className="mt-3 text-2xl font-semibold text-primary">The requested page does not exist</h1>
        <p className="mt-3 text-sm leading-6 text-muted">The link may be outdated, or the resource may no longer be available.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold">Return home</Link>
      </section>
    </main>
  );
}
