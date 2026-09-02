import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import type { ConversationRecord } from '../conversation/conversation.repository.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';

export const MAX_INTELLIGENCE_ATTEMPTS = 3;

export const isQuotaExhaustedError = (message: string): boolean =>
  /Gemini API error 429|quota|depleted|credits are depleted/i.test(message);

export const getFailureAttempts = (
  snapshot: IntelligenceSnapshot | null | undefined
): number => snapshot?.failureAttempts ?? 0;

export const shouldSkipIntelligenceProcessing = (
  conversation: Pick<ConversationRecord, 'intelligenceStatus' | 'intelligenceSnapshot'>,
  currentMessageCount: number
): boolean => {
  if (conversation.intelligenceStatus !== INTELLIGENCE_STATUS.FAILED) {
    return false;
  }

  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const attempts = getFailureAttempts(snapshot);
  const lastAttemptMessageCount = snapshot?.messageCount ?? 0;

  if (attempts >= MAX_INTELLIGENCE_ATTEMPTS) {
    return true;
  }

  return currentMessageCount <= lastAttemptMessageCount;
};
