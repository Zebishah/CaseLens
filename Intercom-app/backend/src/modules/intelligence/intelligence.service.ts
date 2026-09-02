import { INTELLIGENCE_STATUS } from '../../constants/intelligence.constants.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { logger } from '../../config/logger.config.js';
import type {
  IntelligenceEmployeeMatch,
  IntelligenceFuzzyRelatedCase,
  IntelligencePossibleSamePerson,
  IntelligenceRelatedCase,
  IntelligenceSnapshot
} from '../../types/intelligence.types.js';
import type { EmployeeSearchPath } from '../../constants/employee-search.constants.js';
import { filterEmployeeSearchNoticesForDisplay } from '../../constants/employee-search.constants.js';
import {
  // caseTypesMatchForRelated, // TEMP: unused while related cases ignore category
  resolveCaseType
} from '../conversation/case-type.util.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import {
  conversationRepository,
  type ConversationRecord
} from '../conversation/conversation.repository.js';
import { conversationEmployeesRepository } from '../conversation/conversation-employees.repository.js';
import { employeeNameVariantService } from '../employee/employee.name-variant.service.js';
import { scoreExtractedNameMatch } from '../employee/employee.token-match.util.js';
import { normalizeForMatch } from '../employee/employee.name.util.js';
import { enrichPossibleSamePersonHints } from '../employee/employee.possible-match-enrichment.util.js';
import { possibleMatchService } from '../employee/employee.possible-match.service.js';
import { resolveReporterContext } from '../employee/employee.reporter-context.util.js';
import { MAX_INTELLIGENCE_ATTEMPTS } from './intelligence-attempt.util.js';
import {
  filterDismissedCategoryCases,
  filterDismissedRelatedCases
} from '../canvas/related-case-dismiss.util.js';
import { resolveRelatedCaseSearchInput } from './related-case-search.util.js';
import { rankRelatedCases } from './related-case-rank.util.js';
import { formatRelatedCasePreviewText } from './related-case-preview.util.js';
import { relatedCaseSummaryService } from './related-case-summary.service.js';
import { relatedRetrievalService } from './related.retrieval.service.js';
import type { RelatedCaseNameBag } from './related-case-name-match.util.js';
import {
  scopeIncludesCompanyDomain,
  type RelatedCaseSearchScope
} from '../conversation/related-case-scope.util.js';
import {
  ccRecipientsService,
  type CcRecipientsResult
} from '../store-directory/cc-recipients.service.js';

/** Keep previously generated AI summaries when related list is rebuilt. */
const mergePriorRelatedCaseSummaries = (
  relatedCases: IntelligenceRelatedCase[],
  priorRelatedCases?: IntelligenceRelatedCase[]
): IntelligenceRelatedCase[] => {
  if (!priorRelatedCases?.length) {
    return relatedCases;
  }

  const summaryByIntercomId = new Map(
    priorRelatedCases
      .filter((relatedCase) => relatedCase.summaryText?.trim())
      .map((relatedCase) => [relatedCase.intercomId, relatedCase.summaryText!] as const)
  );

  if (summaryByIntercomId.size === 0) {
    return relatedCases;
  }

  return relatedCases.map((relatedCase) => {
    if (relatedCase.summaryText?.trim()) {
      return relatedCase;
    }

    const priorSummary = summaryByIntercomId.get(relatedCase.intercomId);
    return priorSummary ? { ...relatedCase, summaryText: priorSummary } : relatedCase;
  });
};

const collectContactEmailsFromPayload = (
  rawPayload: Record<string, unknown> | null | undefined
): string[] => {
  const contactsWrapper = rawPayload?.contacts;
  if (!contactsWrapper || typeof contactsWrapper !== 'object') {
    return [];
  }

  const contacts = (contactsWrapper as Record<string, unknown>).contacts;
  if (!Array.isArray(contacts)) {
    return [];
  }

  const emails: string[] = [];
  for (const contact of contacts) {
    if (!contact || typeof contact !== 'object') {
      continue;
    }
    const email = (contact as Record<string, unknown>).email;
    if (typeof email === 'string' && email.trim()) {
      emails.push(email.trim());
    }
  }

  return emails;
};

const resolveCcRecipientsForSnapshot = async (
  conversation: ConversationRecord | undefined | null
): Promise<CcRecipientsResult | undefined> => {
  if (!conversation) {
    return undefined;
  }

  const reporterContext = resolveReporterContext(
    conversation.reporterName,
    conversation.reporterEmail,
    collectContactEmailsFromPayload(conversation.rawPayload)
  );
  const storeNumber = conversation.reporterStoreNumber ?? reporterContext.storeNumber;

  return ccRecipientsService.resolveForStoreNumber(storeNumber, conversation.reporterEmail);
};

const filterRelatedCasesByCaseType = (
  relatedCases: IntelligenceRelatedCase[],
  caseTypeFilter?: string | null
): IntelligenceRelatedCase[] => {
  // TEMP (Amber test): related cases = same employee only — no category filter.
  // Restore the block below when categorization comes back.
  void caseTypeFilter;
  return relatedCases;

  // if (!caseTypeFilter?.trim()) {
  //   return relatedCases;
  // }
  //
  // return relatedCases.filter((relatedCase) =>
  //   caseTypesMatchForRelated(relatedCase.caseType, caseTypeFilter)
  // );
};

const resolveConversationCaseType = (conversation: ConversationRecord): string =>
  resolveCaseType({
    subject: resolveConversationSubject(conversation),
    rawPayload: conversation.rawPayload ?? null,
    storedCaseType: conversation.caseType
  });

const fetchCategoryCases = async (input: {
  conversationId: number;
  caseTypeFilter?: string | null;
  limit?: number;
  scope?: RelatedCaseSearchScope | null;
  refreshFromIntercom?: boolean;
}): Promise<IntelligenceRelatedCase[]> => {
  if (!input.caseTypeFilter?.trim()) {
    return [];
  }

  return relatedRetrievalService.findCasesByCaseType({
    caseType: input.caseTypeFilter,
    excludeConversationId: input.conversationId,
    limit: input.limit,
    scope: input.scope,
    refreshFromIntercom: input.refreshFromIntercom
  });
};

const resolveStoredRelatedCaseScope = (
  _conversation: ConversationRecord
): RelatedCaseSearchScope | null => {
  // Store/domain related-case scoping removed — always search globally (category still applied).
  return null;
};

const dedupePossibleSamePerson = (
  matches: IntelligencePossibleSamePerson[]
): IntelligencePossibleSamePerson[] =>
  matches.filter(
    (match, index, array) =>
      array.findIndex((item) => item.employeeIdentityId === match.employeeIdentityId) === index
  );

/**
 * A possible-match hint must represent a genuinely different employee.
 * Exact aliases and strong full-name spelling variants already represented by the resolved
 * identity are suppressed, while one-word and shared-first-name hints remain reviewable.
 */
const RESOLVED_FULL_NAME_EQUIVALENCE_MIN_CONFIDENCE = 90;

const collectResolvedEmployeeNames = (match: IntelligenceEmployeeMatch): string[] =>
  [
    match.canonicalName,
    match.extractedName,
    ...(match.nameVariants ?? []).map((variant) => variant.variantName)
  ].filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0
  );

const hasMultipleNameTokens = (name: string): boolean =>
  normalizeForMatch(name).split(/\s+/).filter(Boolean).length >= 2;

const namesRepresentSameResolvedEmployee = (
  resolvedName: string,
  possibleName: string
): boolean => {
  const normalizedResolved = normalizeForMatch(resolvedName);
  const normalizedPossible = normalizeForMatch(possibleName);

  if (!normalizedResolved || !normalizedPossible) {
    return false;
  }

  if (normalizedResolved === normalizedPossible) {
    return true;
  }

  // Do not hide a different employee merely because a single first or last name overlaps.
  if (!hasMultipleNameTokens(resolvedName) || !hasMultipleNameTokens(possibleName)) {
    return false;
  }

  const score =
    scoreExtractedNameMatch(resolvedName, possibleName)?.confidenceScore ??
    scoreExtractedNameMatch(possibleName, resolvedName)?.confidenceScore ??
    0;

  return score >= RESOLVED_FULL_NAME_EQUIVALENCE_MIN_CONFIDENCE;
};

const dropAutoLinkedPossibleSamePersonHints = (
  hints: IntelligencePossibleSamePerson[],
  matches: IntelligenceEmployeeMatch[]
): IntelligencePossibleSamePerson[] =>
  hints.filter((hint) => {
    if (matches.some((match) => match.employeeIdentityId === hint.employeeIdentityId)) {
      return false;
    }

    return !matches.some((match) =>
      collectResolvedEmployeeNames(match).some((name) =>
        namesRepresentSameResolvedEmployee(name, hint.canonicalName)
      )
    );
  });

const resolvePossibleSamePersonForDisplay = async (
  conversation: ConversationRecord,
  snapshot: Pick<
    IntelligenceSnapshot,
    'mentionedInReport' | 'employeeMatches' | 'possibleSamePerson' | 'relatedCases'
  >
): Promise<IntelligencePossibleSamePerson[]> => {
  const conversationEmployees = await conversationEmployeesRepository.findByConversationId(
    conversation.id
  );

  if (conversationEmployees.length > 0) {
    const possibleSamePersonMatches = await Promise.all(
      conversationEmployees.map((row) =>
        possibleMatchService.findPossibleSamePerson({
          contactName: row.extractedName,
          contactEmail: null,
          excludeEmployeeIdentityId: row.employeeIdentityId
        })
      )
    );

    const linkedHints = dropAutoLinkedPossibleSamePersonHints(
      dedupePossibleSamePerson(possibleSamePersonMatches.flat()),
      snapshot.employeeMatches
    );

    return dropAutoLinkedPossibleSamePersonHints(
      await enrichPossibleSamePersonHints({
        conversation,
        mentionedInReport: snapshot.mentionedInReport ?? [],
        employeeMatches: snapshot.employeeMatches,
        existingHints: linkedHints,
        relatedCases: snapshot.relatedCases ?? []
      }),
      snapshot.employeeMatches
    );
  }

  return dropAutoLinkedPossibleSamePersonHints(
    await enrichPossibleSamePersonHints({
      conversation,
      mentionedInReport: snapshot.mentionedInReport ?? [],
      employeeMatches: snapshot.employeeMatches,
      existingHints: snapshot.possibleSamePerson ?? [],
      relatedCases: snapshot.relatedCases ?? []
    }),
    snapshot.employeeMatches
  );
};

const refreshRelatedCasePreviews = async <T extends IntelligenceRelatedCase>(
  cases: T[] | undefined
): Promise<T[] | undefined> => {
  if (!cases?.length) {
    return cases;
  }

  const bodies = await conversationRepository.findFirstMessageBodiesByConversationIds(
    cases.map((relatedCase) => relatedCase.conversationId)
  );

  return cases.map((relatedCase) => {
    const refreshed = formatRelatedCasePreviewText(bodies.get(relatedCase.conversationId) ?? null);
    if (!refreshed && !relatedCase.previewText) {
      return relatedCase;
    }

    return {
      ...relatedCase,
      previewText: refreshed ?? relatedCase.previewText ?? null
    };
  });
};

const collectFuzzyRelatedCaseSourceNames = (
  employeeNames: string[],
  mentionedInReport?: string[]
): string[] => [
  ...new Set([
    ...employeeNames,
    ...(mentionedInReport ?? []).map((name) => name.trim()).filter(Boolean)
  ])
];

const loadFuzzyRelatedCases = async (input: {
  sourceNames: string[];
  searchTerms: string[];
  nameBag: RelatedCaseNameBag;
  excludeConversationId: number;
  excludeIntercomIds: string[];
  caseType?: string | null;
  scope?: RelatedCaseSearchScope | null;
  refreshFromIntercom?: boolean;
}): Promise<IntelligenceFuzzyRelatedCase[]> => {
  if (input.sourceNames.length === 0) {
    return [];
  }

  return relatedRetrievalService.findFuzzyRelatedCases({
    sourceNames: input.sourceNames,
    searchTerms: input.searchTerms,
    nameBag: input.nameBag,
    excludeConversationId: input.excludeConversationId,
    excludeIntercomIds: input.excludeIntercomIds,
    caseType: input.caseType,
    scope: input.scope,
    refreshFromIntercom: input.refreshFromIntercom
  });
};

const toRelatedCaseFromFuzzy = (
  fuzzyCase: IntelligenceFuzzyRelatedCase
): IntelligenceRelatedCase => {
  const {
    fuzzyMatchScore: _fuzzyMatchScore,
    fuzzyMatchedName: _fuzzyMatchedName,
    fuzzySharedTokens: _fuzzySharedTokens,
    ...relatedCase
  } = fuzzyCase;
  return relatedCase;
};

const mergeFuzzyRelatedCases = (
  relatedCases: IntelligenceRelatedCase[],
  fuzzyRelatedCases: IntelligenceFuzzyRelatedCase[]
): IntelligenceRelatedCase[] => {
  const seen = new Set(relatedCases.map((relatedCase) => relatedCase.intercomId));
  return [
    ...relatedCases,
    ...fuzzyRelatedCases
      .filter((fuzzyCase) => !seen.has(fuzzyCase.intercomId))
      .map(toRelatedCaseFromFuzzy)
  ];
};

export const intelligenceService = {
  async buildSnapshot(input: {
    conversationId: number;
    employeeMatches: IntelligenceEmployeeMatch[];
    searchTerms: string[];
    caseTypeFilter?: string | null;
    mentionedInReport?: string[];
    messageCount?: number;
    extractionSource?: IntelligenceSnapshot['extractionSource'];
    relatedCaseLimit?: number;
    categoryCaseLimit?: number;
    dismissedRelatedCaseIntercomIds?: string[];
    dismissedCategoryCaseIntercomIds?: string[];
    /** Prior related list — reuse AI summaries for the same Intercom IDs when possible. */
    priorRelatedCases?: IntelligenceRelatedCase[];
    employeeSearchPath?: EmployeeSearchPath;
    employeeSearchNotices?: string[];
    relatedCaseSearchScope?: RelatedCaseSearchScope | null;
    awaitingCompanyDomainSearch?: boolean;
    companyDomainSearchAttempted?: boolean;
    possibleSamePerson?: IntelligencePossibleSamePerson[];
    domainEmployeeMatches?: IntelligencePossibleSamePerson[];
    processedSubject?: string | null;
    employeeMentionStatus?: IntelligenceSnapshot['employeeMentionStatus'];
    unresolvedEmployeeMention?: string | null;
    relatedCaseSearchTerms?: string[];
    currentStoreNumber?: string | null;
  }): Promise<IntelligenceSnapshot> {
    const { searchTerms, employeeNames, employeeIdentityIds, nameBag } =
      await resolveRelatedCaseSearchInput({
        employeeMatches: input.employeeMatches,
        extractedNames: input.mentionedInReport,
        searchTerms: input.searchTerms
      });
    const relatedCaseSearchScope = input.relatedCaseSearchScope ?? null;
    const relatedCasesRaw = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      employeeIdentityIds,
      searchTerms,
      employeeNames,
      nameBag,
      excludeConversationId: input.conversationId,
      limit: input.relatedCaseLimit,
      scope: relatedCaseSearchScope,
      refreshFromIntercom: false
    });

    const relatedCasesBase = filterDismissedRelatedCases(
      filterRelatedCasesByCaseType(relatedCasesRaw, input.caseTypeFilter),
      input.dismissedRelatedCaseIntercomIds
    );
    const fuzzyRelatedCases = await loadFuzzyRelatedCases({
      sourceNames: collectFuzzyRelatedCaseSourceNames(employeeNames, input.mentionedInReport),
      searchTerms,
      nameBag,
      excludeConversationId: input.conversationId,
      excludeIntercomIds: relatedCasesBase.map((relatedCase) => relatedCase.intercomId),
      caseType: input.caseTypeFilter,
      scope: relatedCaseSearchScope,
      refreshFromIntercom: false
    });
    const relatedCases = rankRelatedCases({
      relatedCases: await relatedCaseSummaryService.attachSummaries(
        mergePriorRelatedCaseSummaries(
          mergeFuzzyRelatedCases(relatedCasesBase, fuzzyRelatedCases),
          input.priorRelatedCases
        )
      ),
      caseType: input.caseTypeFilter,
      topicTerms: input.relatedCaseSearchTerms,
      currentStoreNumber: input.currentStoreNumber
    });
    const categoryCases = filterDismissedCategoryCases(
      await fetchCategoryCases({
        conversationId: input.conversationId,
        caseTypeFilter: input.caseTypeFilter,
        limit: input.categoryCaseLimit,
        scope: relatedCaseSearchScope,
        refreshFromIntercom: false
      }),
      input.dismissedCategoryCaseIntercomIds
    );
    const employeeMatches = await employeeNameVariantService.enrichMatches(input.employeeMatches, {
      reportExtractedNames: input.mentionedInReport
    });
    const possibleSamePerson = input.possibleSamePerson
      ? dropAutoLinkedPossibleSamePersonHints(input.possibleSamePerson, employeeMatches)
      : undefined;

    return {
      caseType: input.caseTypeFilter ?? undefined,
      mentionedInReport: input.mentionedInReport ?? [],
      employeeMatches,
      relatedCases,
      fuzzyRelatedCases,
      categoryCases,
      dismissedRelatedCaseIntercomIds: input.dismissedRelatedCaseIntercomIds,
      dismissedCategoryCaseIntercomIds: input.dismissedCategoryCaseIntercomIds,
      messageCount: input.messageCount,
      extractionSource: input.extractionSource,
      employeeSearchPath: input.employeeSearchPath,
      employeeSearchNotices: input.employeeSearchNotices,
      awaitingCompanyDomainSearch: input.awaitingCompanyDomainSearch,
      companyDomainSearchAttempted: input.companyDomainSearchAttempted,
      possibleSamePerson,
      domainEmployeeMatches: input.domainEmployeeMatches,
      relatedCaseSearchScope: relatedCaseSearchScope ?? undefined,
      relatedCasesReporterDomain: scopeIncludesCompanyDomain(relatedCaseSearchScope)
        ? relatedCaseSearchScope?.domain ?? undefined
        : undefined,
      processedSubject: input.processedSubject ?? null,
      employeeMentionStatus: input.employeeMentionStatus,
      unresolvedEmployeeMention: input.unresolvedEmployeeMention ?? null,
      relatedCaseSearchTerms: input.relatedCaseSearchTerms ?? [],
      processedAt: new Date().toISOString()
    };
  },

  async storeReadySnapshot(input: {
    conversationId: number;
    employeeMatches: IntelligenceEmployeeMatch[];
    searchTerms: string[];
    extractedNames?: string[];
    mentionedInReport?: string[];
    caseTypeFilter?: string | null;
    messageCount?: number;
    extractionSource?: IntelligenceSnapshot['extractionSource'];
    relatedCaseLimit?: number;
    categoryCaseLimit?: number;
    employeeSearchPath?: EmployeeSearchPath;
    employeeSearchNotices?: string[];
    relatedCaseSearchScope?: RelatedCaseSearchScope | null;
    awaitingCompanyDomainSearch?: boolean;
    companyDomainSearchAttempted?: boolean;
    possibleSamePerson?: IntelligencePossibleSamePerson[];
    domainEmployeeMatches?: IntelligencePossibleSamePerson[];
    processedSubject?: string | null;
    employeeMentionStatus?: IntelligenceSnapshot['employeeMentionStatus'];
    unresolvedEmployeeMention?: string | null;
    relatedCaseSearchTerms?: string[];
  }): Promise<IntelligenceSnapshot> {
    const existing = await conversationRepository.findById(input.conversationId);
    const dismissedRelatedCaseIntercomIds =
      existing?.intelligenceSnapshot?.dismissedRelatedCaseIntercomIds;
    const dismissedCategoryCaseIntercomIds =
      existing?.intelligenceSnapshot?.dismissedCategoryCaseIntercomIds;

    const built = await this.buildSnapshot({
      ...input,
      mentionedInReport: input.mentionedInReport ?? input.extractedNames ?? [],
      dismissedRelatedCaseIntercomIds,
      dismissedCategoryCaseIntercomIds,
      priorRelatedCases: existing?.intelligenceSnapshot?.relatedCases,
      currentStoreNumber: existing?.reporterStoreNumber ?? null
    });

    const ccRecipients = await resolveCcRecipientsForSnapshot(existing);
    const snapshot: IntelligenceSnapshot = ccRecipients
      ? { ...built, ccRecipients }
      : built;

    const storedCount = existing?.intelligenceSnapshot?.messageCount;
    if (
      storedCount != null &&
      input.messageCount != null &&
      storedCount > input.messageCount
    ) {
      logger.warn('[intelligence] Refusing to overwrite a newer snapshot with a stale run', {
        conversationId: input.conversationId,
        storedCount,
        incomingCount: input.messageCount
      });
      return existing!.intelligenceSnapshot as IntelligenceSnapshot;
    }
    await conversationRepository.updateIntelligence(input.conversationId, {
      status: INTELLIGENCE_STATUS.READY,
      snapshot,
      error: null,
      extractedNames: input.extractedNames ?? null
    });

    logger.info('[intelligence] Snapshot stored', {
      conversationId: input.conversationId,
      employeeMatchCount: snapshot.employeeMatches.length,
      relatedCaseCount: snapshot.relatedCases.length,
      categoryCaseCount: snapshot.categoryCases?.length ?? 0,
      extractedNames: input.extractedNames ?? []
    });

    return snapshot;
  },

  async enrichSnapshotForCanvasDisplay(
    conversation: ConversationRecord,
    snapshot: IntelligenceSnapshot
  ): Promise<IntelligenceSnapshot> {
    const possibleSamePerson = await resolvePossibleSamePersonForDisplay(conversation, snapshot);
    const [relatedCases, categoryCases] = await Promise.all([
      refreshRelatedCasePreviews(snapshot.relatedCases),
      refreshRelatedCasePreviews(snapshot.categoryCases)
    ]);

    return {
      ...snapshot,
      possibleSamePerson,
      relatedCases: relatedCases ?? snapshot.relatedCases,
      fuzzyRelatedCases: snapshot.fuzzyRelatedCases ?? [],
      ...(categoryCases ? { categoryCases } : {})
    };
  },

  async resolvePossibleSamePersonForDisplay(
    conversation: ConversationRecord,
    snapshot: Pick<
      IntelligenceSnapshot,
      'mentionedInReport' | 'employeeMatches' | 'possibleSamePerson' | 'relatedCases'
    >
  ): Promise<IntelligencePossibleSamePerson[]> {
    return resolvePossibleSamePersonForDisplay(conversation, snapshot);
  },

  async buildLiveCanvasSnapshot(conversation: ConversationRecord): Promise<IntelligenceSnapshot> {
    const stored = conversation.intelligenceSnapshot;
    const employeeMatchesRaw = stored?.employeeMatches ?? [];
    const caseTypeFilter = resolveConversationCaseType(conversation);
    const mentionedInReport =
      conversation.extractedNames ??
      stored?.mentionedInReport ??
      employeeMatchesRaw
        .map((match) => match.extractedName)
        .filter((name): name is string => Boolean(name));

    const { searchTerms, employeeNames, employeeIdentityIds, nameBag } =
      await resolveRelatedCaseSearchInput({
        employeeMatches: employeeMatchesRaw,
        extractedNames: mentionedInReport
      });
    const relatedCaseSearchScope = resolveStoredRelatedCaseScope(conversation);
    const relatedCasesRaw = await relatedRetrievalService.findRelatedCasesByMentionedNames({
      employeeIdentityIds,
      searchTerms,
      employeeNames,
      nameBag,
      excludeConversationId: conversation.id,
      scope: relatedCaseSearchScope,
      refreshFromIntercom: true
    });

    const relatedCasesBase = filterDismissedRelatedCases(
      filterRelatedCasesByCaseType(relatedCasesRaw, caseTypeFilter),
      stored?.dismissedRelatedCaseIntercomIds
    );
    const fuzzyRelatedCases = await loadFuzzyRelatedCases({
      sourceNames: collectFuzzyRelatedCaseSourceNames(employeeNames, mentionedInReport),
      searchTerms,
      nameBag,
      excludeConversationId: conversation.id,
      excludeIntercomIds: relatedCasesBase.map((relatedCase) => relatedCase.intercomId),
      caseType: caseTypeFilter,
      scope: relatedCaseSearchScope,
      refreshFromIntercom: true
    });
    // Live canvas path: do not call Gemini again — reuse saved summaries.
    const relatedCases = rankRelatedCases({
      relatedCases: mergePriorRelatedCaseSummaries(
        mergeFuzzyRelatedCases(relatedCasesBase, fuzzyRelatedCases),
        stored?.relatedCases
      ),
      caseType: caseTypeFilter,
      topicTerms: stored?.relatedCaseSearchTerms,
      currentStoreNumber: conversation.reporterStoreNumber
    });
    const categoryCases = filterDismissedCategoryCases(
      await fetchCategoryCases({
        conversationId: conversation.id,
        caseTypeFilter,
        scope: relatedCaseSearchScope,
        refreshFromIntercom: true
      }),
      stored?.dismissedCategoryCaseIntercomIds
    );
    const employeeMatches = await employeeNameVariantService.enrichMatches(employeeMatchesRaw, {
      reportExtractedNames: mentionedInReport
    });

    const possibleSamePerson = await resolvePossibleSamePersonForDisplay(conversation, {
      mentionedInReport,
      employeeMatches,
      possibleSamePerson: stored?.possibleSamePerson ?? [],
      relatedCases
    });

    logger.info('[intelligence] Built live canvas snapshot', {
      conversationId: conversation.id,
      caseTypeFilter,
      storedRelatedCaseCount: stored?.relatedCases.length ?? 0,
      liveRelatedCaseCount: relatedCases.length,
      liveFuzzyRelatedCaseCount: fuzzyRelatedCases.length,
      liveCategoryCaseCount: categoryCases.length,
      possibleSamePersonCount: possibleSamePerson.length,
      searchTermCount: searchTerms.length
    });

    return {
      caseType: caseTypeFilter,
      mentionedInReport,
      employeeMatches,
      relatedCases,
      fuzzyRelatedCases,
      categoryCases,
      dismissedRelatedCaseIntercomIds: stored?.dismissedRelatedCaseIntercomIds,
      dismissedCategoryCaseIntercomIds: stored?.dismissedCategoryCaseIntercomIds,
      possibleSamePerson,
      employeeSearchPath: stored?.employeeSearchPath,
      employeeSearchNotices: filterEmployeeSearchNoticesForDisplay(stored?.employeeSearchNotices, {
        employeeMatchCount: employeeMatches.length,
        awaitingCompanyDomainSearch: stored?.awaitingCompanyDomainSearch
      }),
      awaitingCompanyDomainSearch: false,
      companyDomainSearchAttempted: false,
      relatedCaseSearchScope: undefined,
      relatedCasesReporterDomain: undefined,
      processedSubject: resolveConversationSubject(conversation),
      processedAt: stored?.processedAt ?? new Date().toISOString(),
      employeeMentionStatus: stored?.employeeMentionStatus,
      unresolvedEmployeeMention: stored?.unresolvedEmployeeMention ?? null,
      relatedCaseSearchTerms: stored?.relatedCaseSearchTerms ?? []
    };
  },

  async markFailed(
    conversationId: number,
    error: string,
    context?: {
      messageCount?: number;
      previousSnapshot?: IntelligenceSnapshot | null;
    }
  ): Promise<number> {
    const previousSnapshot = context?.previousSnapshot ?? null;
    const messageCountGrew =
      context?.messageCount !== undefined &&
      previousSnapshot?.messageCount !== undefined &&
      context.messageCount > previousSnapshot.messageCount;
    const attemptCount = messageCountGrew
      ? 1
      : (previousSnapshot?.failureAttempts ?? 0) + 1;
    const failureSnapshot: IntelligenceSnapshot = {
      employeeMatches: previousSnapshot?.employeeMatches ?? [],
      relatedCases: [],
      categoryCases: [],
      dismissedRelatedCaseIntercomIds: previousSnapshot?.dismissedRelatedCaseIntercomIds,
      dismissedCategoryCaseIntercomIds: previousSnapshot?.dismissedCategoryCaseIntercomIds,
      mentionedInReport: previousSnapshot?.mentionedInReport,
      messageCount: context?.messageCount ?? previousSnapshot?.messageCount,
      failureAttempts: attemptCount,
      processedAt: new Date().toISOString()
    };

    await conversationRepository.updateIntelligence(conversationId, {
      status: INTELLIGENCE_STATUS.FAILED,
      snapshot: failureSnapshot,
      error
    });

    logger.error('[intelligence] Processing failed', {
      conversationId,
      error,
      attemptCount,
      maxAttempts: MAX_INTELLIGENCE_ATTEMPTS
    });

    return attemptCount;
  }
};
