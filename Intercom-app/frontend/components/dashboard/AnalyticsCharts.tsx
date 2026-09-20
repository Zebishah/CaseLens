'use client';

export type DistributionDatum = {
  label: string;
  count: number;
  color?: string;
};

export type TrendBucket = {
  date: string;
  [key: string]: string | number;
};

export type TrendSeries = {
  key: string;
  label: string;
  color: string;
};

const formatDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export function DistributionBars({ items, total, ariaLabel }: { items: DistributionDatum[]; total: number; ariaLabel: string }) {
  if (items.length === 0) {
    return <p className="mt-8 text-sm text-muted">No data recorded yet.</p>;
  }

  return (
    <ul className="analytics-bars mt-5 space-y-3" aria-label={ariaLabel}>
      {items.map((item) => {
        const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-primary">{item.label}</span>
              <span className="tabular-nums text-muted">{item.count} · {percentage}%</span>
            </div>
            <div className="analytics-bar-track" aria-hidden="true">
              <div className={`analytics-bar-fill ${item.color ?? 'bg-secondary'}`} style={{ width: `${percentage}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TrendChart({ title, buckets, series, valueFormatter = (value) => String(value) }: { title: string; buckets: TrendBucket[]; series: TrendSeries[]; valueFormatter?: (value: number) => string }) {
  const values = series.flatMap((item) => buckets.map((bucket) => Number(bucket[item.key] ?? 0)));
  const maximum = Math.max(...values, 0);
  const hasData = maximum > 0;

  if (!hasData) {
    return (
      <div className="analytics-empty rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-sm text-muted">
        No historical trend is available for this range yet.
      </div>
    );
  }

  const width = 720;
  const height = 190;
  const plotLeft = 12;
  const plotRight = width - 12;
  const plotTop = 18;
  const plotBottom = height - 32;
  const x = (index: number) => plotLeft + (buckets.length <= 1 ? 0 : (index / (buckets.length - 1)) * (plotRight - plotLeft));
  const y = (value: number) => plotBottom - (value / maximum) * (plotBottom - plotTop);

  return (
    <div className="analytics-chart" aria-label={`${title} historical trend`}>
      <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>
        <title id={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>{title} historical trend</title>
        {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={plotLeft} x2={plotRight} y1={y(maximum * ratio)} y2={y(maximum * ratio)} className="analytics-grid-line" />)}
        {series.map((item) => {
          const points = buckets.map((bucket, index) => `${x(index)},${y(Number(bucket[item.key] ?? 0))}`).join(' ');
          return <polyline key={item.key} points={points} fill="none" stroke={`rgb(var(${item.color}))`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        <text x={plotLeft} y={height - 8} className="analytics-axis-label">{formatDate(buckets[0].date)}</text>
        <text x={plotRight} y={height - 8} textAnchor="end" className="analytics-axis-label">{formatDate(buckets[buckets.length - 1].date)}</text>
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((item) => <span key={item.key} className="inline-flex items-center gap-2"><span className="analytics-legend-dot" style={{ background: `rgb(var(${item.color}))` }} />{item.label}</span>)}
      </div>
      <ul className="sr-only">
        {buckets.map((bucket) => <li key={bucket.date}>{formatDate(bucket.date)}: {series.map((item) => `${item.label} ${valueFormatter(Number(bucket[item.key] ?? 0))}`).join(', ')}</li>)}
      </ul>
    </div>
  );
}
