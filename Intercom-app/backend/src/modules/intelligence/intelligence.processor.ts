import type { EmployeeMatchMethod } from '../../constants/intelligence.constants.js';
import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { env } from '../../config/env.config.js';
import { conversationEmployeesRepository } from '../conversation/conversation-employees.repository.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { conversationService } from '../conversation/conversation.service.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import { resolveCaseType } from '../conversation/case-type.util.js';
import { employeeNameExtractionService } from '../employee/employee.name-extraction.service.js';
import { filterEmployeeNamesToSubject } from '../employee/employee.subject-name.util.js';
import { employeeMatchingService } from '../employee/employee.matching.service.js';
import {
  resolveEmployeeManualReview,
  resolveEmployeeMentionStatus
} from '../employee/employee.mention-status.util.js';
import type { EmployeeSearchPath } from '../../constants/employee-search.constants.js';
import { EMPLOYEE_SEARCH_PATH } from '../../constants/employee-search.constants.js';
import { filterEmployeeSearchNoticesForDisplay } from '../../constants/employee-search.constants.js';
import { getNameMatchVariants } from '../employee/employee.name.util.js';
import type {
  IntelligenceEmployeeMatch,
  IntelligencePossibleSamePerson,
  IntelligenceSnapshot
} from '../../types/intelligence.types.js';
import {
  MAX_INTELLIGENCE_ATTEMPTS,
  shouldSkipIntelligenceProcessing
} from './intelligence-attempt.util.js';
import { shouldReprocessIntelligence, hasSubjectChangedSinceLastProcessing } from './intelligence-stale.util.js';
import { intelligenceService } from './intelligence.service.js';
import { resolveRelatedCaseSearchInput } from './related-case-search.util.js';
import { relatedRetrievalService } from './related.retrieval.service.js';
import { enqueueRelatedCasePeerRefresh } from './intelligence-sibling-reprocess.service.js';
import { enqueuePeerSnapshotRefreshJob } from '../../queues/intercom-intelligence.queue.js';
import { elapsedMs } from '../../utils/timing.util.js';
import { filterStoredMessagesForAnalysis } from './customer-conversation-content.util.js';
import { retainExtractedNameAfterResolution } from '../employee/employee.mention-validation.util.js';
import { maybeSyncIntercomAfterIntelligence } from '../intercom/intercom.sync.service.js';
import {
  buildIntelligenceVersion,
  isStaleIntelligencePersist
} from './intelligence-revision.util.js';

export type ProcessIntelligenceInput = {
  conversationId: number;
  intercomId: string;
  source?: 'worker' | 'canvas';
  skipSync?: boolean;
  forceReprocess?: boolean;
  /** @deprecated Store/domain search removed — ignored. */
  forceDomainEmployeeSearch?: boolean;
  /** @deprecated Store/domain search removed — ignored. */
  forceStoreEmployeeSearch?: boolean;
  /** Skip peer snapshot refresh and sibling reprocess (canvas button actions). */
  skipPeerRefresh?: boolean;
};

/** Cascade peer/sibling refresh only on normal runs (never from forceReprocess jobs). */
export const shouldRefreshSiblingConversations = (input: ProcessIntelligenceInput): boolean =>
  input.forceReprocess !== true;

const buildEmployeeMatchesFromLinks = (
  linkedEmployees: Array<{
    extractedName: string;
    match: IntelligenceEmployeeMatch;
  }>
): IntelligenceEmployeeMatch[] => {
  const byIdentity = new Map<number, IntelligenceEmployeeMatch>();

  for (const { extractedName, match } of linkedEmployees) {
    const existing = byIdentity.get(match.employeeIdentityId);
    const isDifferentSpelling =
      extractedName.trim().toLowerCase() !== match.canonicalName.trim().toLowerCase();
    const mentionVariant = isDifferentSpelling
      ? {
          variantName: extractedName,
          confidenceScore: match.confidenceScore,
          matchMethod: match.matchMethod
        }
      : null;

    if (!existing) {
      byIdentity.set(match.employeeIdentityId, {
        ...match,
        extractedName: isDifferentSpelling ? extractedName : match.extractedName,
        nameVariants: mentionVariant ? [mentionVariant] : match.nameVariants
      });
      continue;
    }

    const variants = [...(existing.nameVariants ?? [])];
    if (
      mentionVariant &&
      !variants.some(
        (variant) =>
          variant.variantName.trim().toLowerCase() === extractedName.trim().toLowerCase()
      )
    ) {
      variants.push(mentionVariant);
    }

    byIdentity.set(match.employeeIdentityId, {
      ...existing,
      confidenceScore: Math.max(existing.confidenceScore, match.confidenceScore),
      matchMethod:
        match.confidenceScore > existing.confidenceScore ? match.matchMethod : existing.matchMethod,
      extractedName: existing.extractedName ?? (isDifferentSpelling ? extractedName : undefined),
      nameVariants: variants.length > 0 ? variants : existing.nameVariants
    });
  }

  return [...byIdentity.values()].sort((left, right) => right.confidenceScore - left.confidenceScore);
};

const buildSearchTerms = (
  extractedNames: string[],
  employeeMatches: IntelligenceEmployeeMatch[]
): string[] => {
  const terms = new Set<string>();

  for (const name of extractedNames) {
    for (const variant of getNameMatchVariants(name)) {
      terms.add(variant);
    }
  }

  for (const match of employeeMatches) {
    for (const variant of getNameMatchVariants(match.canonicalName)) {
      terms.add(variant);
    }
  }

  return [...terms];
};

export const processIntelligenceForConversation = async (
  input: ProcessIntelligenceInput
): Promise<void> => {
  const logTag = input.source === 'canvas' ? '[canvas-intelligence]' : '[worker]';
  const runStartedAt = Date.now();
  const timings: NonNullable<IntelligenceSnapshot['processingTimingsMs']> = {
    totalMs: 0
  };

  const existingBeforeSync = await conversationRepository.findById(input.conversationId);
  const shouldSyncIntercom =
    !input.skipSync &&
    env.INTERCOM_ENABLED &&
    (existingBeforeSync?.source ?? 'intercom') === 'intercom';

  if (shouldSyncIntercom) {
    const syncStartedAt = Date.now();
    try {
      await conversationService.refreshFromIntercomApi(input.intercomId, {
        preserveIntelligenceStatus: true
      });
    } catch (error) {
      logger.warn(`${logTag} Intercom refresh failed — continuing with persisted local case`, {
        conversationId: input.conversationId,
        intercomId: input.intercomId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
    timings.syncMs = elapsedMs(syncStartedAt);
  }

  const conversation = await conversationRepository.findById(input.conversationId);

  if (!conversation) {
    throw new Error(`Conversation not found for intelligence processing: ${input.conversationId}`);
  }

  const messages = await conversationRepository.findMessagesByConversationId(conversation.id);
  const messageCount = messages.length;

  if (!input.forceReprocess && shouldSkipIntelligenceProcessing(conversation, messageCount)) {
    logger.warn(`${logTag} Skipping intelligence processing — attempt limit reached or already failed`, {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      messageCount,
      failureAttempts:
        (conversation.intelligenceSnapshot as IntelligenceSnapshot | null)?.failureAttempts ?? 0,
      maxAttempts: MAX_INTELLIGENCE_ATTEMPTS
    });
    return;
  }

  if (!input.forceReprocess && !shouldReprocessIntelligence(conversation, messageCount)) {
    logger.info(`${logTag} Skipping intelligence processing — snapshot is already up to date`, {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      messageCount,
      intelligenceStatus: conversation.intelligenceStatus
    });
    return;
  }

  try {
    const messageBodies = filterStoredMessagesForAnalysis(messages)
      .map((message) => message.messageBody)
      .filter((body): body is string => Boolean(body));

    logger.info(`${logTag} Extracting employee names from conversation messages`, {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      messageCount,
      reporterName: conversation.reporterName
    });

    const resolvedSubject = resolveConversationSubject(conversation);

    const geminiStartedAt = Date.now();
    const extraction = await employeeNameExtractionService.extract({
      messageBodies,
      subject: resolvedSubject,
      reporterName: conversation.reporterName,
      reporterEmail: conversation.reporterEmail,
      processingMode: conversation.processingMode === 'fixture' ? 'fixture' : 'live'
    });
    timings.geminiMs = elapsedMs(geminiStartedAt);
    logger.info(`${logTag} Timing — Gemini name extraction`, {
      conversationId: conversation.id,
      durationMs: timings.geminiMs
    });

    let extractedNames = filterEmployeeNamesToSubject(extraction.names, resolvedSubject);
    if (extractedNames.length !== extraction.names.length) {
      logger.warn(`${logTag} Dropped extracted names that are not in the subject`, {
        conversationId: conversation.id,
        subject: resolvedSubject,
        geminiNames: extraction.names,
        keptNames: extractedNames
      });
    }

    const existingSnapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null;
    const confirmedFields = input.forceReprocess
      ? []
      : existingSnapshot?.operatorConfirmedFields ?? [];

    const similarSubjectCaseType = await conversationRepository.findSimilarSubjectCaseType(
      resolvedSubject,
      conversation.id
    );

    const caseType =
      confirmedFields.includes('caseType') && conversation.caseType
        ? conversation.caseType
        : resolveCaseType({
            subject: resolvedSubject,
            rawPayload: conversation.rawPayload ?? null,
            geminiCaseType: extraction.caseType,
            storedCaseType: conversation.caseType,
            similarSubjectCaseType
          });

    await conversationRepository.updateCaseType(conversation.id, caseType);

    logger.info(`${logTag} Resolved conversation case type`, {
      conversationId: conversation.id,
      caseType,
      geminiCaseType: extraction.caseType,
      similarSubjectCaseType,
      extractionSource: extraction.source
    });

    const linkedEmployees: Array<{
      extractedName: string;
      match: IntelligenceEmployeeMatch;
    }> = [];
    const employeeSearchNotices: string[] = [];
    let employeeSearchPath: EmployeeSearchPath | undefined;
    const possibleSamePerson: IntelligencePossibleSamePerson[] = [];
    let hadAmbiguousResolution = false;
    let hadUnresolvedResolution = false;

    const subjectChangedSinceProcessing = hasSubjectChangedSinceLastProcessing(
      existingSnapshot,
      resolvedSubject
    );
    const preferredEmployeeIdentityIds = subjectChangedSinceProcessing
      ? undefined
      : existingSnapshot?.employeeMatches?.map((match) => match.employeeIdentityId);

    const matchStartedAt = Date.now();
    if (
      confirmedFields.includes('employee') &&
      (existingSnapshot?.employeeMatches?.length ?? 0) > 0
    ) {
      employeeSearchPath = existingSnapshot?.employeeSearchPath;
      for (const match of existingSnapshot?.employeeMatches ?? []) {
        linkedEmployees.push({
          extractedName: match.extractedName ?? match.canonicalName,
          match
        });
      }
    } else {
    const retainedNames: string[] = [];
    for (const extractedName of extractedNames) {
      const resolution = await employeeMatchingService.resolveByName({
        extractedName,
        caseReporterName: conversation.reporterName,
        caseReporterEmail: conversation.reporterEmail,
        conversationId: conversation.id,
        preferredEmployeeIdentityIds
      });

      if (!retainExtractedNameAfterResolution(extractedName, resolution.mentionStatus)) {
        continue;
      }

      retainedNames.push(extractedName);

      for (const notice of resolution.notices) {
        if (!employeeSearchNotices.includes(notice)) {
          employeeSearchNotices.push(notice);
        }
      }

      for (const hint of resolution.possibleSamePerson ?? []) {
        if (
          !possibleSamePerson.some(
            (existing) => existing.employeeIdentityId === hint.employeeIdentityId
          )
        ) {
          possibleSamePerson.push(hint);
        }
      }

      if (!employeeSearchPath) {
        employeeSearchPath = resolution.searchPath;
      }

      if (resolution.mentionStatus === 'ambiguous') {
        hadAmbiguousResolution = true;
      }
      if (resolution.mentionStatus === 'unresolved') {
        hadUnresolvedResolution = true;
      }

      for (const match of resolution.matches) {
        linkedEmployees.push({
          extractedName:
            resolution.searchPath === EMPLOYEE_SEARCH_PATH.CREATED
              ? match.canonicalName
              : extractedName,
          match
        });
      }
    }
    extractedNames = retainedNames;
    }
    timings.employeeMatchMs = elapsedMs(matchStartedAt);
    logger.info(`${logTag} Timing — employee matching`, {
      conversationId: conversation.id,
      durationMs: timings.employeeMatchMs,
      extractedNameCount: extractedNames.length
    });

    // Related cases: same employee + same category across all stores/domains (no scope filter).
    const relatedCaseSearchScope = null;

    const employeeMatches = buildEmployeeMatchesFromLinks(linkedEmployees);
    const bestMatch = employeeMatches[0] ?? null;
    const employeeMentionStatus = confirmedFields.includes('employee')
      ? existingSnapshot?.employeeMentionStatus ??
        (employeeMatches.length > 0 ? 'resolved' : 'no_employee_mentioned')
      : resolveEmployeeMentionStatus({
          extractedNameCount: extractedNames.length,
          resolvedMatchCount: employeeMatches.length,
          hadAmbiguousResolution,
          hadUnresolvedResolution
        });
    const unresolvedEmployeeMention =
      employeeMentionStatus === 'unresolved' || employeeMentionStatus === 'ambiguous'
        ? extractedNames[0] ?? existingSnapshot?.unresolvedEmployeeMention ?? null
        : null;

    if (!confirmedFields.includes('employee')) {
    if (bestMatch) {
      await conversationRepository.updateEmployeeIdentity(
        conversation.id,
        bestMatch.employeeIdentityId
      );
      logger.info(`${logTag} Linked conversation to employee identity`, {
        conversationId: conversation.id,
        employeeIdentityId: bestMatch.employeeIdentityId,
        canonicalName: bestMatch.canonicalName,
        confidenceScore: bestMatch.confidenceScore,
        matchMethod: bestMatch.matchMethod
      });
    } else {
      await conversationRepository.updateEmployeeIdentity(conversation.id, null);
      logger.warn(`${logTag} No employee names extracted or matched`, {
        conversationId: conversation.id,
        extractedNames: extractedNames,
        extractionSource: extraction.source
      });
    }
    }

    const seenIdentityIds = new Set<number>();
    const conversationEmployeeRows = linkedEmployees
      .filter((row) => {
        if (row.match.employeeIdentityId <= 0) {
          return false;
        }
        if (seenIdentityIds.has(row.match.employeeIdentityId)) {
          return false;
        }
        seenIdentityIds.add(row.match.employeeIdentityId);
        return true;
      })
      .map((row) => ({
        employeeIdentityId: row.match.employeeIdentityId,
        extractedName: row.extractedName,
        confidenceScore: row.match.confidenceScore,
        matchMethod: row.match.matchMethod as EmployeeMatchMethod
      }));

    await conversationEmployeesRepository.replaceForConversation(
      conversation.id,
      conversationEmployeeRows
    );

    const searchTerms = buildSearchTerms(extractedNames, employeeMatches);

    logger.info(`${logTag} Running related-case text search + snapshot`, {
      conversationId: conversation.id,
      searchTermCount: searchTerms.length,
      employeeMatchCount: employeeMatches.length
    });

    const displayEmployeeSearchNotices = filterEmployeeSearchNoticesForDisplay(
      employeeSearchNotices,
      {
        employeeMatchCount: employeeMatches.length
      }
    );

    const relatedStartedAt = Date.now();
    const { searchTerms: relatedSearchTerms, employeeNames, employeeIdentityIds, nameBag } =
      await resolveRelatedCaseSearchInput({
        employeeMatches,
        extractedNames: extractedNames,
        searchTerms
      });
    const relatedCasesForHints = await relatedRetrievalService.findRelatedCasesByMentionedNames({
            employeeIdentityIds,
            searchTerms: relatedSearchTerms,
            employeeNames,
            nameBag,
            excludeConversationId: conversation.id,
            scope: relatedCaseSearchScope,
            refreshFromIntercom: false
          });
    // TEMP (Amber test): keep all same-employee related cases — do not require same category.
    // const normalizedCaseType = caseType.trim().toLowerCase();
    // const relatedCasesFiltered = relatedCasesForHints.filter(
    //   (relatedCase) => relatedCase.caseType.trim().toLowerCase() === normalizedCaseType
    // );
    const relatedCasesFiltered = relatedCasesForHints;

    const possibleSamePersonForSnapshot =
      await intelligenceService.resolvePossibleSamePersonForDisplay(conversation, {
        mentionedInReport: extractedNames,
        employeeMatches,
        possibleSamePerson,
        relatedCases: relatedCasesFiltered
      });
    timings.relatedCasesMs = elapsedMs(relatedStartedAt);
    logger.info(`${logTag} Timing — related cases + same-person hints`, {
      conversationId: conversation.id,
      durationMs: timings.relatedCasesMs,
      relatedCaseHintCount: relatedCasesFiltered.length
    });

    logger.info(`${logTag} Resolved possible same person hints`, {
      conversationId: conversation.id,
      possibleSamePersonCount: possibleSamePersonForSnapshot.length,
      relatedCaseHintCount: relatedCasesFiltered.length
    });

    const storeStartedAt = Date.now();
    const latestForPersist = await conversationRepository.findById(conversation.id);
    const latestMessageCount = await conversationRepository.countMessagesByConversationId(
      conversation.id
    );
    if (
      isStaleIntelligencePersist({
        runMessageCount: messageCount,
        currentMessageCount: latestMessageCount,
        runSourceUpdatedAt: conversation.intercomSourceUpdatedAt,
        currentSourceUpdatedAt: latestForPersist?.intercomSourceUpdatedAt
      })
    ) {
      logger.warn(`${logTag} Skipping stale intelligence persist — a newer Intercom revision exists`, {
        conversationId: conversation.id,
        runMessageCount: messageCount,
        currentMessageCount: latestMessageCount
      });
      await conversationRepository.markIntelligencePending(conversation.id);
      return;
    }

    const intelligenceVersion = buildIntelligenceVersion({
      conversationId: conversation.id,
      messageCount,
      sourceUpdatedAt: latestForPersist?.intercomSourceUpdatedAt ?? conversation.intercomSourceUpdatedAt
    });

    const snapshot = await intelligenceService.storeReadySnapshot({
      conversationId: conversation.id,
      employeeMatches,
      searchTerms,
      extractedNames: extractedNames,
      caseTypeFilter: caseType,
      messageCount,
      extractionSource: extraction.source,
      employeeSearchPath,
      employeeSearchNotices: displayEmployeeSearchNotices,
      relatedCaseSearchScope,
      awaitingCompanyDomainSearch: false,
      companyDomainSearchAttempted: false,
      possibleSamePerson: possibleSamePersonForSnapshot,
      domainEmployeeMatches: undefined,
      processedSubject: resolveConversationSubject(conversation),
      employeeMentionStatus,
      unresolvedEmployeeMention,
      relatedCaseSearchTerms: extraction.relatedCaseSearchTerms ?? []
    });
    snapshot.intelligenceVersion = intelligenceVersion;
    snapshot.sourceRevision = (
      latestForPersist?.intercomSourceUpdatedAt ?? conversation.intercomSourceUpdatedAt
    )?.toISOString() ?? null;
    if (confirmedFields.includes('stakeholders') && existingSnapshot?.ccRecipients) {
      snapshot.ccRecipients = existingSnapshot.ccRecipients;
    }
    if (confirmedFields.includes('caseType') && conversation.caseType) {
      snapshot.caseType = conversation.caseType;
    }
    if (confirmedFields.includes('employee') && existingSnapshot?.employeeMatches?.length) {
      snapshot.employeeMatches = existingSnapshot.employeeMatches;
    }
    timings.storeSnapshotMs = elapsedMs(storeStartedAt);

    const previousEmployeeIdentityIds =
      existingSnapshot?.employeeMatches?.map((match) => match.employeeIdentityId) ?? [];
    const newEmployeeIdentityIds = employeeMatches.map((match) => match.employeeIdentityId);
    const employeeMatchChanged =
      previousEmployeeIdentityIds.length !== newEmployeeIdentityIds.length ||
      previousEmployeeIdentityIds.some((id) => !newEmployeeIdentityIds.includes(id));

    const skipPeerRefresh = input.skipPeerRefresh === true || input.source === 'canvas';
    // forceReprocess jobs must not enqueue more forceReprocess jobs (queue flood).
    const allowPeerCascade =
      !skipPeerRefresh && shouldRefreshSiblingConversations(input);
    const createdNewEmployee = employeeSearchPath === EMPLOYEE_SEARCH_PATH.CREATED;
    const shouldUpdatePeers =
      allowPeerCascade &&
      employeeMatches.length > 0 &&
      (subjectChangedSinceProcessing || employeeMatchChanged || createdNewEmployee);

    const peerStartedAt = Date.now();
    let peerRefreshDeferred = false;
    if (shouldUpdatePeers) {
      // Defer heavy peer rebuild so this conversation's job finishes in ~Gemini+match+related time.
      // Same logic as before — just runs on a follow-up `peer-refresh-*` queue job.
      await enqueuePeerSnapshotRefreshJob({
        sourceConversationId: conversation.id,
        sourceIntercomId: conversation.intercomId,
        caseType,
        employeeIdentityIds: newEmployeeIdentityIds,
        relatedCaseSearchScope,
        enqueueSiblingReprocess: true
      });
      peerRefreshDeferred = true;
    } else if (
      allowPeerCascade &&
      (subjectChangedSinceProcessing || employeeMatchChanged)
    ) {
      // No same-employee peer refresh above — update conversations that already list this ticket.
      await enqueueRelatedCasePeerRefresh({
        sourceConversationId: conversation.id,
        sourceIntercomId: conversation.intercomId
      });
    }
    timings.peerRefreshMs = elapsedMs(peerStartedAt);
    timings.totalMs = elapsedMs(runStartedAt);

    // Persist timings onto the ready snapshot for DB/Intercom evidence.
    await conversationRepository.updateIntelligence(conversation.id, {
      status: INTELLIGENCE_STATUS.READY,
      snapshot: {
        ...snapshot,
        processingDurationMs: timings.totalMs,
        processingTimingsMs: timings,
        processingMode: conversation.processingMode === 'fixture' ? 'fixture' : 'live',
        promptVersion: env.AI_PROMPT_VERSION,
        modelVersion: conversation.processingMode === 'fixture' ? 'fixture-v1' : env.GEMINI_MODEL,
        extractionConfidence: extraction.source === 'gemini' ? 85 : 55,
        employeeMatchConfidence:
          employeeMentionStatus === 'resolved' ? employeeMatches[0]?.confidenceScore ?? 0 : 0,
        requiresManualReview: resolveEmployeeManualReview({
          mentionStatus: employeeMentionStatus,
          employeeMatchCount: employeeMatches.length,
          topConfidence: employeeMatches[0]?.confidenceScore ?? 0,
          manualReviewConfidence: env.MANUAL_REVIEW_CONFIDENCE,
          operatorConfirmed: confirmedFields.includes('manualReview'),
          existingRequiresManualReview: Boolean(existingSnapshot?.requiresManualReview)
        }),
        operatorConfirmedFields: confirmedFields,
        intelligenceVersion,
        sourceRevision: snapshot.sourceRevision ?? null,
        employeeMentionStatus,
        unresolvedEmployeeMention,
        relatedCaseSearchTerms: extraction.relatedCaseSearchTerms ?? []
      },
      error: null
    });

    logger.info(`${logTag} Intelligence processing complete`, {
      conversationId: conversation.id,
      employeeMatchCount: snapshot.employeeMatches.length,
      relatedCaseCount: snapshot.relatedCases.length,
      extractedNames: extractedNames,
      processedAt: snapshot.processedAt,
      durationMs: timings.totalMs,
      timingsMs: timings,
      peerRefreshDeferred
    });

    try {
      await maybeSyncIntercomAfterIntelligence(conversation);
    } catch (error) {
      logger.warn(`${logTag} Intercom write-back failed after intelligence completed`, {
        conversationId: conversation.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await intelligenceService.markFailed(conversation.id, message, {
      messageCount,
      previousSnapshot: conversation.intelligenceSnapshot as IntelligenceSnapshot | null
    });
  }
};
