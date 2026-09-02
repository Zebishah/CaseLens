import type { ReactNode } from 'react';

export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-sm leading-6 text-muted md:text-base">{children}</p>;
}

export function AlertBanner({
  tone = 'danger',
  title,
  children,
  action
}: {
  tone?: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    danger: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-900'
  };

  return (
    <div className={`rounded-xl border px-5 py-4 ${tones[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{title}</p>
          {children ? <div className="mt-1 text-sm leading-6 opacity-80">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  delay = 0
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delay?: number;
}) {
  const display = typeof value === 'string' || typeof value === 'number' ? String(value) : value;
  const compact = typeof display === 'string' && display.length > 14;

  return (
    <div className="dash-panel relative overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className={`relative mt-3 font-semibold tracking-tight text-slate-900 ${compact ? 'text-xl leading-snug' : 'text-3xl tabular-nums'}`}>
        {value}
      </p>
      {hint ? <p className="relative mt-2 text-sm leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = ''
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dash-panel ${className}`}>
      {title || action ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <span className="mx-auto block h-2 w-2 rounded-full bg-slate-300" />
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const kind =
    normalized === 'ready' || normalized === 'completed' || normalized === 'success'
      ? 'status-completed'
      : normalized === 'failed' || normalized === 'error'
        ? 'status-failed'
        : normalized === 'processing'
          ? 'status-processing'
          : 'status-queued';
  const label =
    normalized === 'ready'
      ? 'Ready'
      : normalized === 'pending'
        ? 'Pending'
        : normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${kind}`}>{label}</span>;
}

function Bone({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function PageSkeleton({
  variant = 'table'
}: {
  variant?: 'overview' | 'table' | 'detail' | 'directory';
}) {
  if (variant === 'detail') {
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-label="Loading page">
        <div className="dash-panel space-y-4">
          <Bone className="h-4 w-24" /><Bone className="h-7 w-4/5" /><Bone className="h-32 w-full" />
        </div>
        <div className="dash-panel space-y-4">
          <Bone className="h-4 w-28" /><Bone className="h-16 w-full" /><Bone className="h-16 w-full" /><Bone className="h-20 w-full" />
        </div>
        <div className="dash-panel space-y-4 lg:col-span-2"><Bone className="h-4 w-32" /><Bone className="h-24 w-full" /></div>
      </div>
    );
  }

  if (variant === 'overview' || variant === 'directory') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading page">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dash-panel space-y-3"><Bone className="h-3 w-24" /><Bone className="h-9 w-16" /><Bone className="h-3 w-4/5" /></div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="dash-panel space-y-4 lg:col-span-3"><Bone className="h-4 w-36" /><Bone className="h-3 w-full" /><Bone className="h-3 w-11/12" /><Bone className="h-3 w-4/5" /></div>
          <div className="dash-panel space-y-4 lg:col-span-2"><Bone className="h-4 w-32" /><Bone className="h-3 w-full" /><Bone className="h-3 w-3/4" /><Bone className="h-3 w-5/6" /></div>
        </div>
        <TableBones />
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <div className="dash-panel flex gap-3"><Bone className="h-11 flex-1" /><Bone className="h-11 w-40" /><Bone className="h-11 w-28" /></div>
      <TableBones />
    </div>
  );
}

function TableBones() {
  return (
    <div className="dash-panel overflow-hidden !p-0">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><Bone className="h-3 w-44" /></div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-6 px-5 py-4">
            <Bone className="h-4 w-full" /><Bone className="h-4 w-4/5" /><Bone className="h-4 w-3/5" /><Bone className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, className = 'md:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`} aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="dash-panel h-32"><Bone className="h-full w-full" /></div>
      ))}
    </div>
  );
}

export function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="text-sm font-semibold text-primary hover:text-primary-hover" onClick={onClick}>{children}</button>;
}
