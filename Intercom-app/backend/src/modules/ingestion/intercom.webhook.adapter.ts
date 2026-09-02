import { logger } from '../../config/logger.config.js';
import { INTERCOM_WEBHOOK_TOPICS } from '../../constants/intercom.constants.js';
import type { IntercomWebhookEnvelope } from '../intercom/intercom.types.js';
import { buildCorrelationId } from './ingestion.normalize.js';
import { ingestionRepository } from './ingestion.repository.js';

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string }).code === '23505';

export const intercomNotificationId = (envelope: IntercomWebhookEnvelope): string => {
  const conversationId = String(
    (envelope.data.item as { id?: string | number }).id ?? envelope.id ?? 'unknown'
  );
  return envelope.id?.trim() || `${envelope.topic}:${conversationId}`;
};

/**
 * Durable Intercom webhook idempotency. Conversation persist stays on the existing
 * Intercom API sync path so characterization tests remain valid. Duplicate
 * notification IDs skip re-sync and re-enqueue.
 */
export const recordIntercomWebhookNotification = async (
  envelope: IntercomWebhookEnvelope
): Promise<{
  duplicate: boolean;
  externalEventId: string;
  inboundEventId: number | null;
  status: string;
}> => {
  if (envelope.topic === INTERCOM_WEBHOOK_TOPICS.PING) {
    return { duplicate: false, externalEventId: envelope.id ?? 'ping', inboundEventId: null, status: 'received' };
  }

  const externalEventId = intercomNotificationId(envelope);
  const existing = await ingestionRepository.findBySourceExternalId('intercom', externalEventId);
  if (existing) {
    await ingestionRepository.incrementAttempt(existing.id);
    logger.info('[intercom-adapter] Duplicate Intercom notification — skipping', {
      inboundEventId: existing.id,
      externalEventId
    });
    return { duplicate: true, externalEventId, inboundEventId: existing.id, status: existing.status };
  }

  try {
    const inserted = await ingestionRepository.insertEvent({
      source: 'intercom',
      externalEventId,
      eventType: envelope.topic,
      payloadHash: externalEventId,
      status: 'received',
      correlationId: buildCorrelationId(),
      processingMode: 'live',
      payload: { topic: envelope.topic },
      receivedAt: new Date()
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await ingestionRepository.findBySourceExternalId('intercom', externalEventId);
      return {
        duplicate: true,
        externalEventId,
        inboundEventId: raced?.id ?? null,
        status: raced?.status ?? 'received'
      };
    }
    logger.error('[intercom-adapter] Failed to record inbound Intercom event', {
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  return { duplicate: false, externalEventId, inboundEventId: inserted.id, status: inserted.status };
};
