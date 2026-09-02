import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import {
  INTERCOM_WEBHOOK_TOPICS,
  isConversationCreatedTopic,
  isConversationReplyTopic
} from '../../constants/intercom.constants.js';
import { logger } from '../../config/logger.config.js';
import type { IntercomWebhookEnvelope } from '../intercom/intercom.types.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { conversationService } from '../conversation/conversation.service.js';
import { shouldReprocessIntelligence } from '../intelligence/intelligence-stale.util.js';
import { enqueueIntercomIntelligence } from '../../queues/intercom-intelligence.queue.js';
import { AppError } from '../../utils/error.util.js';
import { recordIntercomWebhookNotification } from '../ingestion/intercom.webhook.adapter.js';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import { webhookWorkspaceMatches } from '../intercom/intercom.workspace.util.js';
import {
  buildIntelligenceJobId,
  revisionKeyFromSource
} from '../intelligence/intelligence-revision.util.js';

const enqueueIntelligenceIfNeeded = async (
  conversationId: number,
  intercomId: string,
  messageCount: number
): Promise<boolean> => {
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation || !shouldReprocessIntelligence(conversation, messageCount)) {
    logger.info('[webhook] Intelligence enqueue skipped — snapshot already current', {
      conversationId,
      intercomId,
      messageCount
    });
    return true;
  }

  if (conversation.intelligenceStatus !== INTELLIGENCE_STATUS.PENDING) {
    await conversationRepository.markIntelligencePending(conversationId);
  }

  try {
    const sourceRevision = revisionKeyFromSource(
      messageCount,
      conversation.intercomSourceUpdatedAt
    );
    await enqueueIntercomIntelligence(
      {
        conversationId,
        intercomId,
        skipSync: true,
        sourceRevision
      },
      { jobId: buildIntelligenceJobId(conversationId, sourceRevision) }
    );

    logger.info('[webhook] Intelligence job enqueued', {
      conversationId,
      intercomId,
      messageCount
    });
    return true;
  } catch (error) {
    logger.error('[webhook] Intelligence enqueue failed — worker may still pick up a late job', {
      conversationId,
      intercomId,
      messageCount,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

export const webhookService = {
  async handleConversationCreated(envelope: IntercomWebhookEnvelope): Promise<{
    conversationId: number;
    intercomId: string;
  }> {
    logger.info('[webhook] Processing new conversation webhook', {
      topic: envelope.topic,
      intercomConversationId: envelope.data.item.id
    });

    const conversation = await conversationService.syncFromWebhook(envelope);

    logger.info('[webhook] Conversation saved to DB', {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      reporterName: conversation.reporterName,
      intelligenceStatus: conversation.intelligenceStatus
    });

    const messageCount = await conversationRepository.countMessagesByConversationId(conversation.id);
    await enqueueIntelligenceIfNeeded(conversation.id, conversation.intercomId, messageCount);

    return {
      conversationId: conversation.id,
      intercomId: conversation.intercomId
    };
  },

  async handleConversationReply(envelope: IntercomWebhookEnvelope): Promise<{
    conversationId: number;
    intercomId: string;
  }> {
    const intercomId = String(envelope.data.item.id);

    logger.info('[webhook] Processing conversation reply webhook', {
      topic: envelope.topic,
      intercomConversationId: intercomId
    });

    const { record: conversation } = await conversationService.refreshFromIntercomApi(intercomId, {
      preserveIntelligenceStatus: true
    });

    const messageCount = await conversationRepository.countMessagesByConversationId(conversation.id);
    await enqueueIntelligenceIfNeeded(conversation.id, conversation.intercomId, messageCount);

    return {
      conversationId: conversation.id,
      intercomId: conversation.intercomId
    };
  },

  async handle(envelope: IntercomWebhookEnvelope): Promise<{ handled: boolean }> {
    if (!webhookWorkspaceMatches(envelope.app_id)) {
      throw AppError.unauthorized('Intercom webhook workspace does not match this application');
    }

    if (envelope.topic === INTERCOM_WEBHOOK_TOPICS.CONVERSATION_ADMIN_NOTED) {
      logger.info('[webhook] Ignoring conversation.admin.noted to avoid write-back feedback loops');
      return { handled: true };
    }

    const recorded = await recordIntercomWebhookNotification(envelope);
    const recoverableDuplicate =
      recorded.duplicate && (recorded.status === 'received' || recorded.status === 'failed');
    if (recorded.duplicate && !recoverableDuplicate) {
      return { handled: true };
    }

    if (recoverableDuplicate) {
      logger.warn('[webhook] Resuming an Intercom event that was recorded but not queued', {
        inboundEventId: recorded.inboundEventId,
        externalEventId: recorded.externalEventId,
        priorStatus: recorded.status
      });
    }

    if (envelope.topic === INTERCOM_WEBHOOK_TOPICS.PING) {
      logger.info('[webhook] Intercom ping/test notification received — OK');
      return { handled: true };
    }

    if (isConversationCreatedTopic(envelope.topic)) {
      const result = await this.handleConversationCreated(envelope);
      if (recorded.inboundEventId) {
        await ingestionRepository.markQueued(recorded.inboundEventId, result.conversationId);
      }
      return { handled: true };
    }

    if (isConversationReplyTopic(envelope.topic)) {
      const result = await this.handleConversationReply(envelope);
      if (recorded.inboundEventId) {
        await ingestionRepository.markQueued(recorded.inboundEventId, result.conversationId);
      }
      return { handled: true };
    }

    logger.info('[webhook] Ignoring unsupported topic (still returning 200)', {
      topic: envelope.topic
    });
    return { handled: false };
  }
};
