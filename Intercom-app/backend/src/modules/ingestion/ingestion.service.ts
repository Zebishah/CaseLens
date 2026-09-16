import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { db, type Database } from '../../database/connection.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { parseReporterContext } from '../employee/employee.reporter-context.util.js';
import { enqueueIntercomIntelligence } from '../../queues/intercom-intelligence.queue.js';
import { classifyProcessingError } from './error-classification.js';
import {
  buildSourceExternalId,
  hashIngestionPayload,
  normalizeIngestionEvent
} from './ingestion.normalize.js';
import { ingestionRepository } from './ingestion.repository.js';
import type { CaseIngestionEvent } from './ingestion.types.js';
import { env } from '../../config/env.config.js';
import { ADVISORY_LOCK_NAMESPACE, withPostgresAdvisoryLock } from '../../database/postgres-advisory-lock.js';
import { revisionKeyFromSource } from '../intelligence/intelligence-revision.util.js';

export type IngestResult = {
  duplicate: boolean;
  inboundEventId: number;
  conversationId: number | null;
  correlationId: string;
  status: string;
};

const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: string }).code;
  return code === '23505';
};

type IngestionExecutor = Pick<Database, 'insert' | 'update' | 'delete' | 'query'>;

const persistConversation = async (
  event: CaseIngestionEvent,
  executor: IngestionExecutor = db
) => {
  const reporter = parseReporterContext(event.senderName ?? null, event.senderEmail);
  const externalId = buildSourceExternalId(event.source, event.receivedEmailId || event.externalEventId);

  return conversationRepository.upsertFromIntercom(
    {
      intercomId: event.source === 'intercom' ? event.externalEventId : externalId,
      subject: event.subject ?? null,
      status: 'open',
      reporterName: event.senderName ?? null,
      reporterEmail: event.senderEmail,
      reporterStoreNumber: reporter.storeNumber,
      reporterCompanyDomain: reporter.domain,
      companyName: null,
      intercomContactId: null,
      assignedIntercomAdminId: null,
      source: event.source,
      correlationId: event.correlationId,
      processingMode: event.processingMode,
      demoSessionId: event.demoSessionId ? Number(event.demoSessionId) || null : null,
      rawPayload: {
        source: event.source,
        correlationId: event.correlationId,
        processingMode: event.processingMode,
        providerMetadata: event.providerMetadata,
        recipients: event.recipients
      }
    },
    event.plainTextContent
      ? [
          {
            intercomPartId: `${externalId}-initial`,
            senderType: 'user',
            senderId: event.senderEmail,
            messageBody: event.plainTextContent
          }
        ]
      : [],
    INTELLIGENCE_STATUS.PENDING,
    { executor }
  );
};

export const ingestionService = {
  async ingest(eventInput: CaseIngestionEvent): Promise<IngestResult> {
    const event = normalizeIngestionEvent(eventInput);
    const payloadHash = hashIngestionPayload(event);

    if (event.receivedEmailId) {
      const byEmail = await ingestionRepository.findByReceivedEmailId(event.receivedEmailId);
      if (byEmail?.conversationId) {
        await ingestionRepository.incrementAttempt(byEmail.id);
        logger.info('[ingestion] Duplicate received-email id — returning existing event', {
          correlationId: event.correlationId,
          inboundEventId: byEmail.id
        });
        return {
          duplicate: true,
          inboundEventId: byEmail.id,
          conversationId: byEmail.conversationId,
          correlationId: byEmail.correlationId,
          status: byEmail.status
        };
      }
    }

    const existing = await ingestionRepository.findBySourceExternalId(
      event.source,
      event.externalEventId
    );
    if (existing?.conversationId) {
      await ingestionRepository.incrementAttempt(existing.id);
      logger.info('[ingestion] Duplicate source+externalEventId — returning existing event', {
        correlationId: event.correlationId,
        inboundEventId: existing.id
      });
      return {
        duplicate: true,
        inboundEventId: existing.id,
        conversationId: existing.conversationId,
        correlationId: existing.correlationId,
        status: existing.status
      };
    }

    if (existing && !existing.conversationId) {
      const conversation = await persistConversation(event);
      const sourceRevision = revisionKeyFromSource(
        event.plainTextContent ? 1 : 0,
        conversation.intercomSourceUpdatedAt
      );
      const jobId = event.externalEventId.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 120);
      const outbox = await ingestionRepository.findOutboxForEvent(existing.id, 'process-intelligence') ??
        await ingestionRepository.insertOutbox({
          inboundEventId: existing.id,
          jobName: 'process-intelligence',
          jobId,
          payload: {
            conversationId: conversation.id,
            intercomId: conversation.intercomId,
            skipSync: event.source !== 'intercom',
            sourceRevision,
            processingMode: event.processingMode,
            correlationId: event.correlationId,
            inboundEventId: existing.id
          },
          status: 'pending',
          correlationId: event.correlationId
        });
      await enqueueIntercomIntelligence(
        {
          conversationId: conversation.id,
          intercomId: conversation.intercomId,
          skipSync: event.source !== 'intercom',
          sourceRevision
        },
        { jobId }
      );
      await ingestionRepository.markDispatched(outbox.id);
      await ingestionRepository.markCompleted(existing.id, conversation.id);
      return {
        duplicate: false,
        inboundEventId: existing.id,
        conversationId: conversation.id,
        correlationId: existing.correlationId,
        status: 'queued'
      };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const inbound = await ingestionRepository.insertEvent(
          {
            source: event.source,
            externalEventId: event.externalEventId,
            receivedEmailId: event.receivedEmailId ?? null,
            eventType: `${event.source}.received`,
            payloadHash,
            status: 'received',
            correlationId: event.correlationId,
            demoSessionId: event.demoSessionId ? Number(event.demoSessionId) || null : null,
            processingMode: event.processingMode,
            payload: {
              senderEmail: event.senderEmail,
              subject: event.subject,
              recipientCount: event.recipients.length,
              processingMode: event.processingMode
            },
            receivedAt: event.receivedAt
          },
          tx
        );

        const conversation = await persistConversation(event, tx);
        const jobId = event.externalEventId.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 120);
        const sourceRevision = revisionKeyFromSource(
          event.plainTextContent ? 1 : 0,
          conversation.intercomSourceUpdatedAt
        );

        const outbox = await ingestionRepository.insertOutbox(
          {
            inboundEventId: inbound.id,
            jobName: 'process-intelligence',
            jobId,
            payload: {
              conversationId: conversation.id,
              intercomId: conversation.intercomId,
              skipSync: event.source !== 'intercom',
              sourceRevision,
              processingMode: event.processingMode,
              correlationId: event.correlationId,
              inboundEventId: inbound.id
            },
            status: 'pending',
            correlationId: event.correlationId
          },
          tx
        );

        return { inbound, conversation, outbox };
      });

      await ingestionRepository.markQueued(result.inbound.id);

      try {
        await enqueueIntercomIntelligence(
          {
            conversationId: result.conversation.id,
            intercomId: result.conversation.intercomId,
            skipSync: event.source !== 'intercom',
            sourceRevision: revisionKeyFromSource(
              event.plainTextContent ? 1 : 0,
              result.conversation.intercomSourceUpdatedAt
            )
          },
          { jobId: result.outbox.jobId }
        );
        await ingestionRepository.markDispatched(result.outbox.id);
      } catch (error) {
        const classified = classifyProcessingError(error);
        logger.error('[ingestion] Outbox dispatch failed — event is durable and recoverable', {
          inboundEventId: result.inbound.id,
          correlationId: event.correlationId,
          code: classified.code
        });
      }

      return {
        duplicate: false,
        inboundEventId: result.inbound.id,
        conversationId: result.conversation.id,
        correlationId: event.correlationId,
        status: 'queued'
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced =
          (event.receivedEmailId
            ? await ingestionRepository.findByReceivedEmailId(event.receivedEmailId)
            : undefined) ??
          (await ingestionRepository.findBySourceExternalId(event.source, event.externalEventId));

        if (raced) {
          return {
            duplicate: true,
            inboundEventId: raced.id,
            conversationId: raced.conversationId,
            correlationId: raced.correlationId,
            status: raced.status
          };
        }
      }

      throw error;
    }
  },

  async recoverPendingOutbox(limit?: number): Promise<number> {
    const isApifyMode = env.JOB_PROCESSING_MODE === 'apify';
    const batchLimit = limit ?? (isApifyMode ? 20 : 50);
    const boundedLimit = isApifyMode
      ? Math.min(Math.max(Math.trunc(batchLimit), 1), 20)
      : Math.min(Math.max(Math.trunc(batchLimit), 1), 100);
    const recover = async (): Promise<number> => {
      const pending = await ingestionRepository.listPendingOutbox(boundedLimit);
      let dispatched = 0;
      let failed = 0;
      let nextIndex = 0;

      const dispatchRow = async (row: (typeof pending)[number]): Promise<void> => {
        const payload = row.payload as {
          conversationId?: number;
          intercomId?: string;
          emailId?: string;
          inboundEventId?: number;
          correlationId?: string;
          webhookId?: string;
          skipSync?: boolean;
          sourceRevision?: string;
          forceReprocess?: boolean;
        };
        try {
          if (row.jobName === 'fetch-resend-email' && payload.emailId && payload.inboundEventId) {
            if (env.JOB_PROCESSING_MODE !== 'bullmq') return;
            const { enqueueResendEmailFetch } = await import('../resend/resend.queue.js');
            await enqueueResendEmailFetch({
              emailId: payload.emailId,
              inboundEventId: payload.inboundEventId,
              correlationId: payload.correlationId ?? row.correlationId,
              webhookId: payload.webhookId ?? row.jobId
            });
          } else if (row.jobName === 'process-intelligence') {
            if (!payload.conversationId || !payload.intercomId) return;
            await enqueueIntercomIntelligence(
              {
                conversationId: payload.conversationId,
                intercomId: payload.intercomId,
                skipSync: payload.skipSync ?? true,
                sourceRevision: payload.sourceRevision,
                forceReprocess: payload.forceReprocess
              },
              { jobId: row.jobId }
            );
          } else {
            return;
          }
          await ingestionRepository.markDispatched(row.id);
          dispatched += 1;
        } catch (error) {
          failed += 1;
          logger.error('[ingestion] Outbox recovery dispatch failed', {
            outboxId: row.id,
            jobName: row.jobName,
            code: classifyProcessingError(error).code
          });
        }
      };

      const worker = async (): Promise<void> => {
        while (nextIndex < pending.length) {
          const row = pending[nextIndex++];
          if (row) await dispatchRow(row);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(isApifyMode ? 5 : 1, pending.length) }, () => worker())
      );
      logger.info('[ingestion] Outbox recovery batch finished', {
        pendingCount: pending.length,
        dispatchedCount: dispatched,
        failedCount: failed
      });
      return dispatched;
    };

    if (isApifyMode) {
      return withPostgresAdvisoryLock(ADVISORY_LOCK_NAMESPACE.outboxRecovery, 1, recover);
    }
    return recover();
  }
};
