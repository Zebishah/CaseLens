import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { env } from '../../config/env.config.js';
import { shouldDispatchQueueJobs } from '../../config/job-processing.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../../utils/error.util.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { classifyProcessingError } from '../ingestion/error-classification.js';
import { processCaseIntelligence } from '../intelligence/process-case-intelligence.js';
import { enqueueIntercomIntelligence } from '../../queues/intercom-intelligence.queue.js';

export type DemoProcessOutcome = {
  conversationId: number;
  status: string;
  outcome: 'completed' | 'failed' | 'queued' | 'in_progress' | 'already_completed';
  snapshot: unknown;
  safeError: string | null;
};

const toOutcome = async (conversationId: number, outcome: DemoProcessOutcome['outcome']): Promise<DemoProcessOutcome> => {
  const row = await conversationRepository.findById(conversationId);
  if (!row) {
    throw AppError.notFound('Case not found');
  }

  return {
    conversationId: row.id,
    status: row.intelligenceStatus,
    outcome,
    snapshot: row.intelligenceSnapshot,
    safeError:
      row.intelligenceStatus === INTELLIGENCE_STATUS.FAILED
        ? 'This case could not be processed. You can retry from Try Demo.'
        : null
  };
};

export const processDemoCase = async (input: {
  sessionId: number;
  conversationId: number;
  force?: boolean;
}): Promise<DemoProcessOutcome> => {
  const conversation = await conversationRepository.findById(input.conversationId);
  if (!conversation || conversation.demoSessionId !== input.sessionId) {
    throw AppError.notFound('Case not found');
  }

  if (
    !input.force &&
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY &&
    conversation.intelligenceSnapshot
  ) {
    return toOutcome(conversation.id, 'already_completed');
  }

  if (!input.force && conversation.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING) {
    return toOutcome(conversation.id, 'in_progress');
  }

  if (shouldDispatchQueueJobs()) {
    await enqueueIntercomIntelligence(
      {
        conversationId: conversation.id,
        intercomId: conversation.intercomId,
        skipSync: true,
        skipPeerRefresh: true,
        forceReprocess: input.force === true
      },
      { jobId: `demo-process-${conversation.id}` }
    );
    return toOutcome(conversation.id, 'queued');
  }

  const claimed = await conversationRepository.claimIntelligenceProcessing(conversation.id);
  if (!claimed) {
    const latest = await conversationRepository.findById(conversation.id);
    if (latest?.intelligenceStatus === INTELLIGENCE_STATUS.READY && latest.intelligenceSnapshot) {
      return toOutcome(latest.id, 'already_completed');
    }
    return toOutcome(conversation.id, 'in_progress');
  }

  try {
    await processCaseIntelligence({
      conversationId: conversation.id,
      forceReprocess: input.force === true || conversation.intelligenceStatus === INTELLIGENCE_STATUS.FAILED,
      skipPeerRefresh: true,
      source: 'inline'
    });
  } catch (error) {
    const classified = classifyProcessingError(error);
    logger.error('[demo-process] Intelligence failed', {
      conversationId: conversation.id,
      code: classified.code
    });
    await conversationRepository.updateIntelligence(conversation.id, {
      status: INTELLIGENCE_STATUS.FAILED,
      snapshot: conversation.intelligenceSnapshot,
      error: 'This case could not be processed. You can retry from Try Demo.'
    });
    return toOutcome(conversation.id, 'failed');
  }

  const finished = await conversationRepository.findById(conversation.id);
  if (!finished) {
    throw AppError.notFound('Case not found');
  }

  if (finished.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING) {
    if (finished.intelligenceSnapshot) {
      await conversationRepository.updateIntelligence(conversation.id, {
        status: INTELLIGENCE_STATUS.READY,
        snapshot: finished.intelligenceSnapshot,
        error: null
      });
    } else {
      await conversationRepository.updateIntelligence(conversation.id, {
        status: INTELLIGENCE_STATUS.FAILED,
        snapshot: null,
        error: 'This case could not be processed. You can retry from Try Demo.'
      });
      return toOutcome(conversation.id, 'failed');
    }
  }

  if (finished.intelligenceStatus === INTELLIGENCE_STATUS.FAILED) {
    return toOutcome(conversation.id, 'failed');
  }

  return toOutcome(conversation.id, 'completed');
};

export const liveAiConfigured = (): boolean =>
  env.LLM_MODE === 'live' && Boolean(env.GEMINI_API_KEY);

export const processingModeLabel = (mode: 'live' | 'fixture'): string =>
  mode === 'live' ? 'Live AI' : 'Deterministic demo';
