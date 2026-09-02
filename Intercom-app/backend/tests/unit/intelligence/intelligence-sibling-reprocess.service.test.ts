import { jest } from '@jest/globals';
import { EMPLOYEE_SEARCH_PATH } from '../../../src/constants/employee-search.constants.js';

const mockFindReadyPeers = jest.fn();
const mockFindReferencingPeers = jest.fn();
const mockHaveConversationsUpdatedSince = jest.fn();
const mockEnqueueIntelligence = jest.fn();
const mockUpdateIntelligence = jest.fn();
const mockBuildSnapshot = jest.fn();

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findReadyPeersForIntelligenceRefresh: mockFindReadyPeers,
    findReadyConversationsReferencingRelatedIntercomId: mockFindReferencingPeers,
    haveConversationsUpdatedSince: mockHaveConversationsUpdatedSince,
    updateIntelligence: mockUpdateIntelligence
  }
}));

await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueueIntelligence,
  enqueueIntelligenceForConversation: mockEnqueueIntelligence
}));

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence.service.js', () => ({
  intelligenceService: {
    buildSnapshot: mockBuildSnapshot
  }
}));

const {
  enqueueSiblingIntelligenceRefresh,
  enqueueRelatedCasePeerRefresh,
  refreshPeerRelatedCaseSnapshots,
  runDeferredPeerSnapshotRefresh,
  shouldReprocessSiblingSnapshot
} = await import(
  '../../../src/modules/intelligence/intelligence-sibling-reprocess.service.js'
);

describe('intelligence-sibling-reprocess.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueIntelligence.mockResolvedValue(undefined);
    mockUpdateIntelligence.mockResolvedValue(undefined);
    mockBuildSnapshot.mockResolvedValue({
      employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'Zebi Shah', confidenceScore: 85, matchMethod: 'token' }],
      relatedCases: [{ intercomId: 'new-alias-case' }],
      categoryCases: [],
      processedAt: '2026-06-30T00:00:00.000Z'
    });
  });

  describe('shouldReprocessSiblingSnapshot', () => {
    it('reprocesses peers that created a new employee on first run', () => {
      expect(
        shouldReprocessSiblingSnapshot({
          employeeMatches: [],
          relatedCases: [],
          employeeSearchPath: EMPLOYEE_SEARCH_PATH.CREATED,
          processedAt: '2026-01-01T00:00:00.000Z'
        })
      ).toBe(true);
    });

    it('does not reprocess peers just because related cases are empty', () => {
      expect(
        shouldReprocessSiblingSnapshot({
          employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'A', confidenceScore: 100, matchMethod: 'exact' }],
          relatedCases: [],
          employeeSearchPath: EMPLOYEE_SEARCH_PATH.NAME,
          processedAt: '2026-01-01T00:00:00.000Z'
        })
      ).toBe(false);
    });

    it('skips peers that already have related cases and a real match path', () => {
      expect(
        shouldReprocessSiblingSnapshot({
          employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'A', confidenceScore: 85, matchMethod: 'token' }],
          relatedCases: [
            {
              conversationId: 2,
              intercomId: 'other',
              subject: 'Other case',
              caseType: 'attendance',
              matchedEmployeeNames: ['A'],
              reporterName: null,
              status: 'open',
              advisorName: null,
              createdAt: '2026-01-02T00:00:00.000Z'
            }
          ],
          employeeSearchPath: EMPLOYEE_SEARCH_PATH.STORE,
          processedAt: '2026-01-01T00:00:00.000Z'
        })
      ).toBe(false);
    });
  });

  describe('enqueueSiblingIntelligenceRefresh', () => {
    it('enqueues force refresh for peers that still need related cases', async () => {
      mockFindReadyPeers.mockResolvedValue([
        {
          id: 1,
          intercomId: 'first-case',
          intelligenceSnapshot: {
            employeeMatches: [],
            relatedCases: [],
            employeeSearchPath: EMPLOYEE_SEARCH_PATH.CREATED,
            processedAt: '2026-01-01T00:00:00.000Z'
          }
        },
        {
          id: 2,
          intercomId: 'second-case',
          intelligenceSnapshot: {
            employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'A', confidenceScore: 85, matchMethod: 'token' }],
            relatedCases: [
              {
                conversationId: 1,
                intercomId: 'first-case',
                subject: 'Earlier case',
                caseType: 'attendance',
                matchedEmployeeNames: ['A'],
                reporterName: null,
                status: 'open',
                advisorName: null,
                createdAt: '2026-01-01T00:00:00.000Z'
              }
            ],
            employeeSearchPath: EMPLOYEE_SEARCH_PATH.NAME,
            processedAt: '2026-01-02T00:00:00.000Z'
          }
        }
      ]);

      await enqueueSiblingIntelligenceRefresh({
        conversationId: 2,
        caseType: 'attendance',
        relatedCaseSearchScope: null,
        employeeIdentityIds: [1]
      });

      expect(mockFindReadyPeers).toHaveBeenCalledWith({
        excludeConversationId: 2,
        caseType: 'attendance',
        scope: null,
        employeeIdentityIds: [1],
        limit: 20
      });
      expect(mockEnqueueIntelligence).toHaveBeenCalledTimes(1);
      expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, intercomId: 'first-case' }),
        expect.objectContaining({ skipSync: true, forceReprocess: true, messageCount: 1 })
      );
    });

    it('refreshes peers with existing related cases when forcePeerRefresh is set', async () => {
      mockFindReadyPeers.mockResolvedValue([
        {
          id: 2,
          intercomId: 'second-case',
          intelligenceSnapshot: {
            employeeMatches: [{ employeeIdentityId: 1, canonicalName: 'A', confidenceScore: 85, matchMethod: 'token' }],
            relatedCases: [
              {
                conversationId: 1,
                intercomId: 'first-case',
                subject: 'Earlier case',
                caseType: 'attendance',
                matchedEmployeeNames: ['A'],
                reporterName: null,
                status: 'open',
                advisorName: null,
                createdAt: '2026-01-01T00:00:00.000Z'
              }
            ],
            employeeSearchPath: EMPLOYEE_SEARCH_PATH.NAME,
            processedAt: '2026-01-02T00:00:00.000Z'
          }
        }
      ]);

      await enqueueSiblingIntelligenceRefresh({
        conversationId: 3,
        caseType: 'attendance',
        relatedCaseSearchScope: null,
        employeeIdentityIds: [1],
        forcePeerRefresh: true
      });

      expect(mockEnqueueIntelligence).toHaveBeenCalledTimes(1);
      expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, intercomId: 'second-case' }),
        expect.objectContaining({ skipSync: true, forceReprocess: true, messageCount: 1 })
      );
    });
  });

  describe('refreshPeerRelatedCaseSnapshots', () => {
    it('rebuilds related cases on peer conversations for the same employee identity', async () => {
      mockFindReadyPeers.mockResolvedValue([
        {
          id: 2,
          intercomId: 'zebi-case',
          subject: 'attendance issue - zebi',
          caseType: 'attendance',
          extractedNames: ['Zebi'],
          rawPayload: null,
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 103, canonicalName: 'Zebi Shah', confidenceScore: 85, matchMethod: 'token' }
            ],
            relatedCases: [],
            processedAt: '2026-01-01T00:00:00.000Z'
          }
        }
      ]);

      await refreshPeerRelatedCaseSnapshots({
        conversationId: 3,
        caseType: 'attendance',
        relatedCaseSearchScope: null,
        employeeIdentityIds: [103]
      });

      expect(mockBuildSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 2,
          relatedCaseSearchScope: null,
          employeeMatches: [
            expect.objectContaining({ employeeIdentityId: 103, canonicalName: 'Zebi Shah' })
          ]
        })
      );
      expect(mockUpdateIntelligence).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          status: 'ready'
        })
      );
    });
  });

  describe('enqueueRelatedCasePeerRefresh', () => {
    it('enqueues refresh for conversations that list the changed case in related cases', async () => {
      mockFindReferencingPeers.mockResolvedValue([
        {
          id: 10,
          intercomId: 'ahsan-case'
        }
      ]);

      await enqueueRelatedCasePeerRefresh({
        sourceConversationId: 20,
        sourceIntercomId: 'romeo-case'
      });

      expect(mockFindReferencingPeers).toHaveBeenCalledWith({
        relatedIntercomId: 'romeo-case',
        excludeConversationId: 20,
        limit: 20
      });
      expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10, intercomId: 'ahsan-case' }),
        expect.objectContaining({ skipSync: true, forceReprocess: true, messageCount: 1 })
      );
    });
  });

  describe('runDeferredPeerSnapshotRefresh', () => {
    it('rebuilds peer snapshots then enqueues sibling reprocess when requested', async () => {
      mockFindReadyPeers.mockResolvedValue([
        {
          id: 2,
          intercomId: 'peer-2',
          subject: 'Zebi attendance',
          caseType: 'attendance',
          extractedNames: ['Zebi Shah'],
          intelligenceSnapshot: {
            employeeMatches: [
              { employeeIdentityId: 1, canonicalName: 'Zebi Shah', confidenceScore: 100, matchMethod: 'exact' }
            ],
            relatedCases: [],
            employeeSearchPath: EMPLOYEE_SEARCH_PATH.CREATED,
            processedAt: '2026-01-01T00:00:00.000Z'
          }
        }
      ]);

      const result = await runDeferredPeerSnapshotRefresh({
        sourceConversationId: 99,
        caseType: 'attendance',
        relatedCaseSearchScope: null,
        employeeIdentityIds: [1],
        enqueueSiblingReprocess: true
      });

      expect(mockBuildSnapshot).toHaveBeenCalled();
      expect(mockUpdateIntelligence).toHaveBeenCalled();
      expect(mockEnqueueIntelligence).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, intercomId: 'peer-2' }),
        expect.objectContaining({ skipSync: true, forceReprocess: true, messageCount: 1 })
      );
      expect(result.peerRefreshMs).toBeGreaterThanOrEqual(0);
    });

    it('skips sibling enqueue when enqueueSiblingReprocess is false', async () => {
      mockFindReadyPeers.mockResolvedValue([]);

      await runDeferredPeerSnapshotRefresh({
        sourceConversationId: 99,
        caseType: 'attendance',
        relatedCaseSearchScope: null,
        employeeIdentityIds: [1],
        enqueueSiblingReprocess: false
      });

      expect(mockEnqueueIntelligence).not.toHaveBeenCalled();
    });
  });
});
