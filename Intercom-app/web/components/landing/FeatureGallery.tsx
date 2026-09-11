const features = [
  {
    title: 'Case intelligence',
    copy: 'Extract category, employee names, and review flags from the opening message.',
    detail: 'The same intelligence path is used for sample cases and custom cases.',
    wide: true,
    panel: (
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white px-4 py-3">
          <dt className="text-xs text-muted">Category</dt>
          <dd className="mt-1 font-medium text-primary">attendance</dd>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <dt className="text-xs text-muted">Employee</dt>
          <dd className="mt-1 font-medium text-primary">Jordan Hale</dd>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <dt className="text-xs text-muted">Manual review</dt>
          <dd className="mt-1 font-medium text-primary">No</dd>
        </div>
      </dl>
    )
  },
  {
    title: 'Identity resolution',
    copy: 'Match extracted names against the directory with confidence and store context from the sender.',
    detail: 'Exact, alias, fuzzy, and token matching already in the backend.',
    wide: false,
    panel: (
      <div>
        <p className="text-sm font-semibold text-primary">Employee found</p>
        <p className="mt-1 text-xs text-muted">High confidence · 1042 · northwind.co</p>
      </div>
    )
  },
  {
    title: 'Related case discovery',
    copy: 'Surface prior conversations for the same employee and category.',
    detail: 'Scoped search window and dismissal support in the product snapshot.',
    wide: false,
    panel: (
      <ol className="space-y-2 text-sm">
        <li className="border-l-2 border-secondary pl-3">Attendance — Jordan Hale</li>
        <li className="border-l-2 border-primary/30 pl-3 text-muted">Write-up follow-up</li>
      </ol>
    )
  },
  {
    title: 'Reliable ingestion',
    copy: 'Demo, inbound email, and Intercom normalize into one case event. Duplicates are rejected.',
    detail: 'Duplicate submissions are rejected so the same case is not processed twice.',
    wide: true,
    panel: (
      <p className="text-sm leading-6 text-muted">
        Demo, email, or Intercom all become one case record, then processing starts.
      </p>
    )
  },
  {
    title: 'Human feedback',
    copy: 'Store a rating and comment on a processed case. Corrections exist on the admin case API.',
    detail: 'Demo feedback is scoped to the session token.',
    wide: false,
    panel: <p className="text-sm text-muted">Rating: accurate · comment stored on the review row.</p>
  },
  {
    title: 'Operational visibility',
    copy: 'Administrators can inspect operations; reviewers can use the public walkthrough without an account.',
    detail: 'Evaluation and demo sessions remain available without admin login.',
    wide: false,
    panel: (
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Demo</dt>
          <dd>Public session</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Operations</dt>
          <dd>Admin JWT</dd>
        </div>
      </dl>
    )
  }
];

export function FeatureGallery() {
  return (
    <section className="relative bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <p className="text-sm font-medium tracking-[0.18em] text-secondary">Capabilities</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-primary md:text-5xl">
          Capabilities already in the product.
        </h2>
        <p className="mt-4 max-w-xl text-muted">
          Each block is a real capability already in the backend. Copy stays short so the UI can show
          the work.
        </p>
        <div className="mt-12 columns-1 gap-5 md:columns-2">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`mb-5 break-inside-avoid bg-white p-6 shadow-lift ${
                index % 2 === 0 ? 'card-asymmetric' : 'card-asymmetric-alt'
              } ${feature.wide ? 'md:p-8' : ''}`}
            >
              <p className="font-mono text-[11px] text-secondary">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-2 text-xl font-semibold text-primary">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{feature.copy}</p>
              <div className="mt-5 rounded-[1.4rem] bg-paper p-4">{feature.panel}</div>
              <p className="mt-3 text-xs text-muted">{feature.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
