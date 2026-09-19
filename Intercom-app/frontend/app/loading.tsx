export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6" aria-live="polite">
      <div className="w-full max-w-md rounded-3xl border border-primary/10 bg-white p-8 text-center shadow-lift">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-mist border-t-secondary" />
        <h1 className="mt-5 text-lg font-semibold text-primary">Loading HR Intelligence</h1>
        <p className="mt-2 text-sm text-muted">Preparing the requested workspace and case evidence.</p>
      </div>
    </main>
  );
}
