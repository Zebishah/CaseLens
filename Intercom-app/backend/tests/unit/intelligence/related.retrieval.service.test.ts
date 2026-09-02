import { jest } from '@jest/globals';
import { INTERCOM_CASE_TYPES } from '../../../src/constants/intercom.constants.js';

const mockFindRelatedByEmployeeIdentity = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindRelatedByEmployeeIdentityIds = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindRelatedByMentionedNames = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindByCaseType = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindRecentForRelatedScan = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindMatchedEmployeeNamesInConversation = jest.fn<() => Promise<string[]>>();
const mockFindMentionsByEmployeeIdentityIds = jest.fn<
  () => Promise<Array<{ conversationId: number; employeeIdentityId: number; extractedName: string | null }>>
>();
const mockFindByIntercomIds = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockFindFirstMessageBodiesByConversationIds = jest.fn<
  () => Promise<Map<number, string>>
>();
const mockRefreshConversationsFromIntercom = jest.fn<() => Promise<void>>();
const mockGetAdmin = jest.fn<() => Promise<{ name?: string }>>();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findRelatedByEmployeeIdentity: mockFindRelatedByEmployeeIdentity,
    findRelatedByEmployeeIdentityIds: mockFindRelatedByEmployeeIdentityIds,
    findRelatedByMentionedNames: mockFindRelatedByMentionedNames,
    findByCaseType: mockFindByCaseType,
    findRecentForRelatedScan: mockFindRecentForRelatedScan,
    findMatchedEmployeeNamesInConversation: mockFindMatchedEmployeeNamesInConversation,
    findByIntercomIds: mockFindByIntercomIds,
    findFirstMessageBodiesByConversationIds: mockFindFirstMessageBodiesByConversationIds
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.service.js', () => ({
  conversationService: {
    refreshConversationsFromIntercom: mockRefreshConversationsFromIntercom
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation-employees.repository.js', () => ({
  conversationEmployeesRepository: {
    findMentionsByEmployeeIdentityIds: mockFindMentionsByEmployeeIdentityIds
  }
}));

await jest.unstable_mockModule('../../../src/modules/intercom/intercom.client.js', () => ({
  intercomClient: {
    getAdmin: mockGetAdmin
  }
}));

const { relatedRetrievalService } = await import(
  '../../../src/modules/intelligence/related.retrieval.service.js'
);

describe('relatedRetrievalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdmin.mockResolvedValue({ name: 'Crystal' });
    mockFindMatchedEmployeeNamesInConversation.mockResolvedValue([]);
    mockFindRelatedByEmployeeIdentityIds.mockResolvedValue([]);
    mockFindMentionsByEmployeeIdentityIds.mockResolvedValue([]);
    mockRefreshConversationsFromIntercom.mockResolvedValue(undefined);
    mockFindByIntercomIds.mockResolvedValue([]);
    mockFindFirstMessageBodiesByConversationIds.mockResolvedValue(new Map());
    mockFindRecentForRelatedScan.mockResolvedValue([]);
  });

  it('maps related conversations with case type and advisor name', async () => {
    const createdAt = new Date('2026-01-10T12:00:00.000Z');
    mockFindRelatedByEmployeeIdentity.mockResolvedValue([
      {
        id: 2,
        intercomId: 'seed-conv-001',
        subject: 'Misconduct — workplace behavior',
        assignedIntercomAdminId: null,
        rawPayload: {
          tags: [{ name: 'misconduct' }],
          assigned_admin: { name: 'Crystal' }
        },
        createdAt
      }
    ]);

    mockFindFirstMessageBodiesByConversationIds.mockResolvedValue(
      new Map([[2, '<p>Marc called out late for the third time this week</p>']])
    );

    const results = await relatedRetrievalService.findRelatedCases({
      employeeIdentityId: 1,
      excludeConversationId: 10
    });

    expect(mockFindRelatedByEmployeeIdentity).toHaveBeenCalledWith(1, 10, 20);
    expect(mockFindFirstMessageBodiesByConversationIds).toHaveBeenCalledWith([2]);
    expect(results[0]).toMatchObject({
      conversationId: 2,
      intercomId: 'seed-conv-001',
      subject: 'Misconduct — workplace behavior',
      caseType: INTERCOM_CASE_TYPES.MISCONDUCT,
      matchedEmployeeNames: [],
      advisorName: 'Crystal',
      createdAt: createdAt.toISOString(),
      previewText: 'Marc called out late for the third time this week'
    });
    expect(mockGetAdmin).not.toHaveBeenCalled();
  });

  it('fetches advisor name from Intercom API when payload has only admin id', async () => {
    const createdAt = new Date('2026-02-01T09:00:00.000Z');
    mockFindRelatedByEmployeeIdentity.mockResolvedValue([
      {
        id: 3,
        intercomId: 'conv-003',
        subject: 'Coaching check-in',
        assignedIntercomAdminId: 'admin-99',
        rawPayload: {},
        createdAt
      }
    ]);

    const results = await relatedRetrievalService.findRelatedCases({
      employeeIdentityId: 1,
      excludeConversationId: 10
    });

    expect(mockGetAdmin).toHaveBeenCalledWith('admin-99');
    expect(results[0]?.advisorName).toBe('Crystal');
    expect(results[0]?.caseType).toBe(INTERCOM_CASE_TYPES.COACHING);
  });

  it('finds related conversations by employee identity and mentioned names', async () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    mockFindRelatedByEmployeeIdentityIds.mockResolvedValue([
      {
        id: 7,
        intercomId: 'conv-007',
        subject: 'bad attendance - zebi',
        assignedIntercomAdminId: null,
        rawPayload: {},
        extractedNames: ['zubi shah'],
        caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
        reporterEmail: 'zubair-zahid@demoops.co',
        reporterCompanyDomain: 'demoops.co',
        reporterStoreNumber: null,
        createdAt
      }
    ]);
    mockFindRelatedByMentionedNames.mockResolvedValue([]);
    mockFindMentionsByEmployeeIdentityIds.mockResolvedValue([
      {
        conversationId: 7,
        employeeIdentityId: 42,
        extractedName: 'zubi shah'
      }
    ]);

    const results = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      employeeIdentityIds: [42],
      searchTerms: ['zebi shah', 'zubi shah', 'zebi', 'zubi', 'shah'],
      employeeNames: ['zebi shah', 'zubi shah'],
      nameBag: {
        fullNames: ['zebi shah', 'zubi shah'],
        tokens: ['zebi', 'zubi', 'shah']
      },
      excludeConversationId: 10,
      scope: { mode: 'domain', storeNumber: null, domain: 'demoops.co' }
    });

    expect(mockFindRelatedByEmployeeIdentityIds).toHaveBeenCalledWith([42], 10, 20, {
      scope: { mode: 'domain', storeNumber: null, domain: 'demoops.co' }
    });
    expect(mockFindRelatedByMentionedNames).toHaveBeenCalledWith(
      expect.arrayContaining(['zebi shah', 'zubi shah']),
      10,
      20,
      { scope: { mode: 'domain', storeNumber: null, domain: 'demoops.co' } }
    );
    expect(results[0]).toMatchObject({
      intercomId: 'conv-007',
      subject: 'bad attendance - zebi',
      caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
      matchedEmployeeNames: ['zubi shah']
    });
  });

  it('drops store tickets when related-case scope is domain-only', async () => {
    const createdAt = new Date('2026-03-01T10:00:00.000Z');
    mockFindRelatedByEmployeeIdentityIds.mockResolvedValue([
      {
        id: 8,
        intercomId: 'conv-008',
        subject: 'Lionel Attendance Warning',
        assignedIntercomAdminId: null,
        rawPayload: {},
        caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
        reporterEmail: 'dd1976@demoops.co',
        reporterStoreNumber: 'dd1976',
        reporterCompanyDomain: 'demoops.co',
        createdAt
      }
    ]);
    mockFindRelatedByMentionedNames.mockResolvedValue([]);

    const results = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      employeeIdentityIds: [42],
      searchTerms: ['Lionel'],
      excludeConversationId: 10,
      scope: { mode: 'domain', storeNumber: null, domain: 'demoops.co' }
    });

    expect(results).toEqual([]);
  });

  it('searches related cases by mentioned name when there is no directory identity', async () => {
    mockFindRelatedByMentionedNames.mockResolvedValue([
      {
        id: 4,
        intercomId: 'conv-004',
        subject: 'Braden is talking shit in office and handling work badly',
        assignedIntercomAdminId: null,
        rawPayload: {},
        extractedNames: ['Braden'],
        createdAt: new Date('2026-03-01T10:00:00.000Z')
      }
    ]);

    const results = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      searchTerms: ['Braden'],
      employeeNames: ['Braden'],
      nameBag: { fullNames: ['Braden'], tokens: ['braden'] },
      excludeConversationId: 10
    });

    expect(mockFindRelatedByEmployeeIdentityIds).not.toHaveBeenCalled();
    expect(mockFindRelatedByMentionedNames).toHaveBeenCalledWith(
      ['Braden'],
      10,
      20,
      { scope: null }
    );
    expect(results[0]).toMatchObject({
      intercomId: 'conv-004',
      matchedEmployeeNames: ['Braden']
    });
  });

  it('finds conversations by case category for any employee', async () => {
    mockFindByCaseType.mockResolvedValue([
      {
        id: 6,
        intercomId: 'conv-006',
        subject: 'Attendance warning for Jane Doe',
        assignedIntercomAdminId: null,
        rawPayload: {},
        extractedNames: ['Jane Doe'],
        caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
        createdAt: new Date('2026-03-02T10:00:00.000Z')
      }
    ]);

    const results = await relatedRetrievalService.findCasesByCaseType({
      caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
      excludeConversationId: 10
    });

    expect(mockFindByCaseType).toHaveBeenCalledWith(INTERCOM_CASE_TYPES.ATTENDANCE, 10, 20, {
      scope: null
    });
    expect(results[0]).toMatchObject({
      intercomId: 'conv-006',
      caseType: INTERCOM_CASE_TYPES.ATTENDANCE,
      matchedEmployeeNames: ['Jane Doe']
    });
  });

  it('finds spelling-variant related cases across different case types', async () => {
    mockFindRecentForRelatedScan.mockResolvedValue([
      {
        id: 52,
        intercomId: 'conv-wakins',
        subject: 'Attendance issue Darin Wakins',
        assignedIntercomAdminId: null,
        rawPayload: {},
        extractedNames: ['Darin Wakins'],
        caseType: 'attendance',
        createdAt: new Date('2026-03-02T10:00:00.000Z')
      }
    ]);

    const results = await relatedRetrievalService.findFuzzyRelatedCases({
      sourceNames: ['Watkins'],
      searchTerms: ['Watkins'],
      nameBag: { fullNames: ['Watkins'], tokens: ['watkins'] },
      excludeConversationId: 53,
      caseType: 'misconduct'
    });

    expect(mockFindByCaseType).not.toHaveBeenCalled();
    expect(mockFindRecentForRelatedScan).toHaveBeenCalledWith(53, 60, { scope: null });
    expect(results[0]).toMatchObject({
      intercomId: 'conv-wakins',
      fuzzyMatchedName: 'Darin Wakins'
    });
  });

  it('handles createdAt as ISO string from raw SQL search results', async () => {
    mockFindRelatedByEmployeeIdentityIds.mockResolvedValue([
      {
        id: 5,
        intercomId: 'conv-005',
        subject: 'Mention of Miyabi Nagumo',
        assignedIntercomAdminId: null,
        rawPayload: {},
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    ]);

    const results = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      employeeIdentityIds: [5],
      searchTerms: ['Miyabi Nagumo'],
      excludeConversationId: 10
    });

    expect(results[0]?.createdAt).toBe('2026-03-01T10:00:00.000Z');
  });
});
