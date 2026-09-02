import { getRelatedCaseCreatedAfterDate } from '../../../src/modules/intelligence/related-case-window.util.js';

describe('getRelatedCaseCreatedAfterDate', () => {
  it('returns a date six months before the reference time', () => {
    const now = new Date('2026-06-12T12:00:00.000Z');
    const cutoff = getRelatedCaseCreatedAfterDate(now);

    expect(cutoff.toISOString()).toBe('2025-12-12T12:00:00.000Z');
  });
});
