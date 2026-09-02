import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { runIntelligenceOnce } from './intelligence-processing.lock.js';

export const processCaseIntelligence = async (input: {
  conversationId: number;
  forceReprocess?: boolean;
  skipPeerRefresh?: boolean;
  source?: 'worker' | 'canvas' | 'inline';
}): Promise<void> => {
  const conversation = await conversationRepository.findById(input.conversationId);
  if (!conversation) {
    throw new Error(`Case not found for intelligence processing: ${input.conversationId}`);
  }

  const skipSync = conversation.source !== 'intercom' || !env.INTERCOM_ENABLED;
  const skipPeerRefresh =
    input.skipPeerRefresh === true || conversation.source !== 'intercom' || env.JOB_PROCESSING_MODE === 'inline';

  logger.info('[intelligence] processCaseIntelligence', {
    conversationId: conversation.id,
    source: conversation.source,
    skipSync,
    skipPeerRefresh,
    jobProcessingMode: env.JOB_PROCESSING_MODE,
    processingMode: conversation.processingMode
  });

  await runIntelligenceOnce({
    conversationId: conversation.id,
    intercomId: conversation.intercomId,
    skipSync,
    forceReprocess: input.forceReprocess,
    skipPeerRefresh,
    source: input.source === 'canvas' ? 'canvas' : 'worker'
  });
};
