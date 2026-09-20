import { and, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { conversations } from '../../database/schema/conversations.js';
import { inboundEvents } from '../../database/schema/inbound_events.js';

export const TREND_RANGES = ['7d', '30d', '90d'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

const RANGE_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

export type TrendBucket = {
  date: string;
  casesCreated: number;
  completed: number;
  failed: number;
};

type TrendRow = { date: string; total: number };

export const trendWindow = (range: TrendRange, now = new Date()): { start: Date; end: Date } => {
  if (!Object.prototype.hasOwnProperty.call(RANGE_DAYS, range)) {
    throw new Error('Unsupported trend range');
  }
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range]);
  return { start, end };
};

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const dayExpression = (column: unknown) =>
  sql<string>`to_char(date_trunc('day', ${column} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;

const aggregateByDay = async (
  column: typeof conversations.createdAt | typeof inboundEvents.completedAt | typeof inboundEvents.failedAt,
  start: Date,
  end: Date
): Promise<TrendRow[]> => {
  const day = dayExpression(column);
  return db
    .select({ date: day, total: sql<number>`count(*)::int` })
    .from(column === conversations.createdAt ? conversations : inboundEvents)
    .where(and(gte(column, start), lt(column, end)))
    .groupBy(day)
    .orderBy(day);
};

export const mergeTrendRows = (
  range: TrendRange,
  rows: { cases: TrendRow[]; completed: TrendRow[]; failed: TrendRow[] },
  now = new Date()
): { range: TrendRange; startDate: string; endDate: string; buckets: TrendBucket[] } => {
  const window = trendWindow(range, now);
  const buckets = new Map<string, TrendBucket>();

  for (let cursor = new Date(window.start); cursor < window.end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = isoDay(cursor);
    buckets.set(date, { date, casesCreated: 0, completed: 0, failed: 0 });
  }

  const apply = (items: TrendRow[], key: keyof Omit<TrendBucket, 'date'>) => {
    for (const row of items) {
      const bucket = buckets.get(row.date);
      if (bucket) bucket[key] = Number(row.total);
    }
  };

  apply(rows.cases, 'casesCreated');
  apply(rows.completed, 'completed');
  apply(rows.failed, 'failed');

  return {
    range,
    startDate: isoDay(window.start),
    endDate: isoDay(new Date(window.end.getTime() - 86_400_000)),
    buckets: [...buckets.values()]
  };
};

export const caseTrendsRepository = {
  async get(range: TrendRange, now = new Date()) {
    const window = trendWindow(range, now);
    const [cases, completed, failed] = await Promise.all([
      aggregateByDay(conversations.createdAt, window.start, window.end),
      aggregateByDay(inboundEvents.completedAt, window.start, window.end),
      aggregateByDay(inboundEvents.failedAt, window.start, window.end)
    ]);

    return mergeTrendRows(range, { cases, completed, failed }, now);
  }
};
