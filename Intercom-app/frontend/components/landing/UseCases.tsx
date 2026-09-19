const scenarios = [
  {
    role: 'Store leadership',
    title: 'A late employee, again',
    pain: 'The report is a one-off message. Nobody can see last week’s coaching without searching mail.',
    outcome: 'Related attendance history appears on the same case before anyone replies.'
  },
  {
    role: 'HR reviewer',
    title: 'A name that does not quite match',
    pain: 'Jordan, J. Hale, and store 1042 look like three different people in a thread.',
    outcome: 'The directory match, confidence, and store context sit on the case file.'
  },
  {
    role: 'Operations',
    title: 'Who should be copied',
    pain: 'The case sits with whoever opened it. The district manager is not in the loop.',
    outcome: 'Recommended stakeholders are listed with role and routing, ready to review.'
  }
];

const comparison = [
  { before: 'Scattered emails and chat threads', after: 'One case record with a status' },
  { before: 'Guessing who the employee is', after: 'Matched identity with store context' },
  { before: 'No view of prior conversations', after: 'Related cases in the same category' },
  { before: 'Manual “who do I tell?”', after: 'Suggested stakeholders on the snapshot' }
];

export function UseCases() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-4">
        {scenarios.map((item, index) => (
          <article
            key={item.title}
            className={`bg-white p-5 shadow-lift md:p-6 ${
              index === 1 ? 'card-asymmetric-alt md:translate-x-4' : 'card-asymmetric'
            }`}
          >
            <p className="text-[11px] font-medium tracking-[0.16em] text-secondary">{item.role}</p>
            <h3 className="mt-2 text-lg font-semibold text-primary">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{item.pain}</p>
            <p className="mt-3 text-sm font-medium text-primary">{item.outcome}</p>
          </article>
        ))}
      </div>
      <aside className="rounded-[2rem] bg-white p-6 shadow-lift md:p-8">
        <p className="text-[11px] font-medium tracking-[0.18em] text-secondary">Inbox vs intelligence</p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-primary">What changes for the reviewer</h3>
        <p className="mt-3 text-sm leading-6 text-muted">
          The demo uses a sanitized attendance sample. The comparison is the product job, not a
          customer logo bar.
        </p>
        <div className="mt-8 overflow-hidden rounded-[1.4rem] border border-primary/10">
          <div className="grid grid-cols-2 bg-paper px-4 py-3 text-xs font-medium tracking-[0.12em] text-muted">
            <p>Before</p>
            <p>After</p>
          </div>
          {comparison.map((row) => (
            <div key={row.before} className="grid grid-cols-2 border-t border-primary/10 px-4 py-4 text-sm">
              <p className="pr-3 text-muted">{row.before}</p>
              <p className="font-medium text-primary">{row.after}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
