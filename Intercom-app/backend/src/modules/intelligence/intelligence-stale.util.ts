import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import type { ConversationRecord } from '../conversation/conversation.repository.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { shouldSkipIntelligenceProcessing } from './intelligence-attempt.util.js';

export const getProcessedMessageCount = (
  snapshot: IntelligenceSnapshot | null | undefined
): number | undefined => snapshot?.messageCount;

export const normalizeSubjectForComparison = (subject: string | null | undefined): string =>
  (subject ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const hasNewMessagesSinceLastProcessing = (
  snapshot: IntelligenceSnapshot | null | undefined,
  currentMessageCount: number
): boolean => {
  const processedMessageCount = getProcessedMessageCount(snapshot);

  if (processedMessageCount === undefined) {
    return currentMessageCount > 0;
  }

  return currentMessageCount > processedMessageCount;
};

export const hasSubjectChangedSinceLastProcessing = (
  snapshot: IntelligenceSnapshot | null | undefined,
  currentSubject: string | null | undefined
): boolean => {
  const processedSubject = snapshot?.processedSubject;
  if (processedSubject === undefined || processedSubject === null) {
    return false;
  }

  return (
    normalizeSubjectForComparison(processedSubject) !==
    normalizeSubjectForComparison(currentSubject)
  );
};

export const hasNewerSourceRevision = (
  snapshot: IntelligenceSnapshot | null | undefined,
  sourceUpdatedAt: Date | null | undefined
): boolean => {
  if (!sourceUpdatedAt) {
    return false;
  }

  const processed = snapshot?.sourceRevision;
  if (!processed) {
    return false;
  }

  const processedTs = Date.parse(processed);
  if (Number.isNaN(processedTs)) {
    return false;
  }

  return sourceUpdatedAt.getTime() > processedTs;
};

export const shouldReprocessIntelligence = (
  conversation: Pick<
    ConversationRecord,
    | 'intelligenceStatus'
    | 'intelligenceSnapshot'
    | 'subject'
    | 'rawPayload'
    | 'intercomSourceUpdatedAt'
  >,
  currentMessageCount: number
): boolean => {
  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const resolvedSubject = resolveConversationSubject(conversation);
  const subjectChanged = hasSubjectChangedSinceLastProcessing(snapshot, resolvedSubject);
  const sourceMovedForward = hasNewerSourceRevision(
    snapshot,
    conversation.intercomSourceUpdatedAt
  );

  if (conversation.intelligenceStatus === INTELLIGENCE_STATUS.FAILED) {
    if (shouldSkipIntelligenceProcessing(conversation, currentMessageCount)) {
      return false;
    }

    return (
      hasNewMessagesSinceLastProcessing(snapshot, currentMessageCount) ||
      subjectChanged ||
      sourceMovedForward
    );
  }

  if (!snapshot) {
    return (
      conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING ||
      conversation.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING
    );
  }

  if (hasNewMessagesSinceLastProcessing(snapshot, currentMessageCount) || subjectChanged) {
    return true;
  }

  // Application notes/tags bump Intercom updated_at. That is not new customer content.
  void sourceMovedForward;

  const processedMessageCount = getProcessedMessageCount(snapshot);

  if (
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING ||
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING
  ) {
    const processedSubject = snapshot.processedSubject;
    const snapshotLooksCurrent =
      processedMessageCount !== undefined &&
      currentMessageCount <= processedMessageCount &&
      snapshot.extractionSource === 'gemini' &&
      !subjectChanged &&
      processedSubject !== undefined &&
      processedSubject !== null;

    if (snapshotLooksCurrent) {
      return false;
    }

    return true;
  }

  if (conversation.intelligenceStatus !== INTELLIGENCE_STATUS.READY) {
    return false;
  }

  const mentionStatus = snapshot.employeeMentionStatus;
  const mentionedCount = snapshot.mentionedInReport?.length ?? 0;
  const unresolvedMention =
    mentionStatus === 'unresolved' ||
    mentionStatus === 'ambiguous' ||
    mentionStatus === 'no_employee_mentioned';

  if (
    !unresolvedMention &&
    mentionedCount > snapshot.employeeMatches.length &&
    currentMessageCount > 0
  ) {
    return true;
  }

  const hasNoEmployees =
    snapshot.employeeMatches.length === 0 && (snapshot.mentionedInReport?.length ?? 0) === 0;

  if (hasNoEmployees && currentMessageCount > 0) {
    if (snapshot.extractionSource === 'fallback' || snapshot.extractionSource === undefined) {
      return true;
    }
  }

  if (processedMessageCount === undefined) {
    return currentMessageCount > 1 && snapshot.employeeMatches.length === 0;
  }

  if (
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY &&
    currentMessageCount === processedMessageCount &&
    !subjectChanged
  ) {
    return false;
  }

  return false;
};

/** Fix status left as pending after a valid ready snapshot was already stored. */
export const reconcileIntelligenceStatus = async (
  conversation: ConversationRecord,
  currentMessageCount: number
): Promise<ConversationRecord> => {
  if (conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY) {
    return conversation;
  }

  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  if (!snapshot || snapshot.extractionSource !== 'gemini') {
    return conversation;
  }

  if (hasSubjectChangedSinceLastProcessing(snapshot, resolveConversationSubject(conversation))) {
    return conversation;
  }

  if (
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING &&
    shouldReprocessIntelligence(conversation, currentMessageCount)
  ) {
    return conversation;
  }

  const processedMessageCount = getProcessedMessageCount(snapshot);
  if (
    processedMessageCount === undefined ||
    processedMessageCount < currentMessageCount ||
    conversation.intelligenceStatus !== INTELLIGENCE_STATUS.PENDING
  ) {
    return conversation;
  }

  // Keep PENDING. Re-analyze marks pending on purpose; flipping READY here reused
  // the old snapshot and Canvas showed "No employee identified" after Re-analyze.
  return conversation;
};
