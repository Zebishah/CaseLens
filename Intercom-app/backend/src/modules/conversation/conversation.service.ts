import { INTELLIGENCE_STATUS, RELATED_CASE_LIST_LIMIT } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { intercomClient } from '../intercom/intercom.client.js';
import type { IntercomWebhookEnvelope } from '../intercom/intercom.types.js';
import {
  mapApiConversationToConversation,
  mapWebhookToConversation
} from './conversation.mapper.js';
import { resolveConversationSubject } from './conversation-subject.util.js';
import { conversationRepository, type ConversationRecord } from './conversation.repository.js';
import {
  getProcessedMessageCount,
  hasNewMessagesSinceLastProcessing,
  normalizeSubjectForComparison,
  reconcileIntelligenceStatus
} from '../intelligence/intelligence-stale.util.js';
import { enqueueIntelligenceForConversation } from '../../queues/intercom-intelligence.queue.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';

export type SyncedConversationResult = {
  record: ConversationRecord;
  subjectChanged: boolean;
};

const markIntelligenceStaleWhenConversationChanged = async (
  record: ConversationRecord,
  syncedMessageCount: number,
  options?: { subjectChanged?: boolean }
): Promise<ConversationRecord> => {
  const fresh = (await conversationRepository.findById(record.id)) ?? record;
  const snapshot = fresh.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const processedMessageCount = getProcessedMessageCount(snapshot);
  const messagesGrew = hasNewMessagesSinceLastProcessing(snapshot, syncedMessageCount);
  const subjectChanged = options?.subjectChanged === true;

  if (processedMessageCount === undefined && !subjectChanged) {
    return fresh;
  }

  if (!messagesGrew && !subjectChanged) {
    return reconcileIntelligenceStatus(fresh, syncedMessageCount);
  }

  if (
    fresh.intelligenceStatus === INTELLIGENCE_STATUS.READY ||
    fresh.intelligenceStatus === INTELLIGENCE_STATUS.FAILED
  ) {
    await conversationRepository.markIntelligencePending(fresh.id);

    logger.info('[conversation] Conversation changed — intelligence marked pending for re-processing', {
      conversationId: fresh.id,
      intercomId: fresh.intercomId,
      previousMessageCount: processedMessageCount,
      syncedMessageCount,
      subjectChanged,
      messagesGrew
    });

    return (await conversationRepository.findById(fresh.id)) ?? fresh;
  }

  return fresh;
};

const logMappedConversation = (
  label: string,
  conversation: ReturnType<typeof mapWebhookToConversation>['conversation'],
  messageCount: number
): void => {
  logger.info(label, {
    intercomId: conversation.intercomId,
    subject: conversation.subject,
    reporterName: conversation.reporterName,
    reporterEmail: conversation.reporterEmail,
    messageCount
  });
};

export const conversationService = {
  async syncFromWebhook(envelope: IntercomWebhookEnvelope): Promise<ConversationRecord> {
    const intercomId = String(envelope.data.item.id);

    logger.info('[conversation] Webhook received — fetching full conversation from API', {
      intercomId,
      topic: envelope.topic
    });

    return this.refreshFromIntercomApi(intercomId, {
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING
    }).then(({ record }) => record);
  },

  async refreshFromIntercomApi(
    intercomId: string,
    options?: {
      intelligenceStatus?: string;
      preserveIntelligenceStatus?: boolean;
      enqueue?: boolean;
      deferSubjectReprocess?: boolean;
    }
  ): Promise<SyncedConversationResult> {
    logger.info('[conversation] Fetching conversation from Intercom API', { intercomId });

    const existing = await conversationRepository.findByIntercomId(intercomId);
    const apiConversation = await intercomClient.getConversation(intercomId);
    const { conversation, messages } = mapApiConversationToConversation(apiConversation);
    const subjectChanged =
      Boolean(existing) &&
      normalizeSubjectForComparison(
        resolveConversationSubject({
          subject: existing?.subject,
          rawPayload: existing?.rawPayload ?? null
        })
      ) !== normalizeSubjectForComparison(conversation.subject);

    logMappedConversation('[conversation] Mapped API response to DB fields', conversation, messages.length);

    let record = await conversationRepository.upsertFromIntercom(
      conversation,
      messages,
      options?.intelligenceStatus ?? INTELLIGENCE_STATUS.PENDING,
      {
        preserveIntelligenceStatus:
          options?.preserveIntelligenceStatus === true && !subjectChanged
      }
    );

    if (options?.preserveIntelligenceStatus) {
      record = await markIntelligenceStaleWhenConversationChanged(record, messages.length, {
        subjectChanged
      });
    } else {
      record = await reconcileIntelligenceStatus(record, messages.length);
    }

    if (options?.enqueue) {
      await enqueueIntelligenceForConversation(record, {
        messageCount: messages.length,
        skipSync: false
      });

      logger.info('[conversation] Refreshed from Intercom API and enqueued intelligence job', {
        conversationId: record.id,
        intercomId: record.intercomId
      });
    } else if (
      subjectChanged &&
      options?.preserveIntelligenceStatus &&
      options?.deferSubjectReprocess !== true
    ) {
      await enqueueIntelligenceForConversation(record, {
        messageCount: messages.length,
        skipSync: true,
        forceReprocess: true
      });

      logger.info('[conversation] Subject changed — enqueued intelligence re-processing', {
        conversationId: record.id,
        intercomId: record.intercomId
      });
    }

    return { record, subjectChanged };
  },

  async syncFromIntercomApi(
    intercomId: string,
    options?: { enqueue?: boolean }
  ): Promise<ConversationRecord> {
    const { record } = await this.refreshFromIntercomApi(intercomId, {
      intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
      enqueue: options?.enqueue !== false
    });

    if (options?.enqueue === false) {
      logger.info('[conversation] Synced from Intercom API (enqueue skipped)', {
        conversationId: record.id,
        intercomId: record.intercomId
      });
    }

    return record;
  },

  async ensureSyncedFromIntercomApi(
    intercomId: string,
    options?: { enqueue?: boolean; deferSubjectReprocess?: boolean }
  ): Promise<SyncedConversationResult> {
    const existing = await conversationRepository.findByIntercomId(intercomId);

    if (!existing) {
      const record = await this.syncFromIntercomApi(intercomId, options);
      return { record, subjectChanged: false };
    }

    return this.refreshFromIntercomApi(intercomId, {
      preserveIntelligenceStatus: true,
      enqueue: options?.enqueue,
      deferSubjectReprocess: options?.deferSubjectReprocess
    });
  },

  async refreshConversationsFromIntercom(
    intercomIds: string[],
    options?: { limit?: number }
  ): Promise<void> {
    const uniqueIds = [...new Set(intercomIds.map((id) => id.trim()).filter(Boolean))].slice(
      0,
      options?.limit ?? RELATED_CASE_LIST_LIMIT
    );

    if (uniqueIds.length === 0) {
      return;
    }

    await Promise.all(
      uniqueIds.map(async (intercomId) => {
        try {
          await this.refreshFromIntercomApi(intercomId, {
            preserveIntelligenceStatus: true
          });
        } catch (error) {
          logger.warn('[conversation] Failed to refresh related conversation from Intercom API', {
            intercomId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }
};
