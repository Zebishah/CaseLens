import { jest } from '@jest/globals';

const mockFindByStoreNumber = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindIdentitiesLinkedAtStoreConversations = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string }>>
>();
const mockFindByCompanyDomain = jest.fn<() => Promise<Array<{ id: number; canonicalName: string }>>>();
const mockFindIdentitiesLinkedAtCompanyDomainConversations = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string }>>
>();
const mockFindByCanonicalName = jest.fn<() => Promise<{ id: number; canonicalName: string } | undefined>>();
const mockFindFuzzyByCanonicalName = jest.fn<
  () => Promise<Array<{ id: number; canonicalName: string; similarity: number }>>
>();
const mockFindById = jest.fn<() => Promise<Record<string, unknown> | undefined>>();

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findByStoreNumber: mockFindByStoreNumber,
    findIdentitiesLinkedAtStoreConversations: mockFindIdentitiesLinkedAtStoreConversations,
    findByCompanyDomain: mockFindByCompanyDomain,
    findIdentitiesLinkedAtCompanyDomainConversations: mockFindIdentitiesLinkedAtCompanyDomainConversations,
    findByCanonicalName: mockFindByCanonicalName,
    findFuzzyByCanonicalName: mockFindFuzzyByCanonicalName
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById
  }
}));

const { enrichPossibleSamePersonHints } = await import(
  '../../../src/modules/employee/employee.possible-match-enrichment.util.js'
);

describe('employee.possible-match-enrichment.util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByStoreNumber.mockResolvedValue([{ id: 99, canonicalName: 'Cooper Salt' }]);
    mockFindIdentitiesLinkedAtStoreConversations.mockResolvedValue([]);
    mockFindByCompanyDomain.mockResolvedValue([]);
    mockFindIdentitiesLinkedAtCompanyDomainConversations.mockResolvedValue([]);
    mockFindByCanonicalName.mockResolvedValue(undefined);
    mockFindFuzzyByCanonicalName.mockResolvedValue([]);
  });

  it('suggests names from related tickets when the store roster has no Mike employees', async () => {
    mockFindById.mockResolvedValue({
      id: 3055,
      extractedNames: ['Mike J.']
    });

    const hints = await enrichPossibleSamePersonHints({
      conversation: {
        id: 3053,
        reporterName: 'dd1976demoops',
        reporterEmail: 'dd1976@demoops.co',
        extractedNames: ['Mike John']
      } as never,
      mentionedInReport: ['Mike John'],
      employeeMatches: [],
      existingHints: [],
      relatedCases: [
        {
          conversationId: 3055,
          intercomId: 'related-mike-j',
          subject: 'Mike J. attendance serious concerns',
          caseType: 'attendance',
          matchedEmployeeNames: ['Mike J.'],
          reporterName: 'dd1976demoops',
          status: 'open',
          advisorName: null,
          createdAt: '2026-07-02T00:00:00.000Z'
        }
      ]
    });

    expect(hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalName: 'Mike J.',
          confidenceScore: expect.any(Number)
        })
      ])
    );
    expect(hints[0]?.confidenceScore).toBeGreaterThanOrEqual(60);
  });

  it('adds company-domain roster hints when the store roster has no near matches', async () => {
    mockFindByStoreNumber.mockResolvedValue([{ id: 99, canonicalName: 'Cooper Salt' }]);
    mockFindByCompanyDomain.mockResolvedValue([
      { id: 12, canonicalName: 'Mike Smith' },
      { id: 13, canonicalName: 'Mike Ross' }
    ]);
    mockFindIdentitiesLinkedAtCompanyDomainConversations.mockResolvedValue([
      { id: 14, canonicalName: 'Mike Johnson' }
    ]);

    const hints = await enrichPossibleSamePersonHints({
      conversation: {
        id: 3053,
        reporterName: 'dd1976demoops',
        reporterEmail: 'dd1976@demoops.co',
        extractedNames: ['Mike John']
      } as never,
      mentionedInReport: ['Mike John'],
      employeeMatches: [],
      existingHints: [],
      relatedCases: []
    });

    expect(hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: 'Mike Smith' }),
        expect.objectContaining({ canonicalName: 'Mike Ross' }),
        expect.objectContaining({ canonicalName: 'Mike Johnson' })
      ])
    );
  });
});
