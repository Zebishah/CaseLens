import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { INTELLIGENCE_STATUS } from '../../../src/constants/intelligence.constants.js';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
const mockConversation = {
  id: 115,
  intercomId: 'safe-intercom-id',
  source: 'intercom',
  subject: 'Jane Doe attendance issue',
  reporterName: null,
  reporterEmail: null,
  reporterStoreNumber: null,
  rawPayload: null,
  caseType: null,
  processingMode: 'live',
  intelligenceSnapshot: null,
  intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
  intercomSourceUpdatedAt: null,
  extractedNames: null
};
const mockEmployeeMatch = {
  employeeIdentityId: 42,
  canonicalName: 'Jane Doe',
  confidenceScore: 98,
  matchMethod: 'exact'
};

const mockFindById = jest.fn();
const mockFindMessagesByConversationId = jest.fn();
const mockFindSimilarSubjectCaseType = jest.fn();
const mockUpdateCaseType = jest.fn();
const mockUpdateEmployeeIdentity = jest.fn();
const mockCountMessagesByConversationId = jest.fn();
const mockUpdateIntelligence = jest.fn();
const mockMarkIntelligencePending = jest.fn();
const mockReplaceForConversation = jest.fn();
const mockRefreshFromIntercomApi = jest.fn();
const mockResolveConversationSubject = jest.fn();
const mockResolveCaseType = jest.fn();
const mockExtract = jest.fn();
const mockFilterEmployeeNamesToSubject = jest.fn();
const mockResolveByName = jest.fn();
const mockResolveEmployeeManualReview = jest.fn();
const mockResolveRelatedCaseSearchInput = jest.fn();
const mockFindRelatedCasesByMentionedNames = jest.fn();
const mockResolvePossibleSamePersonForDisplay = jest.fn();
const mockStoreReadySnapshot = jest.fn();
const mockMarkFailed = jest.fn();
const mockEnqueueRelatedCasePeerRefresh = jest.fn();
const mockEnqueuePeerSnapshotRefreshJob = jest.fn();
const mockFilterStoredMessagesForAnalysis = jest.fn();
const mockRetainExtractedNameAfterResolution = jest.fn();
const mockMaybeSyncIntercomAfterIntelligence = jest.fn();

await jest.unstable_mockModule('../../../src/config/env.config.js', () => ({
  env: {
    INTERCOM_ENABLED: true,
    AI_PROMPT_VERSION: 'test-prompt',
    GEMINI_MODEL: 'test-model',
    MANUAL_REVIEW_CONFIDENCE: 80
  }
}));
await jest.unstable_mockModule('../../../src/config/logger.config.js', () => ({
  logger: mockLogger
}));
await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById,
    findMessagesByConversationId: mockFindMessagesByConversationId,
    findSimilarSubjectCaseType: mockFindSimilarSubjectCaseType,
    updateCaseType: mockUpdateCaseType,
    updateEmployeeIdentity: mockUpdateEmployeeIdentity,
    countMessagesByConversationId: mockCountMessagesByConversationId,
    updateIntelligence: mockUpdateIntelligence,
    markIntelligencePending: mockMarkIntelligencePending
  }
}));
await jest.unstable_mockModule('../../../src/modules/conversation/conversation-employees.repository.js', () => ({
  conversationEmployeesRepository: {
    replaceForConversation: mockReplaceForConversation
  }
}));
await jest.unstable_mockModule('../../../src/modules/conversation/conversation.service.js', () => ({
  conversationService: { refreshFromIntercomApi: mockRefreshFromIntercomApi }
}));
await jest.unstable_mockModule('../../../src/modules/conversation/conversation-subject.util.js', () => ({
  resolveConversationSubject: mockResolveConversationSubject
}));
await jest.unstable_mockModule('../../../src/modules/conversation/case-type.util.js', () => ({
  resolveCaseType: mockResolveCaseType
}));
await jest.unstable_mockModule('../../../src/modules/employee/employee.name-extraction.service.js', () => ({
  employeeNameExtractionService: { extract: mockExtract }
}));
await jest.unstable_mockModule('../../../src/modules/employee/employee.subject-name.util.js', () => ({
  filterEmployeeNamesToSubject: mockFilterEmployeeNamesToSubject
}));
await jest.unstable_mockModule('../../../src/modules/employee/employee.matching.service.js', () => ({
  employeeMatchingService: { resolveByName: mockResolveByName }
}));
await jest.unstable_mockModule('../../../src/modules/employee/employee.mention-status.util.js', () => ({
  resolveEmployeeManualReview: mockResolveEmployeeManualReview,
  resolveEmployeeMentionStatus: jest.fn(() => 'resolved')
}));
await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.service.js', () => ({
  intelligenceService: {
    storeReadySnapshot: mockStoreReadySnapshot,
    resolvePossibleSamePersonForDisplay: mockResolvePossibleSamePersonForDisplay,
    markFailed: mockMarkFailed
  }
}));
await jest.unstable_mockModule('../../../src/modules/intelligence/related-case-search.util.js', () => ({
  resolveRelatedCaseSearchInput: mockResolveRelatedCaseSearchInput
}));
await jest.unstable_mockModule('../../../src/modules/intelligence/related.retrieval.service.js', () => ({
  relatedRetrievalService: { findRelatedCasesByMentionedNames: mockFindRelatedCasesByMentionedNames }
}));
await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence-sibling-reprocess.service.js', () => ({
  enqueueRelatedCasePeerRefresh: mockEnqueueRelatedCasePeerRefresh
}));
await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueuePeerSnapshotRefreshJob: mockEnqueuePeerSnapshotRefreshJob
}));
await jest.unstable_mockModule('../../../src/modules/intelligence/customer-conversation-content.util.js', () => ({
  filterStoredMessagesForAnalysis: mockFilterStoredMessagesForAnalysis
}));
await jest.unstable_mockModule('../../../src/modules/employee/employee.mention-validation.util.js', () => ({
  retainExtractedNameAfterResolution: mockRetainExtractedNameAfterResolution
}));
await jest.unstable_mockModule('../../../src/modules/intercom/intercom.sync.service.js', () => ({
  maybeSyncIntercomAfterIntelligence: mockMaybeSyncIntercomAfterIntelligence
}));

const { processIntelligenceForConversation } = await import(
  '../../../src/modules/intelligence/intelligence.processor.js'
);

describe('first-time intelligence peer-refresh dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue(mockConversation);
    mockFindMessagesByConversationId.mockResolvedValue([
      { id: 'message-1', messageBody: 'Jane Doe attendance issue', partType: 'comment', authorType: 'user' }
    ]);
    mockFindSimilarSubjectCaseType.mockResolvedValue(null);
    mockUpdateCaseType.mockResolvedValue(undefined);
    mockUpdateEmployeeIdentity.mockResolvedValue(undefined);
    mockCountMessagesByConversationId.mockResolvedValue(1);
    mockUpdateIntelligence.mockResolvedValue(undefined);
    mockMarkIntelligencePending.mockResolvedValue(undefined);
    mockReplaceForConversation.mockResolvedValue(undefined);
    mockRefreshFromIntercomApi.mockResolvedValue(undefined);
    mockResolveConversationSubject.mockReturnValue('Jane Doe attendance issue');
    mockResolveCaseType.mockReturnValue('attendance');
    mockExtract.mockResolvedValue({
      names: ['Jane Doe'],
      caseType: 'attendance',
      source: 'gemini',
      relatedCaseSearchTerms: []
    });
    mockFilterEmployeeNamesToSubject.mockReturnValue(['Jane Doe']);
    mockResolveByName.mockResolvedValue({
      matches: [mockEmployeeMatch],
      searchPath: 'created',
      notices: [],
      mentionStatus: 'resolved',
      possibleSamePerson: []
    });
    mockResolveEmployeeManualReview.mockReturnValue(false);
    mockResolveRelatedCaseSearchInput.mockResolvedValue({
      searchTerms: ['Jane Doe'],
      employeeNames: ['Jane Doe'],
      employeeIdentityIds: [42],
      nameBag: { fullNames: ['Jane Doe'], tokens: ['jane', 'doe'] }
    });
    mockFindRelatedCasesByMentionedNames.mockResolvedValue([]);
    mockResolvePossibleSamePersonForDisplay.mockResolvedValue([]);
    mockStoreReadySnapshot.mockResolvedValue({
      employeeMatches: [mockEmployeeMatch],
      relatedCases: [],
      processedAt: '2026-09-18T00:00:00.000Z'
    });
    mockMarkFailed.mockResolvedValue(undefined);
    mockEnqueueRelatedCasePeerRefresh.mockResolvedValue(undefined);
    mockEnqueuePeerSnapshotRefreshJob.mockResolvedValue(undefined);
    mockFilterStoredMessagesForAnalysis.mockImplementation((messages) => messages);
    mockRetainExtractedNameAfterResolution.mockReturnValue(true);
    mockMaybeSyncIntercomAfterIntelligence.mockResolvedValue(undefined);
  });

  const runFirstTimeProcessing = (forceReprocess = false) =>
    processIntelligenceForConversation({
      conversationId: mockConversation.id,
      intercomId: mockConversation.intercomId,
      skipSync: true,
      forceReprocess
    });

  test('keeps the primary result successful when peer dispatch fails and logs no raw error', async () => {
    const rawFailure = new Error('APIFY_NOT_FOUND token=do-not-log personal data');
    mockEnqueuePeerSnapshotRefreshJob.mockRejectedValueOnce(rawFailure);

    await expect(runFirstTimeProcessing()).resolves.toBeUndefined();

    expect(mockStoreReadySnapshot).toHaveBeenCalledTimes(1);
    expect(mockUpdateIntelligence).toHaveBeenCalledWith(
      mockConversation.id,
      expect.objectContaining({
        status: INTELLIGENCE_STATUS.READY,
        error: null,
        snapshot: expect.objectContaining({ employeeMatches: [mockEmployeeMatch] })
      })
    );
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[worker] Intelligence processing complete',
      expect.objectContaining({ peerRefreshDeferred: false })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[worker] Deferred peer snapshot refresh dispatch failed; primary intelligence result retained',
      { conversationId: mockConversation.id, peerCount: 1 }
    );
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('APIFY_NOT_FOUND');
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('do-not-log');
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('personal data');
  });

  test('marks peer refresh deferred after successful dispatch', async () => {
    await expect(runFirstTimeProcessing()).resolves.toBeUndefined();

    expect(mockEnqueuePeerSnapshotRefreshJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceConversationId: mockConversation.id,
        employeeIdentityIds: [mockEmployeeMatch.employeeIdentityId],
        enqueueSiblingReprocess: true
      })
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[worker] Intelligence processing complete',
      expect.objectContaining({ peerRefreshDeferred: true })
    );
  });

  test('does not cascade peer refresh during Reanalyze force reprocess', async () => {
    await expect(runFirstTimeProcessing(true)).resolves.toBeUndefined();

    expect(mockEnqueuePeerSnapshotRefreshJob).not.toHaveBeenCalled();
    expect(mockEnqueueRelatedCasePeerRefresh).not.toHaveBeenCalled();
    expect(mockStoreReadySnapshot).toHaveBeenCalledTimes(1);
    expect(mockUpdateIntelligence).toHaveBeenCalledWith(
      mockConversation.id,
      expect.objectContaining({ status: INTELLIGENCE_STATUS.READY, error: null })
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[worker] Intelligence processing complete',
      expect.objectContaining({ peerRefreshDeferred: false })
    );
  });
});
