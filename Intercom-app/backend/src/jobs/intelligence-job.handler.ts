import { logger } from '../config/logger.config.js';
import { runDeferredPeerSnapshotRefresh } from '../modules/intelligence/intelligence-sibling-reprocess.service.js';
import { processCaseIntelligence } from '../modules/intelligence/process-case-intelligence.js';
import type { IntercomIntelligenceJobData } from '../queues/intercom-intelligence.queue.js';
import { elapsedMs } from '../utils/timing.util.js';

export const handleIntelligenceJob = async (data: IntercomIntelligenceJobData): Promise<void> => {
  const startedAt = Date.now();

  if (data.peerSnapshotRefresh) {
    const payload = data.peerSnapshotRefresh;
    logger.info('[worker] Peer snapshot refresh job picked up', {
      sourceConversationId: data.conversationId,
      caseType: payload.caseType,
      employeeIdentityCount: payload.employeeIdentityIds.length
    });

    const result = await runDeferredPeerSnapshotRefresh({
      sourceConversationId: data.conversationId,
      caseType: payload.caseType,
      relatedCaseSearchScope: payload.relatedCaseSearchScope,
      employeeIdentityIds: payload.employeeIdentityIds,
      enqueueSiblingReprocess: payload.enqueueSiblingReprocess
    });

    logger.info('[worker] Peer snapshot refresh job finished', {
      sourceConversationId: data.conversationId,
      durationMs: elapsedMs(startedAt),
      peerRefreshMs: result.peerRefreshMs
    });
    return;
  }

  await processCaseIntelligence({
    conversationId: data.conversationId,
    forceReprocess: data.forceReprocess,
    skipSync: data.skipSync,
    skipPeerRefresh: data.skipPeerRefresh,
    source: 'worker'
  });

  logger.info('[worker] Job finished', {
    conversationId: data.conversationId,
    durationMs: elapsedMs(startedAt)
  });
};
