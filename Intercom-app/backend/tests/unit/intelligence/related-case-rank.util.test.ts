import { rankRelatedCases } from '../../../src/modules/intelligence/related-case-rank.util.js';
import type { IntelligenceRelatedCase } from '../../../src/types/intelligence.types.js';

const relatedCase = (
  overrides: Partial<IntelligenceRelatedCase>
): IntelligenceRelatedCase => ({
  conversationId: 2,
  intercomId: '99',
  subject: 'Prior attendance for Ayesha Khan',
  caseType: 'attendance',
  matchedEmployeeNames: ['Ayesha Khan'],
  reporterName: null,
  status: 'closed',
  advisorName: null,
  createdAt: new Date().toISOString(),
  ...overrides
});

describe('rankRelatedCases', () => {
  it('does not treat same-employee-only history as closely related', () => {
    const ranked = rankRelatedCases({
      relatedCases: [relatedCase({ caseType: 'payroll', subject: 'Paycheck question', createdAt: '2025-01-01T00:00:00.000Z' })],
      caseType: 'attendance',
      topicTerms: ['attendance', 'absence']
    });

    expect(ranked[0]?.relationshipGroup).toBe('employee_history');
    expect(ranked[0]?.relationshipEvidence).toEqual([
      'Same employee',
      'Different category: payroll'
    ]);
  });

  it('marks same employee plus category/topic as closely related', () => {
    const ranked = rankRelatedCases({
      relatedCases: [relatedCase({})],
      caseType: 'attendance',
      topicTerms: ['attendance', 'absence']
    });

    expect(ranked[0]?.relationshipGroup).toBe('closely_related');
    expect(ranked[0]?.relationshipEvidence).toEqual(
      expect.arrayContaining([
        'Same employee',
        'Same category: attendance',
        'Shared topic: attendance'
      ])
    );
  });

  it('returns an empty list when there is no resolved employee history', () => {
    expect(
      rankRelatedCases({
        relatedCases: [],
        caseType: 'general',
        topicTerms: ['test']
      })
    ).toEqual([]);
  });
});
