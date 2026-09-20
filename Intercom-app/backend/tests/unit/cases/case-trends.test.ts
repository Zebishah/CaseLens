import { describe, expect, test } from '@jest/globals';
import { mergeTrendRows, trendWindow } from '../../../src/modules/cases/case-trends.js';

describe('case trends', () => {
  const now = new Date('2026-09-20T15:30:00.000Z');

  test('builds deterministic zero-filled buckets for a valid range', () => {
    const result = mergeTrendRows('7d', {
      cases: [{ date: '2026-09-18', total: 4 }],
      completed: [{ date: '2026-09-18', total: 3 }],
      failed: [{ date: '2026-09-19', total: 1 }]
    }, now);

    expect(result.startDate).toBe('2026-09-14');
    expect(result.endDate).toBe('2026-09-20');
    expect(result.buckets).toHaveLength(7);
    expect(result.buckets[4]).toEqual({ date: '2026-09-18', casesCreated: 4, completed: 3, failed: 0 });
    expect(result.buckets[5]).toEqual({ date: '2026-09-19', casesCreated: 0, completed: 0, failed: 1 });
  });

  test('returns an empty but complete window when no records exist', () => {
    const result = mergeTrendRows('30d', { cases: [], completed: [], failed: [] }, now);

    expect(result.buckets).toHaveLength(30);
    expect(result.buckets.every((bucket) => bucket.casesCreated === 0 && bucket.completed === 0 && bucket.failed === 0)).toBe(true);
  });

  test('bounds range windows to the supported options', () => {
    expect(trendWindow('90d', now).start.toISOString()).toBe('2026-06-23T00:00:00.000Z');
    expect(() => trendWindow('14d' as never, now)).toThrow();
  });
});
