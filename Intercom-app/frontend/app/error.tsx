'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Unexpected error</p>
        <h1 className="mt-3 text-2xl font-semibold text-primary">This view could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Your data was not changed. Retry the request, or return to the overview if the problem continues.</p>
        <button type="button" onClick={reset} className="btn-primary mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold">Try again</button>
      </section>
    </main>
  );
}
