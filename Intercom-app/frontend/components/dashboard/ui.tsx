import type { ReactNode } from 'react';
import { ProductJourney } from '../ProductJourney';

export type DashboardIconName = 'cases' | 'users' | 'link' | 'review' | 'activity' | 'shield' | 'store' | 'spark';

export function DashboardIcon({ name, className = 'h-5 w-5' }: { name: DashboardIconName; className?: string }) {
  const paths: Record<DashboardIconName, ReactNode> = {
    cases: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 8h5M18.5 5.5v5" /></>,
    link: <><circle cx="8" cy="12" r="3" /><circle cx="16" cy="12" r="3" /><path d="M11 12h2" /></>,
    review: <><path d="M12 3 14.3 8 20 10l-4.2 3.7L17 20l-5-2.7L7 20l1.2-6.3L4 10l5.7-2L12 3Z" /><path d="m9.5 12 1.7 1.7 3.5-3.5" /></>,
    activity: <><path d="M4 12h3l2-6 3.5 12 2-6H20" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.3-2.9 7.8-7 9-4.1-1.2-7-4.7-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    store: <><path d="M4 10h16v10H4zM3 10l2-5h14l2 5" /><path d="M8 10v10M16 10v10" /></>,
    spark: <><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" /></>
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-sm leading-6 text-muted md:text-base">{children}</p>;
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  icon = 'spark',
  meta = 'Protected workspace'
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: DashboardIconName;
  meta?: string;
}) {
  return (
    <section className="dashboard-hero reveal mb-6 overflow-hidden rounded-2xl text-white shadow-lift" aria-labelledby="dashboard-hero-title">
      <div className="relative z-10 flex flex-col justify-between gap-6 p-5 md:flex-row md:items-end md:p-7">
        <div className="flex items-start gap-4">
          <span className="dashboard-hero-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-emerald-200">
            <DashboardIcon name={icon} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">{eyebrow}</p>
            <h2 id="dashboard-hero-title" className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 md:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.12)]" />
          {meta}
        </span>
      </div>
      <div className="workspace-hero-journey"><ProductJourney compact /></div>
      <div aria-hidden="true" className="dashboard-hero-orbit dashboard-hero-orbit-one" />
      <div aria-hidden="true" className="dashboard-hero-orbit dashboard-hero-orbit-two" />
    </section>
  );
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
    <div role={tone === 'danger' ? 'alert' : undefined} className={`rounded-xl border px-5 py-4 ${tones[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
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
  icon,
  tone = 'default',
  delay = 0
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: DashboardIconName;
  tone?: 'default' | 'warning' | 'success';
  delay?: number;
}) {
  const display = typeof value === 'string' || typeof value === 'number' ? String(value) : value;
  const compact = typeof display === 'string' && display.length > 14;

  const toneClass = tone === 'warning' ? 'metric-warning' : tone === 'success' ? 'metric-success' : '';

  return (
    <div className={`dash-panel metric-card relative overflow-hidden ${toneClass}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon ? <span className="metric-icon" aria-hidden="true"><DashboardIcon name={icon} className="h-4 w-4" /></span> : null}
      </div>
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
  action,
  icon = 'spark'
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: DashboardIconName;
}) {
  return (
    <div className="empty-state rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-secondary shadow-sm"><DashboardIcon name={icon} /></span>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const kind =
    normalized === 'ready' || normalized === 'completed' || normalized === 'success' || normalized === 'healthy' || normalized === 'invited' || normalized === 'approved'
      ? 'status-completed'
      : normalized === 'failed' || normalized === 'error' || normalized === 'declined' || normalized === 'revoked'
        ? 'status-failed'
        : normalized === 'processing' || normalized === 'active' || normalized === 'degraded'
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
