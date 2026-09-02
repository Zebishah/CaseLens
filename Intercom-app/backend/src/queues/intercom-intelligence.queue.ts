import { Queue } from 'bullmq';
import { REDIS_ENQUEUE_TIMEOUT_MS } from '../constants/canvas.timing.constants.js';
import { getBullMqConnection } from '../config/redis.connection.js';
import { shouldDispatchQueueJobs } from '../config/job-processing.js';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import type { RelatedCaseSearchScope } from '../modules/conversation/related-case-scope.util.js';
import {
  buildIntelligenceJobId,
  revisionKeyFromSource
} from '../modules/intelligence/intelligence-revision.util.js';

export type PeerSnapshotRefreshJobPayload = {
  caseType: string;
  employeeIdentityIds: number[];
  relatedCaseSearchScope: RelatedCaseSearchScope | null;
  /** After lightweight peer rebuild, enqueue full sibling reprocess where needed. */
  enqueueSiblingReprocess: boolean;
};

export type IntercomIntelligenceJobData = {
  conversationId: number;
  intercomId: string;
  /** Skip redundant Intercom API fetch when webhook just synced. */
  skipSync?: boolean;
  /** Re-run even when the stored snapshot is already current for this message count. */
  forceReprocess?: boolean;
  /** @deprecated Store/domain search removed — ignored if present. */
  forceDomainEmployeeSearch?: boolean;
  /** @deprecated Store/domain search removed — ignored if present. */
  forceStoreEmployeeSearch?: boolean;
  /** Canvas button actions only update this ticket — skip peer/sibling reprocess. */
  skipPeerRefresh?: boolean;
  /** Message-count + Intercom updated_at key used for revision-aware job ids. */
  sourceRevision?: string;
  /**
   * When set, worker skips Gemini/matching and only rebuilds peer related-case snapshots
   * for this source conversation (deferred from the main intelligence job).
   */
  peerSnapshotRefresh?: PeerSnapshotRefreshJobPayload;
};

let intercomIntelligenceQueue: Queue<
  IntercomIntelligenceJobData,
  void,
  'process-intelligence'
> | null = null;

const getIntercomIntelligenceQueue = (): Queue<
  IntercomIntelligenceJobData,
  void,
  'process-intelligence'
> => {
  if (!intercomIntelligenceQueue) {
    intercomIntelligenceQueue = new Queue<IntercomIntelligenceJobData, void, 'process-intelligence'>(
      'intercom-intelligence-queue',
      {
        connection: getBullMqConnection()
      }
    );

    intercomIntelligenceQueue.on('error', (error) => {
      logger.error('[queue] Intelligence queue connection error', {
        message: error.message,
        code: (error as NodeJS.ErrnoException).code
      });
    });
  }

  return intercomIntelligenceQueue;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  if (timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis enqueue timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
};

export const startInlineIntelligenceJob = async (
  data: IntercomIntelligenceJobData
): Promise<void> => {
  const { processCaseIntelligence } = await import(
    '../modules/intelligence/process-case-intelligence.js'
  );

  await processCaseIntelligence({
    conversationId: data.conversationId,
    forceReprocess: data.forceReprocess,
    skipPeerRefresh: data.skipPeerRefresh,
    source: 'inline'
  });
};

export const enqueueIntercomIntelligence = async (
  data: IntercomIntelligenceJobData,
  options?: { jobId?: string }
): Promise<void> => {
  if (!shouldDispatchQueueJobs()) {
    logger.debug('[queue] Skipping enqueue — inline processing or test environment', data);
    if (env.NODE_ENV !== 'test') {
      void startInlineIntelligenceJob(data).catch((error: unknown) => {
        logger.error('[queue] Inline intelligence processing failed', {
          conversationId: data.conversationId,
          intercomId: data.intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
    return;
  }

  const jobId =
    options?.jobId ??
    buildIntelligenceJobId(
      data.conversationId,
      data.sourceRevision ??
        (data.forceReprocess ? `force-${Date.now()}` : `current-${Date.now()}`)
    );

  try {
    const job = await withTimeout(
      getIntercomIntelligenceQueue().add('process-intelligence', data, {
        jobId,
        attempts: env.QUEUE_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: env.QUEUE_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: 100
      }),
      REDIS_ENQUEUE_TIMEOUT_MS
    );

    logger.info('[queue] Intelligence job added to Redis', {
      jobId: job.id,
      conversationId: data.conversationId,
      intercomId: data.intercomId,
      queueName: 'intercom-intelligence-queue',
      peerSnapshotRefresh: Boolean(data.peerSnapshotRefresh)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('job') && message.toLowerCase().includes('exist')) {
      logger.debug('[queue] Intelligence job already queued — skipping duplicate', {
        jobId,
        conversationId: data.conversationId,
        intercomId: data.intercomId
      });
      return;
    }

    throw error;
  }
};

/**
 * Enqueue intelligence for a stored conversation using a revision-aware BullMQ job id.
 * Duplicate notifications that share messageCount + Intercom updated_at coalesce.
 * forceReprocess (Canvas re-analyze / sibling refresh) uses a unique id so an
 * in-flight job for an older revision cannot swallow the request.
 */
export const enqueueIntelligenceForConversation = async (
  conversation: {
    id: number;
    intercomId: string;
    intercomSourceUpdatedAt?: Date | null;
  },
  options: {
    messageCount: number;
    skipSync?: boolean;
    forceReprocess?: boolean;
    skipPeerRefresh?: boolean;
  }
): Promise<void> => {
  const sourceRevision = revisionKeyFromSource(
    options.messageCount,
    conversation.intercomSourceUpdatedAt
  );
  const jobId = options.forceReprocess
    ? buildIntelligenceJobId(conversation.id, `force-${sourceRevision}-${Date.now()}`)
    : buildIntelligenceJobId(conversation.id, sourceRevision);

  await enqueueIntercomIntelligence(
    {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      skipSync: options.skipSync,
      forceReprocess: options.forceReprocess,
      skipPeerRefresh: options.skipPeerRefresh,
      sourceRevision
    },
    { jobId }
  );
};

/** Deferred A↔B related-list rebuild — does not block the main conversation job. */
export const enqueuePeerSnapshotRefreshJob = async (input: {
  sourceConversationId: number;
  sourceIntercomId: string;
  caseType: string;
  employeeIdentityIds: number[];
  relatedCaseSearchScope: RelatedCaseSearchScope | null;
  enqueueSiblingReprocess: boolean;
}): Promise<void> => {
  await enqueueIntercomIntelligence(
    {
      conversationId: input.sourceConversationId,
      intercomId: input.sourceIntercomId,
      skipSync: true,
      skipPeerRefresh: true,
      peerSnapshotRefresh: {
        caseType: input.caseType,
        employeeIdentityIds: input.employeeIdentityIds,
        relatedCaseSearchScope: input.relatedCaseSearchScope,
        enqueueSiblingReprocess: input.enqueueSiblingReprocess
      }
    },
    { jobId: `peer-refresh-${input.sourceConversationId}` }
  );
};
