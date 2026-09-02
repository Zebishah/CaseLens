import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import {
  hasSubjectChangedSinceLastProcessing,
  shouldReprocessIntelligence
} from './intelligence-stale.util.js';
import {
  processIntelligenceForConversation,
  type ProcessIntelligenceInput
} from './intelligence.processor.js';

const inFlightByConversationId = new Map<number, Promise<void>>();

const shouldRunAfterInFlightCompleted = async (
  input: ProcessIntelligenceInput
): Promise<boolean> => {
  if (input.forceReprocess === true) {
    return true;
  }

  const conversation = await conversationRepository.findById(input.conversationId);
  if (!conversation) {
    return false;
  }

  const messageCount = await conversationRepository.countMessagesByConversationId(
    input.conversationId
  );
  const snapshot = conversation.intelligenceSnapshot;
  const subjectChanged = hasSubjectChangedSinceLastProcessing(
    snapshot,
    resolveConversationSubject(conversation)
  );
  const pendingReprocess =
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING && Boolean(snapshot);

  return (
    pendingReprocess ||
    subjectChanged ||
    shouldReprocessIntelligence(conversation, messageCount)
  );
};

export const runIntelligenceOnce = async (
  input: ProcessIntelligenceInput,
  depth = 0
): Promise<void> => {
  const inFlight = inFlightByConversationId.get(input.conversationId);
  if (inFlight) {
    logger.info('[intelligence] Waiting for in-flight processing to finish', {
      conversationId: input.conversationId,
      intercomId: input.intercomId,
      source: input.source ?? 'worker'
    });
    await inFlight;

    if (!(await shouldRunAfterInFlightCompleted(input))) {
      logger.info('[intelligence] Skipping redundant processing after in-flight run completed', {
        conversationId: input.conversationId,
        intercomId: input.intercomId,
        source: input.source ?? 'worker'
      });
      return;
    }

    return runIntelligenceOnce(input, depth + 1);
  }

  const processing = processIntelligenceForConversation(input).finally(() => {
    inFlightByConversationId.delete(input.conversationId);
  });

  inFlightByConversationId.set(input.conversationId, processing);
  await processing;

  if (depth < 2 && (await shouldRunAfterInFlightCompleted({ ...input, forceReprocess: false }))) {
    logger.info('[intelligence] Newer messages arrived during processing — running again', {
      conversationId: input.conversationId,
      intercomId: input.intercomId
    });
    return runIntelligenceOnce(input, depth + 1);
  }
};
