import type { ReactNode } from 'react';

export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="reveal max-w-2xl text-sm leading-6 text-muted md:text-base">{children}</p>;
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
    danger: 'border-danger/30 bg-danger/8 text-danger',
    warning: 'border-highlight/30 bg-highlight/10 text-primary',
    success: 'border-success/30 bg-success/10 text-success',
    info: 'border-primary/15 bg-white text-primary'
  };

  return (
    <div className={`reveal rounded-2xl border px-5 py-4 ${tones[tone]}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
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
    <div
      className="reveal dash-panel relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`relative mt-3 font-semibold tracking-tight text-primary ${compact ? 'text-xl leading-snug' : 'text-4xl tabular-nums'}`}>
        {value}
      </p>
      {hint ? <p className="relative mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = ''
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`reveal dash-panel ${className}`}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold text-primary">{title}</h2> : <span />}
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
    <div className="rounded-2xl border border-dashed border-primary/20 bg-paper px-6 py-10 text-center">
      <p className="font-semibold text-primary">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p> : null}
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

export function SkeletonGrid({ count = 4, className = 'md:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`} aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/80" />
      ))}
    </div>
  );
}

export function TextButton({
  children,
  onClick
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="text-sm font-medium text-primary hover:text-primary-hover" onClick={onClick}>
      {children}
    </button>
  );
}
