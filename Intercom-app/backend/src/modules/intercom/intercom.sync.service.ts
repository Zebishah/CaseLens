import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { INTERCOM_SYNC_STATUS } from '../../constants/intercom.constants.js';
import { classifyProcessingError } from '../ingestion/error-classification.js';
import { conversationRepository, type ConversationRecord } from '../conversation/conversation.repository.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { intercomClient } from './intercom.client.js';
import { buildIntercomIntelligenceNote } from './intercom.sync.util.js';
import { isStaleIntelligencePersist } from '../intelligence/intelligence-revision.util.js';

export type IntercomWritebackResult = {
  status: string;
  skipped: boolean;
  noteId: string | null;
  tags: string[];
};

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && (error.message.toLowerCase().includes('not found') || ('statusCode' in error && (error as { statusCode?: number }).statusCode === 404));

export const syncIntercomIntelligence = async (
  conversationId: number
): Promise<IntercomWritebackResult> => {
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation) {
    throw new Error(`Case not found for Intercom write-back: ${conversationId}`);
  }

  if (!env.INTERCOM_ENABLED || conversation.source !== 'intercom') {
    if (conversation.intercomSyncStatus !== INTERCOM_SYNC_STATUS.SKIPPED) {
      await conversationRepository.updateIntercomSync(conversation.id, {
        status: INTERCOM_SYNC_STATUS.SKIPPED,
        error: null
      });
    }
    return { status: INTERCOM_SYNC_STATUS.SKIPPED, skipped: true, noteId: null, tags: [] };
  }

  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null;
  if (!snapshot || conversation.intelligenceStatus !== 'ready') {
    return {
      status: conversation.intercomSyncStatus ?? INTERCOM_SYNC_STATUS.PENDING,
      skipped: true,
      noteId: conversation.intercomIntelligenceNoteId,
      tags: conversation.intercomSyncTags ?? []
    };
  }

  const { body, fingerprint, marker, tags } = buildIntercomIntelligenceNote(conversation, snapshot);

  const currentMessageCount = await conversationRepository.countMessagesByConversationId(
    conversation.id
  );
  if (
    isStaleIntelligencePersist({
      runMessageCount: snapshot.messageCount ?? currentMessageCount,
      currentMessageCount,
      runSourceUpdatedAt: snapshot.sourceRevision ? new Date(snapshot.sourceRevision) : null,
      currentSourceUpdatedAt: conversation.intercomSourceUpdatedAt
    })
  ) {
    logger.info('[intercom-sync] Skipping write-back — snapshot is older than the current source revision', {
      conversationId: conversation.id,
      intercomId: conversation.intercomId
    });
    return {
      status: conversation.intercomSyncStatus ?? INTERCOM_SYNC_STATUS.PENDING,
      skipped: true,
      noteId: conversation.intercomIntelligenceNoteId,
      tags: conversation.intercomSyncTags ?? []
    };
  }

  if (
    conversation.intercomSyncStatus === INTERCOM_SYNC_STATUS.SYNCED &&
    conversation.intercomSyncFingerprint === fingerprint &&
    conversation.intercomIntelligenceNoteId
  ) {
    return {
      status: INTERCOM_SYNC_STATUS.SYNCED,
      skipped: true,
      noteId: conversation.intercomIntelligenceNoteId,
      tags: conversation.intercomSyncTags ?? tags
    };
  }

  try {
    let noteId = conversation.intercomIntelligenceNoteId;
    if (conversation.intercomSyncFingerprint !== fingerprint || !noteId) {
      const existingNoteId = await intercomClient.findNoteIdByMarker(conversation.intercomId, marker);
      if (existingNoteId) {
        noteId = existingNoteId;
      } else {
        const posted = await intercomClient.replyWithNote(conversation.intercomId, body);
        noteId = posted.noteId;
      }
    }

    const applied = new Set(conversation.intercomSyncTags ?? []);
    if (env.INTERCOM_WRITEBACK_TAGS_ENABLED) {
      try {
        for (const tag of tags) {
          if (applied.has(tag)) {
            continue;
          }
          await intercomClient.ensureConversationTag(conversation.intercomId, tag);
          applied.add(tag);
        }
      } catch (error) {
        const classified = classifyProcessingError(error);
        logger.warn('[intercom-sync] Tag write-back failed independently — note is stored', {
          conversationId: conversation.id,
          intercomId: conversation.intercomId,
          code: classified.code
        });
      }
    }

    const updated = await conversationRepository.updateIntercomSync(conversation.id, {
      status: INTERCOM_SYNC_STATUS.SYNCED,
      noteId,
      fingerprint,
      tags: [...applied],
      error: null,
      lastSyncedAt: new Date()
    });

    logger.info('[intercom-sync] Write-back completed', {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      noteId,
      tags: [...applied]
    });

    return {
      status: updated?.intercomSyncStatus ?? INTERCOM_SYNC_STATUS.SYNCED,
      skipped: false,
      noteId: noteId ?? null,
      tags: [...applied]
    };
  } catch (error) {
    const classified = classifyProcessingError(error);
    const safeMessage = isNotFound(error)
      ? 'Intercom conversation was not found or was deleted.'
      : classified.safeMessage;

    await conversationRepository.updateIntercomSync(conversation.id, {
      status: INTERCOM_SYNC_STATUS.FAILED,
      error: safeMessage,
      fingerprint,
      lastSyncedAt: new Date()
    });

    logger.warn('[intercom-sync] Write-back failed — intelligence snapshot is unchanged', {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      code: classified.code
    });

    return {
      status: INTERCOM_SYNC_STATUS.FAILED,
      skipped: false,
      noteId: conversation.intercomIntelligenceNoteId,
      tags: conversation.intercomSyncTags ?? []
    };
  }
};

export const maybeSyncIntercomAfterIntelligence = async (
  conversation: Pick<ConversationRecord, 'id' | 'source'>
): Promise<void> => {
  if (conversation.source !== 'intercom' || !env.INTERCOM_ENABLED) {
    return;
  }

  await syncIntercomIntelligence(conversation.id);
};
