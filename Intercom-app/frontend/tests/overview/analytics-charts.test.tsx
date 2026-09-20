import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DistributionBars, TrendChart } from '../../components/dashboard/AnalyticsCharts';

describe('analytics charts', () => {
  it('renders distribution counts and percentages', () => {
    render(<DistributionBars ariaLabel="Category distribution" total={10} items={[{ label: 'Leave', count: 7 }, { label: 'Payroll', count: 3 }]} />);

    expect(screen.getByRole('list', { name: 'Category distribution' })).toBeInTheDocument();
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('7 · 70%')).toBeInTheDocument();
  });

  it('provides an accessible empty state for all-zero historical data', () => {
    render(<TrendChart title="Cases created" buckets={[{ date: '2026-09-20', casesCreated: 0 }]} series={[{ key: 'casesCreated', label: 'Cases created', color: '--secondary' }]} />);

    expect(screen.getByText('No historical trend is available for this range yet.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
