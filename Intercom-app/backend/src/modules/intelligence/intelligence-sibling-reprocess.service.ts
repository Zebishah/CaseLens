import { EMPLOYEE_SEARCH_PATH } from '../../constants/employee-search.constants.js';
import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { resolveCaseType } from '../conversation/case-type.util.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import type { RelatedCaseSearchScope } from '../conversation/related-case-scope.util.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { enqueueIntelligenceForConversation } from '../../queues/intercom-intelligence.queue.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { intelligenceService } from './intelligence.service.js';
import { elapsedMs } from '../../utils/timing.util.js';
import { ADVISORY_LOCK_NAMESPACE, withPostgresAdvisoryLock } from '../../database/postgres-advisory-lock.js';
import { isApifyJobProcessing } from '../../config/job-processing.js';

const SIBLING_REPROCESS_LIMIT = 20;

export const shouldReprocessSiblingSnapshot = (
  snapshot: IntelligenceSnapshot | null | undefined
): boolean => {
  if (!snapshot) {
    return false;
  }

  // Only full-reprocess peers that created a brand-new employee on first run.
  // Empty relatedCases is a valid final state — re-queueing those forever floods the worker.
  return snapshot.employeeSearchPath === EMPLOYEE_SEARCH_PATH.CREATED;
};

export const isRelatedCaseSnapshotStale = async (
  snapshot: IntelligenceSnapshot | null | undefined
): Promise<boolean> => {
  if (!snapshot?.processedAt) {
    return false;
  }

  const intercomIds = [
    ...snapshot.relatedCases.map((relatedCase) => relatedCase.intercomId),
    ...(snapshot.categoryCases ?? []).map((categoryCase) => categoryCase.intercomId)
  ];

  return conversationRepository.haveConversationsUpdatedSince(intercomIds, snapshot.processedAt);
};

export const enqueueRelatedCasePeerRefresh = async (input: {
  sourceConversationId: number;
  sourceIntercomId: string;
}): Promise<void> => {
  const peers = await conversationRepository.findReadyConversationsReferencingRelatedIntercomId({
    relatedIntercomId: input.sourceIntercomId,
    excludeConversationId: input.sourceConversationId,
    limit: SIBLING_REPROCESS_LIMIT
  });

  if (peers.length === 0) {
    return;
  }

  logger.info('[intelligence] Enqueueing related-case peer refresh', {
    sourceConversationId: input.sourceConversationId,
    sourceIntercomId: input.sourceIntercomId,
    peerCount: peers.length,
    peerConversationIds: peers.map((peer) => peer.id)
  });

  for (const peer of peers) {
    void enqueueIntelligenceForConversation(peer, {
      messageCount: 1,
      skipSync: true,
      forceReprocess: true
    }).catch((error: unknown) => {
      logger.error('[intelligence] Failed to enqueue related-case peer refresh', {
        sourceConversationId: input.sourceConversationId,
        peerConversationId: peer.id,
        peerIntercomId: peer.intercomId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
};

/** Immediately rebuild related cases on peer conversations for the same employee identity. */
export const refreshPeerRelatedCaseSnapshots = async (input: {
  conversationId: number;
  caseType: string;
  relatedCaseSearchScope: RelatedCaseSearchScope | null;
  employeeIdentityIds: number[];
}): Promise<void> => {
  if (!input.caseType.trim() || input.employeeIdentityIds.length === 0) {
    return;
  }

  const peers = await conversationRepository.findReadyPeersForIntelligenceRefresh({
    excludeConversationId: input.conversationId,
    caseType: input.caseType,
    scope: input.relatedCaseSearchScope,
    employeeIdentityIds: input.employeeIdentityIds,
    limit: SIBLING_REPROCESS_LIMIT
  });

  const peersWithMatches = peers.filter((peer) => {
    const snapshot = peer.intelligenceSnapshot as IntelligenceSnapshot | null;
    return (snapshot?.employeeMatches?.length ?? 0) > 0;
  });

  if (peersWithMatches.length === 0) {
    return;
  }

  logger.info('[intelligence] Refreshing peer related-case snapshots', {
    sourceConversationId: input.conversationId,
    peerCount: peersWithMatches.length,
    peerConversationIds: peersWithMatches.map((peer) => peer.id)
  });

  for (const peer of peersWithMatches) {
    const stored = peer.intelligenceSnapshot as IntelligenceSnapshot;

    try {
      const refreshPeer = async (): Promise<void> => {
        const mentionedInReport =
          (peer.extractedNames as string[] | null)?.filter((name) => name.trim().length > 0) ??
          stored.mentionedInReport ??
          [];

        const refreshed = await intelligenceService.buildSnapshot({
          conversationId: peer.id,
          employeeMatches: stored.employeeMatches,
          searchTerms: mentionedInReport,
          mentionedInReport,
          caseTypeFilter: resolveCaseType({
            subject: resolveConversationSubject(peer),
            rawPayload: peer.rawPayload ?? null,
            storedCaseType: peer.caseType ?? stored.caseType
          }),
          relatedCaseSearchScope: null,
          dismissedRelatedCaseIntercomIds: stored.dismissedRelatedCaseIntercomIds,
          dismissedCategoryCaseIntercomIds: stored.dismissedCategoryCaseIntercomIds,
          priorRelatedCases: stored.relatedCases,
          processedSubject: resolveConversationSubject(peer),
          extractionSource: stored.extractionSource,
          employeeSearchPath: stored.employeeSearchPath,
          employeeSearchNotices: stored.employeeSearchNotices,
          awaitingCompanyDomainSearch: false,
          companyDomainSearchAttempted: false,
          messageCount: stored.messageCount
        });

        await conversationRepository.updateIntelligence(peer.id, {
          status: INTELLIGENCE_STATUS.READY,
          snapshot: {
            ...refreshed,
            // Keep display-only fields from the existing cache (not rebuilt here).
            possibleSamePerson: stored.possibleSamePerson,
            domainEmployeeMatches: stored.domainEmployeeMatches,
            ccRecipients: stored.ccRecipients,
            processingDurationMs: stored.processingDurationMs,
            processingTimingsMs: stored.processingTimingsMs
          },
          error: null,
          extractedNames: peer.extractedNames
        });
      };
      if (isApifyJobProcessing()) {
        await withPostgresAdvisoryLock(
          ADVISORY_LOCK_NAMESPACE.intelligenceConversation,
          peer.id,
          refreshPeer
        );
      } else {
        await refreshPeer();
      }
    } catch (error) {
      logger.error('[intelligence] Failed to refresh peer related-case snapshot', {
        sourceConversationId: input.conversationId,
        peerConversationId: peer.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

export const enqueueSiblingIntelligenceRefresh = async (input: {
  conversationId: number;
  caseType: string;
  relatedCaseSearchScope: RelatedCaseSearchScope | null;
  employeeIdentityIds: number[];
  /** Rebuild related cases on peers even when they already have a saved list. */
  forcePeerRefresh?: boolean;
}): Promise<void> => {
  if (!input.caseType.trim()) {
    return;
  }

  const peers = await conversationRepository.findReadyPeersForIntelligenceRefresh({
    excludeConversationId: input.conversationId,
    caseType: input.caseType,
    scope: input.relatedCaseSearchScope,
    employeeIdentityIds: input.employeeIdentityIds,
    limit: SIBLING_REPROCESS_LIMIT
  });

  const peersToRefresh = input.forcePeerRefresh
    ? peers
    : peers.filter((peer) =>
        shouldReprocessSiblingSnapshot(peer.intelligenceSnapshot as IntelligenceSnapshot | null)
      );

  if (peersToRefresh.length === 0) {
    return;
  }

  logger.info('[intelligence] Enqueueing sibling conversation refresh', {
    conversationId: input.conversationId,
    caseType: input.caseType,
    scopeMode: input.relatedCaseSearchScope?.mode ?? 'all',
    peerCount: peersToRefresh.length,
    peerConversationIds: peersToRefresh.map((peer) => peer.id)
  });

  for (const peer of peersToRefresh) {
    void enqueueIntelligenceForConversation(peer, {
      messageCount: 1,
      skipSync: true,
      forceReprocess: true
    }).catch((error: unknown) => {
      logger.error('[intelligence] Failed to enqueue sibling refresh', {
        sourceConversationId: input.conversationId,
        peerConversationId: peer.id,
        peerIntercomId: peer.intercomId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
};

/**
 * Runs the same peer related-list rebuild + optional sibling enqueue that used to
 * block the main intelligence job. Invoked from a separate queue job.
 */
export const runDeferredPeerSnapshotRefresh = async (input: {
  sourceConversationId: number;
  caseType: string;
  relatedCaseSearchScope: RelatedCaseSearchScope | null;
  employeeIdentityIds: number[];
  enqueueSiblingReprocess: boolean;
}): Promise<{ peerRefreshMs: number; peerCountHint: number }> => {
  const startedAt = Date.now();

  logger.info('[intelligence] Deferred peer snapshot refresh started', {
    sourceConversationId: input.sourceConversationId,
    caseType: input.caseType,
    employeeIdentityCount: input.employeeIdentityIds.length,
    enqueueSiblingReprocess: input.enqueueSiblingReprocess
  });

  await refreshPeerRelatedCaseSnapshots({
    conversationId: input.sourceConversationId,
    caseType: input.caseType,
    relatedCaseSearchScope: input.relatedCaseSearchScope,
    employeeIdentityIds: input.employeeIdentityIds
  });

  if (input.enqueueSiblingReprocess) {
    await enqueueSiblingIntelligenceRefresh({
      conversationId: input.sourceConversationId,
      caseType: input.caseType,
      relatedCaseSearchScope: input.relatedCaseSearchScope,
      employeeIdentityIds: input.employeeIdentityIds,
      forcePeerRefresh: false
    });
  }

  const peerRefreshMs = elapsedMs(startedAt);
  logger.info('[intelligence] Deferred peer snapshot refresh finished', {
    sourceConversationId: input.sourceConversationId,
    durationMs: peerRefreshMs
  });

  return { peerRefreshMs, peerCountHint: 0 };
};
