import {
  CANVAS_DISMISS_TOTAL_BUDGET_MS,
  CANVAS_INITIALIZE_WAIT_MS,
  CANVAS_INTELLIGENCE_POLL_MS,
  CANVAS_REFRESH_SYNC_TIMEOUT_MS,
  CANVAS_REFRESH_TOTAL_BUDGET_MS,
  CANVAS_REFRESH_WAIT_MS
} from '../../constants/canvas.timing.constants.js';
import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { retryAsync } from '../../utils/retry.util.js';
import { toPublicCanvasErrorMessage } from './canvas-error-message.util.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import type { ConversationRecord } from '../conversation/conversation.repository.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { conversationService } from '../conversation/conversation.service.js';
import {
  resolveConversationSubject,
  resolveConversationSubjectFromIntercomPayload
} from '../conversation/conversation-subject.util.js';
import type { CanvasInitializePayload, CanvasSubmitPayload } from '../intercom/intercom.types.js';
import { enqueueIntelligenceForConversation } from '../../queues/intercom-intelligence.queue.js';
import {
  hasSubjectChangedSinceLastProcessing,
  reconcileIntelligenceStatus,
  shouldReprocessIntelligence
} from '../intelligence/intelligence-stale.util.js';
import { intelligenceService } from '../intelligence/intelligence.service.js';
import { parseReporterContext } from '../employee/employee.reporter-context.util.js';
import {
  ccRecipientsService,
  type CcRecipientsResult
} from '../store-directory/cc-recipients.service.js';
import {
  type CanvasSnapshotBanner,
  resolveCanvasSnapshotBanner
} from './canvas-snapshot-banner.util.js';
import {
  canvasBuilder,
  type CanvasScopeSearchContext,
  EDIT_MANUAL_STORE_NUMBER_COMPONENT_ID,
  MANUAL_STORE_NUMBER_INPUT_ID,
  REANALYZE_INTELLIGENCE_COMPONENT_ID,
  REFRESH_INTELLIGENCE_COMPONENT_ID,
  SUBMIT_MANUAL_STORE_NUMBER_COMPONENT_ID
} from './canvas.builder.js';
import {
  parseDismissCategoryCaseComponentId,
  parseDismissRelatedCaseComponentId
} from './related-case-dismiss.util.js';
import { elapsedMs } from '../../utils/timing.util.js';
import type { CanvasResponse } from './canvas.types.js';
import { normalizeStoreNumber } from '../store-directory/store-directory.parser.js';

const normalizeIntercomConversationId = (conversationId: string | number): string =>
  String(conversationId);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const ensureConversationReadyForCanvas = async (
  intercomId: string
): Promise<ConversationRecord> => {
  const { record: synced } = await conversationService.ensureSyncedFromIntercomApi(intercomId, {
    enqueue: false
  });
  let conversation = synced;

  if (!conversation) {
    throw new Error(`Failed to sync conversation from Intercom: ${intercomId}`);
  }

  const messageCount = await conversationRepository.countMessagesByConversationId(conversation.id);
  conversation = await reconcileIntelligenceStatus(conversation, messageCount);

  if (!shouldReprocessIntelligence(conversation, messageCount)) {
    return conversation;
  }

  logger.info('[canvas] Enqueueing intelligence processing for new conversation', {
    intercomId,
    conversationId: conversation.id,
    intelligenceStatus: conversation.intelligenceStatus,
    messageCount
  });

  void enqueueIntelligenceForConversation(conversation, {
    messageCount,
    skipSync: true
  }).catch((error: unknown) => {
    logger.error('[canvas] Failed to enqueue intelligence job — sidebar will show pending', {
      intercomId,
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return conversation;
};

const toCanvasErrorMessage = (error: unknown): string => toPublicCanvasErrorMessage(error);

const loadConversationForCanvas = async (
  intercomId: string
): Promise<ConversationRecord | null> => {
  const conversation = await conversationRepository.findByIntercomId(intercomId);
  if (!conversation) {
    return null;
  }

  const messageCount = await conversationRepository.countMessagesByConversationId(conversation.id);
  return reconcileIntelligenceStatus(conversation, messageCount);
};

const waitForConversationIntelligence = async (
  intercomId: string,
  maxWaitMs: number
): Promise<ConversationRecord | null> => {
  const deadline = Date.now() + maxWaitMs;

  do {
    const conversation = await loadConversationForCanvas(intercomId);
    if (conversation?.intelligenceSnapshot) {
      return conversation;
    }

    if (Date.now() >= deadline) {
      break;
    }

    await sleep(CANVAS_INTELLIGENCE_POLL_MS);
  } while (Date.now() < deadline);

  return loadConversationForCanvas(intercomId);
};

const waitForSnapshotRefresh = async (
  intercomId: string,
  previousProcessedAt: string | undefined,
  maxWaitMs: number
): Promise<ConversationRecord | null> => {
  const deadline = Date.now() + maxWaitMs;

  do {
    const conversation = await loadConversationForCanvas(intercomId);
    const processedAt = (
      conversation?.intelligenceSnapshot as IntelligenceSnapshot | null | undefined
    )?.processedAt;

    if (
      conversation?.intelligenceSnapshot &&
      processedAt &&
      processedAt !== previousProcessedAt
    ) {
      return conversation;
    }

    if (Date.now() >= deadline) {
      break;
    }

    await sleep(CANVAS_INTELLIGENCE_POLL_MS);
  } while (Date.now() < deadline);

  return loadConversationForCanvas(intercomId);
};

const waitForReadyIntelligence = async (
  intercomId: string,
  maxWaitMs: number
): Promise<ConversationRecord | null> => {
  const deadline = Date.now() + maxWaitMs;

  do {
    const conversation = await loadConversationForCanvas(intercomId);
    if (
      conversation?.intelligenceSnapshot &&
      conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY
    ) {
      return conversation;
    }

    if (Date.now() >= deadline) {
      break;
    }

    await sleep(CANVAS_INTELLIGENCE_POLL_MS);
  } while (Date.now() < deadline);

  return loadConversationForCanvas(intercomId);
};

const enqueueCanvasIntelligence = async (input: {
  conversation: ConversationRecord;
  forceReprocess?: boolean;
  skipSync?: boolean;
}): Promise<void> => {
  const messageCount = await conversationRepository.countMessagesByConversationId(
    input.conversation.id
  );
  await enqueueIntelligenceForConversation(input.conversation, {
    messageCount,
    skipSync: input.skipSync ?? true,
    forceReprocess: input.forceReprocess,
    skipPeerRefresh: true
  });
};

const resolveScopeSearchContext = (
  conversation: ConversationRecord
): CanvasScopeSearchContext => {
  const reporterContext = parseReporterContext(
    conversation.reporterName,
    conversation.reporterEmail
  );

  return {
    storeNumber: conversation.reporterStoreNumber ?? reporterContext.storeNumber,
    companyDomain: conversation.reporterCompanyDomain ?? reporterContext.domain
  };
};

/** Read-only CC lookup — uses existing store number; does not change matching logic. */
const resolveCcRecipientsForConversation = async (
  conversation: ConversationRecord
): Promise<CcRecipientsResult> => {
  const scope = resolveScopeSearchContext(conversation);
  return ccRecipientsService.resolveForStoreNumber(
    scope.storeNumber,
    conversation.reporterEmail
  );
};

/** Ignore stale cached no_store when the conversation now has a store number after sync/re-analyze. */
const resolveCcRecipientsForCanvasDisplay = async (
  conversation: ConversationRecord,
  cached?: CcRecipientsResult | null
): Promise<CcRecipientsResult | null> => {
  const scope = resolveScopeSearchContext(conversation);
  const liveStoreNumber = scope.storeNumber?.trim() ?? null;

  if (!liveStoreNumber) {
    return cached ?? (await resolveCcRecipientsForConversation(conversation));
  }

  if (
    !cached ||
    cached.status === 'no_store' ||
    (cached.storeNumber && cached.storeNumber !== liveStoreNumber)
  ) {
    return resolveCcRecipientsForConversation(conversation);
  }

  return cached;
};

const respondAfterBackgroundIntelligence = async (input: {
  intercomId: string;
  conversation: ConversationRecord;
  previousProcessedAt: string | undefined;
  maxWaitMs: number;
  pendingFallback: () => CanvasResponse | Promise<CanvasResponse>;
}): Promise<CanvasResponse> => {
  const refreshed = await waitForSnapshotRefresh(
    input.intercomId,
    input.previousProcessedAt,
    input.maxWaitMs
  );

  // Ready within the wait window → show fresh intelligence.
  // Prefer "Results updated." whenever status is READY — never leave "Still updating…"
  // sitting on top of finished results.
  if (refreshed?.intelligenceSnapshot) {
    const processedAt = (refreshed.intelligenceSnapshot as IntelligenceSnapshot).processedAt;
    const hasNewSnapshot = processedAt !== input.previousProcessedAt;
    const isReady = refreshed.intelligenceStatus === INTELLIGENCE_STATUS.READY;

    if (hasNewSnapshot || isReady) {
      return buildCanvasFromStoredSnapshot(refreshed, 'refreshed', { cacheOnly: true });
    }
  }

  // Still processing → keep last results (if any) with a still-updating hint.
  return input.pendingFallback();
};

const buildCanvasFromStoredSnapshot = async (
  conversation: ConversationRecord,
  banner?: CanvasSnapshotBanner,
  options?: {
    cacheOnly?: boolean;
    editingStore?: boolean;
    storeInputRequired?: boolean;
  }
): Promise<CanvasResponse> => {
  const stored = conversation.intelligenceSnapshot as IntelligenceSnapshot;
  const scopeSearch = resolveScopeSearchContext(conversation);
  const resolvedBanner = banner ?? resolveCanvasSnapshotBanner(conversation);
  const editorOptions = {
    editingStore: options?.editingStore === true,
    storeInputRequired: options?.storeInputRequired === true
  };

  // Fast path: render saved snapshot. Re-resolve CC when store number changed since cache was written.
  if (options?.cacheOnly) {
    const ccRecipients = await resolveCcRecipientsForCanvasDisplay(
      conversation,
      stored.ccRecipients ?? null
    );

    return canvasBuilder.buildIntelligenceSnapshot(stored, {
      banner: resolvedBanner,
      scopeSearch,
      ccRecipients,
      intercomSyncFailed: conversation.intercomSyncStatus === 'failed',
      ...editorOptions
    });
  }

  const snapshot = await intelligenceService.enrichSnapshotForCanvasDisplay(conversation, stored);
  const ccRecipients = await resolveCcRecipientsForCanvasDisplay(
    conversation,
    stored.ccRecipients ?? null
  );

  // Persist refreshed CC so the next initialize can stay cache-only.
  if (ccRecipients && conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY) {
    const nextSnapshot: IntelligenceSnapshot = { ...snapshot, ccRecipients };
    void conversationRepository
      .updateIntelligence(conversation.id, {
        status: INTELLIGENCE_STATUS.READY,
        snapshot: nextSnapshot,
        error: null
      })
      .catch((error: unknown) => {
        logger.warn('[canvas] Failed to persist cached CC recipients', {
          conversationId: conversation.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });
  }

  return canvasBuilder.buildIntelligenceSnapshot(snapshot, {
    banner: resolvedBanner,
    scopeSearch,
    ccRecipients,
    intercomSyncFailed: conversation.intercomSyncStatus === 'failed',
    ...editorOptions
  });
};

const buildPendingPreviewFromConversation = async (
  conversation: ConversationRecord
): Promise<CanvasResponse> => {
  const ccRecipients = await resolveCcRecipientsForConversation(conversation);
  return canvasBuilder.buildPending(
    {
      reporterName: conversation.reporterName,
      caseType: conversation.caseType,
      subject: resolveConversationSubject(conversation),
      rawPayload: conversation.rawPayload
    },
    ccRecipients
  );
};

const buildCanvasFromConversation = async (
  conversation: ConversationRecord,
  options?: {
    useLiveSnapshot?: boolean;
    /** Skip enrich + live CC — render saved snapshot only (fast 2nd open). */
    cacheOnly?: boolean;
    banner?: CanvasSnapshotBanner;
    liveSubject?: string | null;
  }
): Promise<{ response: CanvasResponse; relatedCaseCount: number | null }> => {
  if (conversation.intelligenceStatus === INTELLIGENCE_STATUS.FAILED) {
    return {
      response: canvasBuilder.buildFailed(conversation.intelligenceError),
      relatedCaseCount: null
    };
  }

  if (!conversation.intelligenceSnapshot) {
    return {
      response: await buildPendingPreviewFromConversation(conversation),
      relatedCaseCount: null
    };
  }

  const banner =
    options?.banner ??
    resolveCanvasSnapshotBanner(conversation, { liveSubject: options?.liveSubject });

  if (!options?.useLiveSnapshot) {
    const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot;
    return {
      response: await buildCanvasFromStoredSnapshot(conversation, banner, {
        cacheOnly: options?.cacheOnly === true
      }),
      relatedCaseCount: snapshot.relatedCases.length
    };
  }

  const snapshot = await intelligenceService.buildLiveCanvasSnapshot(conversation);
  const ccRecipients = await resolveCcRecipientsForConversation(conversation);

  return {
    response: canvasBuilder.buildIntelligenceSnapshot(snapshot, {
      banner,
      scopeSearch: resolveScopeSearchContext(conversation),
      ccRecipients
    }),
    relatedCaseCount: snapshot.relatedCases.length
  };
};

const remainingBudgetMs = (startedAt: number, budgetMs: number): number =>
  Math.max(0, budgetMs - elapsedMs(startedAt));

const isIntelligenceStillRunning = (conversation: ConversationRecord): boolean =>
  conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING ||
  conversation.intelligenceStatus === INTELLIGENCE_STATUS.PROCESSING;

const withTimeoutFallback = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> => {
  if (timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    })
  ]);
};

const buildUpdatingIntelligenceResponse = async (
  conversation: ConversationRecord,
  intercomId: string
): Promise<CanvasResponse> => {
  const latest = (await loadConversationForCanvas(intercomId)) ?? conversation;

  // Keep last known results visible while background AI finishes — never wipe the sidebar
  // down to CC-only / empty "still updating" when a snapshot already exists.
  if (latest.intelligenceSnapshot) {
    // If analysis already finished, do NOT show "Still updating… click Refresh".
    if (latest.intelligenceStatus === INTELLIGENCE_STATUS.READY) {
      return buildCanvasFromStoredSnapshot(latest, 'refreshed', { cacheOnly: true });
    }

    return buildCanvasFromStoredSnapshot(latest, 'refresh-pending', { cacheOnly: true });
  }

  return canvasBuilder.buildUpdatingIntelligence(null);
};

const refreshIntelligenceForCanvas = async (intercomId: string): Promise<CanvasResponse> => {
  const startedAt = Date.now();
  let conversation = await conversationRepository.findByIntercomId(intercomId);
  if (!conversation) {
    return canvasBuilder.buildNotSynced();
  }

  const previousProcessedAt = (
    conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined
  )?.processedAt;

  const messageCount = await conversationRepository.countMessagesByConversationId(conversation.id);
  conversation = await reconcileIntelligenceStatus(conversation, messageCount);

  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const subject = resolveConversationSubject(conversation);
  const subjectDrift = hasSubjectChangedSinceLastProcessing(snapshot, subject);

  // Soft Refresh with ready results and no subject edit → return snapshot immediately.
  // Never sync/reprocess here — that wiped results and left "Still updating…" forever.
  // Use Re-analyze when a full redo is needed.
  if (
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.READY &&
    snapshot &&
    !subjectDrift
  ) {
    logger.info('[canvas] Refresh — showing ready snapshot without reprocess', {
      intercomId,
      conversationId: conversation.id
    });
    return buildCanvasFromStoredSnapshot(conversation, 'refreshed', { cacheOnly: true });
  }

  // Pending background job — poll briefly, then keep last results visible.
  if (conversation.intelligenceStatus === INTELLIGENCE_STATUS.PENDING) {
    logger.info('[canvas] Refresh — pending job in progress, polling DB only', {
      intercomId,
      conversationId: conversation.id
    });

    const ready = await waitForReadyIntelligence(
      intercomId,
      remainingBudgetMs(startedAt, CANVAS_REFRESH_WAIT_MS)
    );
    if (
      ready?.intelligenceSnapshot &&
      ready.intelligenceStatus === INTELLIGENCE_STATUS.READY
    ) {
      return buildCanvasFromStoredSnapshot(ready, 'refreshed', { cacheOnly: true });
    }

    if (!ready?.intelligenceSnapshot && !conversation.intelligenceSnapshot) {
      const pendingConversationId = conversation.id;
      const pendingIntercomId = conversation.intercomId;
      void enqueueCanvasIntelligence({
        conversation,
        forceReprocess: true,
        skipSync: true
      }).catch((error: unknown) => {
        logger.error('[canvas] Refresh — failed to re-enqueue pending intelligence job', {
          intercomId: pendingIntercomId,
          conversationId: pendingConversationId,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    return buildUpdatingIntelligenceResponse(ready ?? conversation, intercomId);
  }

  // Subject changed / failed / missing snapshot — enqueue reprocess, but never blank the sidebar.
  const needsNewJob =
    subjectDrift ||
    conversation.intelligenceStatus === INTELLIGENCE_STATUS.FAILED ||
    !snapshot ||
    shouldReprocessIntelligence(conversation, messageCount);

  if (needsNewJob) {
    logger.info('[canvas] Refresh — enqueueing background intelligence reprocess', {
      intercomId,
      conversationId: conversation.id,
      subjectDrift,
      status: conversation.intelligenceStatus
    });

    try {
      await enqueueCanvasIntelligence({
        conversation,
        forceReprocess: true,
        skipSync: true
      });
    } catch (error) {
      logger.error('[canvas] Refresh — failed to enqueue intelligence job', {
        intercomId,
        conversationId: conversation.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return buildUpdatingIntelligenceResponse(conversation, intercomId);
    }

    return respondAfterBackgroundIntelligence({
      intercomId,
      conversation,
      previousProcessedAt,
      maxWaitMs: remainingBudgetMs(startedAt, CANVAS_REFRESH_WAIT_MS),
      pendingFallback: async () => buildUpdatingIntelligenceResponse(conversation, intercomId)
    });
  }

  if (snapshot) {
    return buildCanvasFromStoredSnapshot(conversation, 'refreshed', { cacheOnly: true });
  }

  return buildUpdatingIntelligenceResponse(conversation, intercomId);
};

/** Hard refresh: always force a full intelligence reprocess. */
const reanalyzeIntelligenceForCanvas = async (intercomId: string): Promise<CanvasResponse> => {
  const startedAt = Date.now();
  let conversation = await conversationRepository.findByIntercomId(intercomId);
  if (!conversation) {
    return canvasBuilder.buildNotSynced();
  }

  const previousProcessedAt = (
    conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined
  )?.processedAt;
  const previousSnapshot = conversation.intelligenceSnapshot;

  logger.info('[canvas] Re-analyze — syncing conversation from Intercom', {
    intercomId,
    conversationId: conversation.id
  });

  const syncTimeoutMs = Math.min(
    CANVAS_REFRESH_SYNC_TIMEOUT_MS,
    remainingBudgetMs(startedAt, CANVAS_REFRESH_TOTAL_BUDGET_MS)
  );
  const syncedResult = await withTimeoutFallback(
    conversationService.ensureSyncedFromIntercomApi(intercomId, {
      enqueue: false,
      deferSubjectReprocess: true
    }),
    syncTimeoutMs,
    null
  );

  if (!syncedResult) {
    logger.warn('[canvas] Re-analyze — Intercom sync timed out, continuing with DB conversation', {
      intercomId,
      conversationId: conversation.id,
      syncTimeoutMs
    });
  } else {
    const messageCount = await conversationRepository.countMessagesByConversationId(
      syncedResult.record.id
    );
    conversation = await reconcileIntelligenceStatus(syncedResult.record, messageCount);
  }

  logger.info('[canvas] Re-analyze — enqueueing force intelligence reprocess', {
    intercomId,
    conversationId: conversation.id,
    status: conversation.intelligenceStatus
  });

  if (conversation.intelligenceStatus !== INTELLIGENCE_STATUS.PENDING) {
    await conversationRepository.markIntelligencePending(conversation.id);
    conversation =
      (await conversationRepository.findById(conversation.id)) ?? conversation;
  }

  try {
    await enqueueCanvasIntelligence({
      conversation,
      forceReprocess: true,
      skipSync: true
    });
  } catch (error) {
    logger.error('[canvas] Re-analyze — failed to enqueue intelligence job', {
      intercomId,
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : String(error)
    });

    // Still return a usable canvas — prefer last snapshot over empty/hanging UI.
    if (previousSnapshot || conversation.intelligenceSnapshot) {
      return buildUpdatingIntelligenceResponse(conversation, intercomId);
    }
    return canvasBuilder.buildUpdatingIntelligence(null);
  }

  return respondAfterBackgroundIntelligence({
    intercomId,
    conversation,
    previousProcessedAt,
    maxWaitMs: remainingBudgetMs(startedAt, CANVAS_REFRESH_WAIT_MS),
    pendingFallback: async () => buildUpdatingIntelligenceResponse(conversation, intercomId)
  });
};

const buildCanvasAfterDismissCase = async (
  intercomId: string,
  dismissedRelatedIntercomId: string | null,
  dismissedCategoryIntercomId: string | null
): Promise<CanvasResponse> => {
  const conversation = await conversationRepository.findByIntercomId(intercomId);
  if (!conversation) {
    return canvasBuilder.buildNotSynced();
  }

  const updated =
    (dismissedCategoryIntercomId
      ? await conversationRepository.dismissCategoryCase(
          conversation.id,
          dismissedCategoryIntercomId
        )
      : await conversationRepository.dismissRelatedCase(
          conversation.id,
          dismissedRelatedIntercomId!
        )) ?? conversation;

  const { response } = await buildCanvasFromConversation(updated, {
    useLiveSnapshot: false,
    cacheOnly: true
  });
  return response;
};

const readManualStoreNumberInput = (
  inputValues: Record<string, unknown> | undefined
): string | null => {
  const raw = inputValues?.[MANUAL_STORE_NUMBER_INPUT_ID];
  if (typeof raw !== 'string') {
    return null;
  }

  return normalizeStoreNumber(raw);
};

const buildCanvasWithStoreEditor = async (
  conversation: ConversationRecord,
  options?: { storeInputRequired?: boolean }
): Promise<CanvasResponse> => {
  const stored = conversation.intelligenceSnapshot as IntelligenceSnapshot | null;
  const ccRecipients =
    stored?.ccRecipients ?? (await resolveCcRecipientsForConversation(conversation));
  const editorOptions = {
    editingStore: true as const,
    storeInputRequired: options?.storeInputRequired === true
  };

  if (stored) {
    return buildCanvasFromStoredSnapshot(conversation, 'current', {
      cacheOnly: true,
      ...editorOptions
    });
  }

  return canvasBuilder.buildPending(
    {
      reporterName: conversation.reporterName,
      caseType: conversation.caseType,
      subject: resolveConversationSubject(conversation),
      rawPayload: conversation.rawPayload
    },
    ccRecipients,
    editorOptions
  );
};

const applyManualStoreNumberForCanvas = async (
  intercomId: string,
  inputValues: Record<string, unknown> | undefined
): Promise<CanvasResponse> => {
  const conversation = await conversationRepository.findByIntercomId(intercomId);
  if (!conversation) {
    return canvasBuilder.buildNotSynced();
  }

  const storeNumber = readManualStoreNumberInput(inputValues);
  if (!storeNumber) {
    logger.info('[canvas] Manual store submit without a store number', { intercomId });
    return buildCanvasWithStoreEditor(conversation, { storeInputRequired: true });
  }

  const updated =
    (await conversationRepository.updateReporterStoreNumber(conversation.id, storeNumber)) ??
    conversation;

  const ccRecipients = await resolveCcRecipientsForConversation(updated);
  const stored = updated.intelligenceSnapshot as IntelligenceSnapshot | null;

  if (stored && updated.intelligenceStatus === INTELLIGENCE_STATUS.READY) {
    const nextSnapshot: IntelligenceSnapshot = { ...stored, ccRecipients };
    const persisted =
      (await conversationRepository.updateIntelligence(updated.id, {
        status: INTELLIGENCE_STATUS.READY,
        snapshot: nextSnapshot,
        error: null
      })) ?? updated;

    logger.info('[canvas] Manual store number saved for CC recipients', {
      intercomId,
      conversationId: updated.id,
      storeNumber,
      ccStatus: ccRecipients.status
    });

    return buildCanvasFromStoredSnapshot(persisted, 'refreshed', { cacheOnly: true });
  }

  logger.info('[canvas] Manual store number saved (no ready snapshot yet)', {
    intercomId,
    conversationId: updated.id,
    storeNumber,
    ccStatus: ccRecipients.status
  });

  return canvasBuilder.buildPending(
    {
      reporterName: updated.reporterName,
      caseType: updated.caseType,
      subject: resolveConversationSubject(updated),
      rawPayload: updated.rawPayload
    },
    ccRecipients
  );
};

export const canvasService = {
  async initialize(payload: CanvasInitializePayload | string | number): Promise<CanvasResponse> {
    const initializeStartedAt = Date.now();
    const initializePayload =
      typeof payload === 'string' || typeof payload === 'number'
        ? { conversation_id: payload }
        : payload;
    const intercomId = normalizeIntercomConversationId(initializePayload.conversation_id);
    const liveSubject = initializePayload.intercomConversation
      ? resolveConversationSubjectFromIntercomPayload(initializePayload.intercomConversation)
      : undefined;

    logger.info('[canvas] Initialize requested', {
      intercomId,
      liveSubject: liveSubject ?? null,
      hasIntercomConversation: Boolean(initializePayload.intercomConversation)
    });

    try {
      // Fast path: one DB read + render from saved snapshot (no enrich / CC / message-count).
      const cached = await conversationRepository.findByIntercomId(intercomId);
      if (cached?.intelligenceSnapshot && !isIntelligenceStillRunning(cached)) {
        const { response, relatedCaseCount } = await buildCanvasFromConversation(cached, {
          useLiveSnapshot: false,
          cacheOnly: true,
          liveSubject
        });
        logger.info('[canvas] Returning cached intelligence snapshot', {
          intercomId,
          conversationId: cached.id,
          intelligenceStatus: cached.intelligenceStatus,
          relatedCaseCount,
          cacheOnly: true,
          banner: resolveCanvasSnapshotBanner(cached, { liveSubject }),
          durationMs: elapsedMs(initializeStartedAt),
          lastProcessingDurationMs:
            (cached.intelligenceSnapshot as IntelligenceSnapshot).processingDurationMs ?? null
        });
        return response;
      }

      if (cached?.intelligenceSnapshot && isIntelligenceStillRunning(cached)) {
        const previousProcessedAt = (cached.intelligenceSnapshot as IntelligenceSnapshot)
          .processedAt;
        const refreshed = await waitForSnapshotRefresh(
          intercomId,
          previousProcessedAt,
          remainingBudgetMs(initializeStartedAt, CANVAS_INITIALIZE_WAIT_MS)
        );
        const refreshedProcessedAt = (
          refreshed?.intelligenceSnapshot as IntelligenceSnapshot | null | undefined
        )?.processedAt;

        if (
          refreshed?.intelligenceSnapshot &&
          refreshedProcessedAt &&
          refreshedProcessedAt !== previousProcessedAt
        ) {
          const { response, relatedCaseCount } = await buildCanvasFromConversation(refreshed, {
            useLiveSnapshot: false,
            cacheOnly: true,
            liveSubject
          });
          logger.info('[canvas] Returning refreshed snapshot after pending initialize wait', {
            intercomId,
            conversationId: refreshed.id,
            relatedCaseCount,
            durationMs: elapsedMs(initializeStartedAt)
          });
          return response;
        }

        logger.info('[canvas] Re-analyze still in progress — returning updating UI', {
          intercomId,
          conversationId: cached.id,
          durationMs: elapsedMs(initializeStartedAt)
        });
        return buildCanvasFromStoredSnapshot(cached, 'refresh-pending', { cacheOnly: true });
      }

      let conversation = await loadConversationForCanvas(intercomId);

      if (!conversation) {
        conversation = await retryAsync(() => ensureConversationReadyForCanvas(intercomId), {
          onRetry: (error, attempt) => {
            logger.warn('[canvas] Retrying after transient error', {
              intercomId,
              attempt,
              error: error.message
            });
          }
        });
      }

      if (conversation?.intelligenceSnapshot) {
        const { response, relatedCaseCount } = await buildCanvasFromConversation(conversation, {
          useLiveSnapshot: false,
          cacheOnly: true,
          liveSubject
        });
        logger.info('[canvas] Returning cached intelligence snapshot', {
          intercomId,
          conversationId: conversation.id,
          intelligenceStatus: conversation.intelligenceStatus,
          relatedCaseCount,
          cacheOnly: true,
          banner: resolveCanvasSnapshotBanner(conversation, { liveSubject }),
          durationMs: elapsedMs(initializeStartedAt),
          lastProcessingDurationMs:
            (conversation.intelligenceSnapshot as IntelligenceSnapshot).processingDurationMs ?? null
        });
        return response;
      }

      const readyConversation = await waitForConversationIntelligence(
        intercomId,
        CANVAS_INITIALIZE_WAIT_MS
      );

      if (readyConversation?.intelligenceSnapshot) {
        const { response, relatedCaseCount } = await buildCanvasFromConversation(readyConversation, {
          useLiveSnapshot: false,
          cacheOnly: true,
          liveSubject
        });
        logger.info('[canvas] Returning snapshot after first-run wait', {
          intercomId,
          conversationId: readyConversation.id,
          waitMs: CANVAS_INITIALIZE_WAIT_MS,
          relatedCaseCount,
          cacheOnly: true,
          durationMs: elapsedMs(initializeStartedAt),
          lastProcessingDurationMs:
            (readyConversation.intelligenceSnapshot as IntelligenceSnapshot).processingDurationMs ??
            null
        });
        return response;
      }

      logger.info('[canvas] Returning pending canvas — first intelligence run in progress', {
        intercomId,
        conversationId: conversation.id,
        waitMs: CANVAS_INITIALIZE_WAIT_MS,
        durationMs: elapsedMs(initializeStartedAt)
      });

      const pendingConversation = readyConversation ?? conversation;
      return await buildPendingPreviewFromConversation(pendingConversation);
    } catch (error) {
      logger.error('[canvas] Failed to prepare conversation for sidebar', {
        intercomId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: elapsedMs(initializeStartedAt)
      });
      return canvasBuilder.buildFailed(toCanvasErrorMessage(error));
    }
  },

  async submit(payload: CanvasSubmitPayload): Promise<CanvasResponse> {
    const intercomId = normalizeIntercomConversationId(payload.conversation_id);
    const dismissedRelatedIntercomId = parseDismissRelatedCaseComponentId(payload.component_id);
    const dismissedCategoryIntercomId = parseDismissCategoryCaseComponentId(payload.component_id);

    logger.info('[canvas] Submit requested', {
      intercomId,
      componentId: payload.component_id ?? null,
      dismissedRelatedIntercomId,
      dismissedCategoryIntercomId
    });

    if (payload.component_id === REFRESH_INTELLIGENCE_COMPONENT_ID) {
      try {
        const response = await withTimeoutFallback(
          refreshIntelligenceForCanvas(intercomId),
          CANVAS_REFRESH_TOTAL_BUDGET_MS,
          null
        );

        if (response) {
          return response;
        }

        logger.warn('[canvas] Refresh exceeded total budget — returning last known results', {
          intercomId,
          budgetMs: CANVAS_REFRESH_TOTAL_BUDGET_MS
        });
        const latest = await loadConversationForCanvas(intercomId);
        if (latest) {
          return buildUpdatingIntelligenceResponse(latest, intercomId);
        }
        return canvasBuilder.buildUpdatingIntelligence(null);
      } catch (error) {
        logger.error('[canvas] Failed to refresh intelligence sidebar', {
          intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
        const latest = await loadConversationForCanvas(intercomId);
        if (latest?.intelligenceSnapshot) {
          return buildUpdatingIntelligenceResponse(latest, intercomId);
        }
        return canvasBuilder.buildUpdatingIntelligence(null);
      }
    }

    if (payload.component_id === REANALYZE_INTELLIGENCE_COMPONENT_ID) {
      try {
        const response = await withTimeoutFallback(
          reanalyzeIntelligenceForCanvas(intercomId),
          CANVAS_REFRESH_TOTAL_BUDGET_MS,
          null
        );

        if (response) {
          return response;
        }

        logger.warn('[canvas] Re-analyze exceeded total budget — returning still-updating UI', {
          intercomId,
          budgetMs: CANVAS_REFRESH_TOTAL_BUDGET_MS
        });

        const latest = await loadConversationForCanvas(intercomId);
        if (latest) {
          return buildUpdatingIntelligenceResponse(latest, intercomId);
        }
        return canvasBuilder.buildUpdatingIntelligence(null);
      } catch (error) {
        logger.error('[canvas] Failed to re-analyze intelligence sidebar', {
          intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
        const latest = await loadConversationForCanvas(intercomId);
        if (latest?.intelligenceSnapshot) {
          return buildUpdatingIntelligenceResponse(latest, intercomId);
        }
        return canvasBuilder.buildUpdatingIntelligence(null);
      }
    }

    if (payload.component_id === EDIT_MANUAL_STORE_NUMBER_COMPONENT_ID) {
      try {
        const conversation = await conversationRepository.findByIntercomId(intercomId);
        if (!conversation) {
          return canvasBuilder.buildNotSynced();
        }

        logger.info('[canvas] Edit store number requested', {
          intercomId,
          conversationId: conversation.id
        });

        return await buildCanvasWithStoreEditor(conversation);
      } catch (error) {
        logger.error('[canvas] Failed to open store number editor', {
          intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
        return canvasBuilder.buildFailed(toCanvasErrorMessage(error));
      }
    }

    if (payload.component_id === SUBMIT_MANUAL_STORE_NUMBER_COMPONENT_ID) {
      try {
        return await applyManualStoreNumberForCanvas(intercomId, payload.input_values);
      } catch (error) {
        logger.error('[canvas] Failed to apply manual store number', {
          intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
        return canvasBuilder.buildFailed(toCanvasErrorMessage(error));
      }
    }

    const dismissedIntercomId = dismissedRelatedIntercomId ?? dismissedCategoryIntercomId;
    if (dismissedIntercomId) {
      try {
        const response = await withTimeoutFallback(
          buildCanvasAfterDismissCase(
            intercomId,
            dismissedRelatedIntercomId,
            dismissedCategoryIntercomId
          ),
          CANVAS_DISMISS_TOTAL_BUDGET_MS,
          null
        );

        if (response) {
          return response;
        }

        logger.warn('[canvas] Dismiss exceeded total budget — returning saved snapshot', {
          intercomId,
          dismissedIntercomId,
          budgetMs: CANVAS_DISMISS_TOTAL_BUDGET_MS
        });

        const latest = await conversationRepository.findByIntercomId(intercomId);
        if (latest?.intelligenceSnapshot) {
          return buildCanvasFromStoredSnapshot(latest, 'current', { cacheOnly: true });
        }

        return canvasBuilder.buildUpdatingIntelligence(null);
      } catch (error) {
        logger.error('[canvas] Failed to dismiss case from sidebar', {
          intercomId,
          dismissedIntercomId,
          dismissedCategoryIntercomId: Boolean(dismissedCategoryIntercomId),
          error: error instanceof Error ? error.message : String(error)
        });
        return canvasBuilder.buildFailed(toCanvasErrorMessage(error));
      }
    }

    return this.initialize({ conversation_id: intercomId });
  },

  configure(): CanvasResponse {
    logger.info('[canvas] Configure requested');
    return canvasBuilder.buildConfigure();
  }
};
