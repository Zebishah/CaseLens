import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import type { ConversationRecord } from '../conversation/conversation.repository.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import { hasSubjectChangedSinceLastProcessing } from '../intelligence/intelligence-stale.util.js';

export type CanvasSnapshotBanner =
  | 'current'
  | 'pending-update'
  | 'refreshed'
  | 'refresh-pending'
  | 'domain-search-pending'
  | 'store-search-pending';

export type ResolveCanvasSnapshotBannerOptions = {
  /** Live subject from Intercom initialize payload — preferred over stored DB subject. */
  liveSubject?: string | null;
};

export const resolveCanvasSnapshotBanner = (
  conversation: ConversationRecord,
  options?: ResolveCanvasSnapshotBannerOptions
): CanvasSnapshotBanner => {
  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;

  if (!snapshot) {
    return 'current';
  }

  const currentSubject =
    options?.liveSubject !== undefined
      ? options.liveSubject
      : resolveConversationSubject(conversation);

  const subjectDrift = hasSubjectChangedSinceLastProcessing(snapshot, currentSubject);

  if (subjectDrift) {
    return 'pending-update';
  }

  if (conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING || conversation.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING) {
    return 'refresh-pending';
  }

  return 'current';
};
