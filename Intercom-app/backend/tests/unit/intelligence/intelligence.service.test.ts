import { jest } from '@jest/globals';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';

const mockFindRelatedCasesByMentionedNames = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindFuzzyRelatedCases = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindCasesByCaseType = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindPossibleSamePerson = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockEnrichMatches = jest.fn<(matches: Array<Record<string, unknown>>) => Promise<Array<Record<string, unknown>>>>();
const mockUpdateIntelligence = jest.fn<() => Promise<Record<string, unknown>>>();
const mockFindById = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockFindByConversationId = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindAliasesByEmployeeIdentityIds = jest.fn<() => Promise<Array<{ alias: string }>>>();
const mockFindByStoreNumber = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindByCompanyDomain = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindByCanonicalName = jest.fn<() => Promise<Record<string, unknown> | undefined>>();
const mockFindFuzzyByCanonicalName = jest.fn<() => Promise<Array<Record<string, unknown>>>>();

await jest.unstable_mockModule('../../../src/modules/employee/employee.repository.js', () => ({
  employeeRepository: {
    findAliasesByEmployeeIdentityIds: mockFindAliasesByEmployeeIdentityIds,
    findAll: jest.fn(async () => []),
    findByStoreNumber: mockFindByStoreNumber,
    findByCompanyDomain: mockFindByCompanyDomain,
    findIdentitiesLinkedAtStoreConversations: jest.fn(async () => []),
    findIdentitiesLinkedAtCompanyDomainConversations: jest.fn(async () => []),
    findByCanonicalName: mockFindByCanonicalName,
    findFuzzyByCanonicalName: mockFindFuzzyByCanonicalName
  }
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/related.retrieval.service.js', () => ({
  relatedRetrievalService: {
    findRelatedCasesByMentionedNames: mockFindRelatedCasesByMentionedNames,
    findFuzzyRelatedCases: mockFindFuzzyRelatedCases,
    findCasesByCaseType: mockFindCasesByCaseType
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    updateIntelligence: mockUpdateIntelligence,
    findById: mockFindById
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation-employees.repository.js', () => ({
  conversationEmployeesRepository: {
    findByConversationId: mockFindByConversationId
  }
}));

await jest.unstable_mockModule('../../../src/modules/employee/employee.possible-match.service.js', () => ({
  possibleMatchService: {
    findPossibleSamePerson: mockFindPossibleSamePerson
  }
}));

await jest.unstable_mockModule('../../../src/modules/employee/employee.name-variant.service.js', () => ({
  employeeNameVariantService: {
    enrichMatches: mockEnrichMatches
  }
}));

const mockResolveForStoreNumber = jest.fn<() => Promise<Record<string, unknown>>>();

await jest.unstable_mockModule('../../../src/modules/store-directory/cc-recipients.service.js', () => ({
  ccRecipientsService: {
    resolveForStoreNumber: mockResolveForStoreNumber
  }
}));

await jest.unstable_mockModule(
  '../../../src/modules/intelligence/related-case-summary.service.js',
  () => ({
    relatedCaseSummaryService: {
      attachSummaries: async (cases: Array<Record<string, unknown>>) => cases,
      summarizeOne: async () => null,
      clampSummaryText: (text: string) => text,
      buildSummaryPrompt: () => ''
    }
  })
);

const { intelligenceService } = await import(
  '../../../src/modules/intelligence/intelligence.service.js'
);

describe('intelligenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue(undefined);
    mockFindAliasesByEmployeeIdentityIds.mockResolvedValue([]);
    mockFindCasesByCaseType.mockResolvedValue([]);
    mockFindFuzzyRelatedCases.mockResolvedValue([]);
    mockFindRelatedCasesByMentionedNames.mockResolvedValue([
      {
        conversationId: 2,
        intercomId: 'seed-conv-001',
        subject: 'Attendance warning',
        caseType: 'attendance',
        matchedEmployeeNames: ['Jonathan Fritz'],
        reporterName: null,
        status: 'open',
        advisorName: 'Phoebe',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]);
    mockUpdateIntelligence.mockResolvedValue({});
    mockFindPossibleSamePerson.mockResolvedValue([]);
    mockEnrichMatches.mockImplementation(async (matches) => matches);
    mockFindByConversationId.mockResolvedValue([
      {
        employeeIdentityId: 1,
        extractedName: 'Syed Zohaib Haider'
      }
    ]);
    mockFindByStoreNumber.mockResolvedValue([]);
    mockFindByCompanyDomain.mockResolvedValue([]);
    mockFindByCanonicalName.mockResolvedValue(undefined);
    mockFindFuzzyByCanonicalName.mockResolvedValue([]);
    mockResolveForStoreNumber.mockResolvedValue({
      status: 'no_store',
      storeNumber: null,
      companyName: null,
      recipients: [],
      message: 'No store number — enter a store number to load CC recipients.'
    });
  });

  it('stores ready snapshot with employee matches and related cases', async () => {
    const employeeMatches = [
      {
        employeeIdentityId: 1,
        canonicalName: 'Jonathan Fritz',
        confidenceScore: 100,
        matchMethod: 'exact'
      }
    ];

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: 10,
      employeeMatches,
      searchTerms: ['Jonathan Fritz'],
      extractedNames: ['Jonathan Fritz'],
      caseTypeFilter: 'attendance'
    });

    expect(mockFindRelatedCasesByMentionedNames).toHaveBeenCalledWith({
      employeeIdentityIds: [1],
      searchTerms: expect.arrayContaining(['Jonathan Fritz', 'jonathan', 'fritz']),
      employeeNames: ['Jonathan Fritz'],
      nameBag: expect.objectContaining({
        fullNames: ['Jonathan Fritz'],
        tokens: expect.arrayContaining(['jonathan', 'fritz'])
      }),
      excludeConversationId: 10,
      limit: undefined,
      scope: null,
      refreshFromIntercom: false
    });
    expect(mockUpdateIntelligence).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: INTELLIGENCE_STATUS.READY,
        error: null,
        extractedNames: ['Jonathan Fritz']
      })
    );
    expect(snapshot.employeeMatches).toEqual(employeeMatches);
    expect(snapshot.relatedCases).toHaveLength(1);
    expect(snapshot.processedAt).toEqual(expect.any(String));
    expect(mockEnrichMatches).toHaveBeenCalledWith(employeeMatches, {
      reportExtractedNames: ['Jonathan Fritz']
    });
  });

  it('searches related cases by extracted name when the directory has no match', async () => {
    mockFindRelatedCasesByMentionedNames.mockResolvedValue([
      {
        conversationId: 18,
        intercomId: '215475747334934',
        subject: 'Braeden is talking shit in office and handling work badly',
        caseType: 'conduct',
        matchedEmployeeNames: ['Braeden'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-09-02T09:00:00.000Z'
      }
    ]);

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: 17,
      employeeMatches: [],
      searchTerms: ['Braden'],
      extractedNames: ['Braden'],
      caseTypeFilter: 'conduct',
      employeeMentionStatus: 'unresolved',
      unresolvedEmployeeMention: 'Braden'
    });

    expect(mockFindRelatedCasesByMentionedNames).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeIdentityIds: [],
        employeeNames: expect.arrayContaining(['Braden']),
        excludeConversationId: 17
      })
    );
    expect(mockFindFuzzyRelatedCases).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceNames: expect.arrayContaining(['Braden']),
        caseType: 'conduct',
        excludeConversationId: 17
      })
    );
    expect(snapshot.relatedCases).toHaveLength(1);
    expect(snapshot.unresolvedEmployeeMention).toBe('Braden');
  });

  it('includes close-spelling related cases in the main related list', async () => {
    mockFindRelatedCasesByMentionedNames.mockResolvedValue([]);
    mockFindFuzzyRelatedCases.mockResolvedValue([
      {
        conversationId: 52,
        intercomId: '215475752217701',
        subject: 'Attendance issue Darin Wakins',
        caseType: 'attendance',
        matchedEmployeeNames: ['Darin Wakins'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-09-02T10:00:00.000Z',
        fuzzyMatchScore: 86,
        fuzzyMatchedName: 'Darin Wakins',
        fuzzySharedTokens: ['watkins~wakins']
      }
    ]);

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: 53,
      employeeMatches: [],
      searchTerms: ['Watkins'],
      extractedNames: ['Watkins'],
      caseTypeFilter: 'misconduct'
    });

    expect(snapshot.relatedCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intercomId: '215475752217701',
          subject: 'Attendance issue Darin Wakins'
        })
      ])
    );
  });

  it('stores category-wide cases for the open conversation case type', async () => {
    mockFindCasesByCaseType.mockResolvedValue([
      {
        conversationId: 11,
        intercomId: 'attendance-other',
        subject: 'Attendance issue for Jane Doe',
        caseType: 'attendance',
        matchedEmployeeNames: ['Jane Doe'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-01-02T00:00:00.000Z'
      }
    ]);

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: 10,
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'John Smith',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      searchTerms: ['John Smith'],
      caseTypeFilter: 'attendance'
    });

    expect(mockFindCasesByCaseType).toHaveBeenCalledWith({
      caseType: 'attendance',
      excludeConversationId: 10,
      limit: undefined,
      scope: null,
      refreshFromIntercom: false
    });
    expect(snapshot.categoryCases).toHaveLength(1);
    expect(snapshot.categoryCases?.[0]?.matchedEmployeeNames).toEqual(['Jane Doe']);
  });

  it('includes stored aliases when searching related cases', async () => {
    mockFindAliasesByEmployeeIdentityIds.mockResolvedValue([{ alias: 'Jon Smith' }]);

    await intelligenceService.storeReadySnapshot({
      conversationId: 10,
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'John Smith',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      searchTerms: ['John Smith'],
      extractedNames: ['John Smith'],
      caseTypeFilter: 'attendance'
    });

    expect(mockFindRelatedCasesByMentionedNames).toHaveBeenCalledWith({
      employeeIdentityIds: [1],
      searchTerms: expect.arrayContaining(['John Smith', 'Jon Smith', 'john', 'smith', 'jon']),
      employeeNames: expect.arrayContaining(['John Smith', 'Jon Smith']),
      nameBag: expect.objectContaining({
        fullNames: expect.arrayContaining(['John Smith', 'Jon Smith'])
      }),
      excludeConversationId: 10,
      limit: undefined,
      scope: null,
      refreshFromIntercom: false
    });
  });

  it('keeps related cases for the same employee across case categories (category filter paused)', async () => {
    mockFindRelatedCasesByMentionedNames.mockResolvedValue([
      {
        conversationId: 2,
        intercomId: 'conduct-case',
        subject: 'Conduct issue',
        caseType: 'conduct',
        matchedEmployeeNames: ['Jonathan Fritz'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        conversationId: 3,
        intercomId: 'attendance-case',
        subject: 'Attendance issue',
        caseType: 'attendance',
        matchedEmployeeNames: ['Jonathan Fritz'],
        reporterName: null,
        status: 'open',
        advisorName: null,
        createdAt: '2026-01-02T00:00:00.000Z'
      }
    ]);

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: 10,
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Jonathan Fritz',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      searchTerms: ['Jonathan Fritz'],
      caseTypeFilter: 'conduct'
    });

    // TEMP (Amber test): category match paused — both same-employee cases stay related.
    expect(snapshot.relatedCases).toHaveLength(2);
    expect(snapshot.relatedCases.map((relatedCase) => relatedCase.caseType).sort()).toEqual([
      'attendance',
      'conduct'
    ]);
  });

  it('buildLiveCanvasSnapshot refreshes related cases from the database', async () => {
    const storedSnapshot = {
      employeeMatches: [
        {
          employeeIdentityId: 1,
          canonicalName: 'Syed Zohaib Haider',
          confidenceScore: 100,
          matchMethod: 'exact'
        }
      ],
      relatedCases: [],
      processedAt: '2026-06-08T09:00:00.000Z'
    };

    mockFindRelatedCasesByMentionedNames.mockResolvedValue([
      {
        conversationId: 8,
        intercomId: '215474625282882',
        subject: 'attendance issue',
        caseType: 'attendance',
        advisorName: null,
        createdAt: '2026-06-09T12:00:00.000Z'
      },
      {
        conversationId: 9,
        intercomId: '215474625302415',
        subject: 'ethics issue',
        caseType: 'general',
        advisorName: null,
        createdAt: '2026-06-09T12:01:00.000Z'
      }
    ]);

    mockFindPossibleSamePerson.mockResolvedValue([
      {
        employeeIdentityId: 5,
        canonicalName: 'Zohaib shah',
        confidenceScore: 75,
        matchMethod: 'token',
        sharedTokens: ['zohaib']
      }
    ]);

    const snapshot = await intelligenceService.buildLiveCanvasSnapshot({
      id: 7,
      employeeIdentityId: 1,
      subject: 'Attendance warning',
      caseType: 'attendance',
      reporterName: 'Syed Zohaib Haider',
      reporterEmail: 'zebihaider123@gmail.com',
      extractedNames: ['Syed Zohaib Haider'],
      intelligenceSnapshot: storedSnapshot
    } as never);

    expect(mockFindRelatedCasesByMentionedNames).toHaveBeenCalledWith({
      employeeIdentityIds: [1],
      searchTerms: expect.arrayContaining(['Syed Zohaib Haider', 'syed', 'zohaib', 'haider']),
      employeeNames: ['Syed Zohaib Haider'],
      nameBag: expect.objectContaining({
        fullNames: ['Syed Zohaib Haider']
      }),
      excludeConversationId: 7,
      scope: null,
      refreshFromIntercom: true
    });
    expect(snapshot.employeeMatches).toEqual(storedSnapshot.employeeMatches);
    // TEMP: category filter paused — both same-employee related rows are kept.
    expect(snapshot.relatedCases).toHaveLength(2);
    expect(snapshot.relatedCases.map((relatedCase) => relatedCase.caseType).sort()).toEqual([
      'attendance',
      'general'
    ]);
    expect(snapshot.possibleSamePerson).toHaveLength(1);
    expect(mockFindPossibleSamePerson).toHaveBeenCalledWith({
      contactName: 'Syed Zohaib Haider',
      contactEmail: null,
      excludeEmployeeIdentityId: 1
    });
    expect(snapshot.processedAt).toBe(storedSnapshot.processedAt);
  });

  it('enriches stored snapshot with possible matches from linked conversation employees', async () => {
    mockFindByConversationId.mockResolvedValue([
      {
        employeeIdentityId: 12,
        extractedName: 'Ryan Lollins'
      }
    ]);
    mockFindPossibleSamePerson.mockResolvedValue([
      {
        employeeIdentityId: 9,
        canonicalName: 'Ryan Burke',
        confidenceScore: 50,
        matchMethod: 'token',
        sharedTokens: ['ryan']
      },
      {
        employeeIdentityId: 15,
        canonicalName: 'Ryan Attendanace',
        confidenceScore: 50,
        matchMethod: 'token',
        sharedTokens: ['ryan']
      }
    ]);

    const enriched = await intelligenceService.enrichSnapshotForCanvasDisplay(
      {
        id: 7,
        reporterName: '10206demoops',
        reporterEmail: '10206@demoops.co'
      } as never,
      {
        mentionedInReport: ['Ryan Lollins'],
        employeeMatches: [
          {
            employeeIdentityId: 12,
            canonicalName: 'Ryan Lollins',
            confidenceScore: 100,
            matchMethod: 'exact'
          }
        ],
        relatedCases: [],
        processedAt: '2026-07-01T00:00:00.000Z'
      }
    );

    expect(mockFindPossibleSamePerson).toHaveBeenCalledWith({
      contactName: 'Ryan Lollins',
      contactEmail: null,
      excludeEmployeeIdentityId: 12
    });
    expect(enriched.possibleSamePerson).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: 'Ryan Burke' }),
        expect.objectContaining({ canonicalName: 'Ryan Attendanace' })
      ])
    );
  });

  it('marks conversation intelligence as failed and stores attempt metadata', async () => {
    await intelligenceService.markFailed(10, 'boom', { messageCount: 3 });

    expect(mockUpdateIntelligence).toHaveBeenCalledWith(10, {
      status: INTELLIGENCE_STATUS.FAILED,
      snapshot: expect.objectContaining({
        employeeMatches: [],
        relatedCases: [],
        messageCount: 3,
        failureAttempts: 1
      }),
      error: 'boom'
    });
  });
});
