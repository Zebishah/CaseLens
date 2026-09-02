import {
  FUZZY_RELATED_CASE_LIST_LIMIT,
  FUZZY_RELATED_CASE_SCAN_LIMIT,
  RELATED_CASE_LIST_LIMIT
} from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import type {
  IntelligenceFuzzyRelatedCase,
  IntelligenceRelatedCase,
  IntelligenceSnapshot
} from '../../types/intelligence.types.js';
import { extractAdvisorNameFromPayload } from '../conversation/advisor-name.util.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import { parseReporterContext } from '../employee/employee.reporter-context.util.js';
import { resolveCaseType } from '../conversation/case-type.util.js';
import {
  conversationRepository,
  type ConversationRecord
} from '../conversation/conversation.repository.js';
import { conversationEmployeesRepository } from '../conversation/conversation-employees.repository.js';
import { conversationService } from '../conversation/conversation.service.js';
import {
  conversationMatchesRelatedCaseScope,
  type RelatedCaseSearchScope
} from '../conversation/related-case-scope.util.js';
import { intercomClient } from '../intercom/intercom.client.js';
import { extractEmployeeNamesFromSubject } from '../employee/employee.subject-name.util.js';
import { formatRelatedCasePreviewText } from './related-case-preview.util.js';
import {
  textContainsNameTerm,
  type RelatedCaseNameBag
} from './related-case-name-match.util.js';
import {
  findBestFuzzyRelatedCaseMatch,
  subjectMatchesExactRelatedCaseTerms
} from './related-case-fuzzy-match.util.js';

const legacyScopeFromDomain = (
  reporterDomain: string | null | undefined
): RelatedCaseSearchScope | null => {
  const domain = reporterDomain?.trim().toLowerCase();
  if (!domain) {
    return null;
  }

  return {
    mode: 'domain',
    storeNumber: null,
    domain
  };
};

const adminNameCache = new Map<string, string>();

/** Raw SQL rows return timestamps as strings; Drizzle query rows return Date objects. */
const toIsoDateString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return String(value);
};

const resolveAdvisorName = async (
  assignedIntercomAdminId: string | null,
  rawPayload: Record<string, unknown> | null | undefined
): Promise<string | null> => {
  const fromPayload = extractAdvisorNameFromPayload(rawPayload);
  if (fromPayload) {
    return fromPayload;
  }

  if (!assignedIntercomAdminId) {
    return null;
  }

  const cached = adminNameCache.get(assignedIntercomAdminId);
  if (cached) {
    return cached;
  }

  try {
    const admin = await intercomClient.getAdmin(assignedIntercomAdminId);
    const name = admin.name ?? null;
    if (name) {
      adminNameCache.set(assignedIntercomAdminId, name);
    }
    return name;
  } catch (error) {
    logger.warn('[related-retrieval] Could not resolve advisor name from Intercom API', {
      assignedIntercomAdminId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

const resolveConversationEmployeeNames = (conversation: ConversationRecord): string[] => {
  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const names = [
    ...(conversation.extractedNames ?? []),
    ...(snapshot?.mentionedInReport ?? [])
  ];

  const unique = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      unique.add(trimmed);
    }
  }

  return [...unique];
};

const resolveLinkedExtractedName = (
  conversationId: number,
  employeeIdentityIds: number[],
  linksByConversationId: Map<number, Array<{ employeeIdentityId: number; extractedName: string | null }>>
): string | null => {
  const links = linksByConversationId.get(conversationId) ?? [];
  const identityIdSet = new Set(employeeIdentityIds);

  for (const link of links) {
    if (!identityIdSet.has(link.employeeIdentityId)) {
      continue;
    }

    const extractedName = link.extractedName?.trim();
    if (extractedName) {
      return extractedName;
    }
  }

  return null;
};

/** One display name per related case — that ticket's employee, not the open ticket's search terms. */
const resolvePrimaryEmployeeNameForRelatedCase = (
  conversation: ConversationRecord,
  input?: {
    employeeIdentityIds?: number[];
    linksByConversationId?: Map<
      number,
      Array<{ employeeIdentityId: number; extractedName: string | null }>
    >;
    nameBag?: RelatedCaseNameBag;
  }
): string | null => {
  const linkedExtractedName = input?.linksByConversationId
    ? resolveLinkedExtractedName(
        conversation.id,
        input.employeeIdentityIds ?? [],
        input.linksByConversationId
      )
    : null;
  if (linkedExtractedName) {
    return linkedExtractedName;
  }

  const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot | null | undefined;
  const canonicalFromMatch = snapshot?.employeeMatches?.[0]?.canonicalName?.trim();
  if (canonicalFromMatch) {
    return canonicalFromMatch;
  }

  const fromConversation = resolveConversationEmployeeNames(conversation);
  if (fromConversation.length > 0) {
    return fromConversation[0] ?? null;
  }

  const subject = resolveConversationSubject(conversation);
  if (subject) {
    const fromSubject = extractEmployeeNamesFromSubject(subject)[0];
    if (fromSubject) {
      return fromSubject;
    }

    const fullNames = input?.nameBag?.fullNames ?? [];
    const fromSubjectFullName = fullNames
      .filter((name) => textContainsNameTerm(subject, name))
      .sort((left, right) => right.length - left.length)[0];
    if (fromSubjectFullName) {
      return fromSubjectFullName;
    }
  }

  return null;
};

const resolveMatchedEmployeeNames = (
  conversation: ConversationRecord,
  input: {
    employeeIdentityIds: number[];
    nameBag: RelatedCaseNameBag;
    linksByConversationId: Map<number, Array<{ employeeIdentityId: number; extractedName: string | null }>>;
  }
): string[] => {
  const primary = resolvePrimaryEmployeeNameForRelatedCase(conversation, {
    employeeIdentityIds: input.employeeIdentityIds,
    linksByConversationId: input.linksByConversationId,
    nameBag: input.nameBag
  });

  return primary ? [primary] : [];
};

const dedupeConversationRows = (rows: ConversationRecord[]): ConversationRecord[] =>
  rows.filter((row, index, all) => {
    const firstIndex = all.findIndex((candidate) => candidate.id === row.id);
    return firstIndex === index;
  });

const sortConversationRowsByCreatedAt = (rows: ConversationRecord[]): ConversationRecord[] =>
  [...rows].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return rightTime - leftTime;
  });

const hydrateConversationRowsFromIntercom = async (
  rows: ConversationRecord[],
  limit?: number
): Promise<ConversationRecord[]> => {
  const intercomIds = rows.map((row) => row.intercomId);
  if (intercomIds.length === 0) {
    return rows;
  }

  await conversationService.refreshConversationsFromIntercom(intercomIds, { limit });

  const refreshedRows = await conversationRepository.findByIntercomIds(intercomIds);
  const refreshedByIntercomId = new Map(
    refreshedRows.map((row) => [row.intercomId, row] as const)
  );

  return rows.map((row) => refreshedByIntercomId.get(row.intercomId) ?? row);
};

const toRelatedCase = async (
  conversation: ConversationRecord,
  matchedEmployeeNames: string[],
  previewText?: string | null
): Promise<IntelligenceRelatedCase> => {
  const reporterContext = parseReporterContext(
    conversation.reporterName,
    conversation.reporterEmail
  );

  return {
    conversationId: conversation.id,
    intercomId: conversation.intercomId,
    subject: resolveConversationSubject(conversation),
    caseType: resolveCaseType({
      subject: resolveConversationSubject(conversation),
      rawPayload: conversation.rawPayload ?? null,
      storedCaseType: conversation.caseType
    }),
    matchedEmployeeNames,
    reporterName: conversation.reporterName ?? null,
    reporterEmail: conversation.reporterEmail ?? null,
    reporterStoreNumber: conversation.reporterStoreNumber ?? reporterContext.storeNumber,
    reporterCompanyDomain: conversation.reporterCompanyDomain ?? reporterContext.domain,
    status: conversation.status ?? null,
    advisorName: await resolveAdvisorName(
      conversation.assignedIntercomAdminId,
      conversation.rawPayload ?? null
    ),
    createdAt: toIsoDateString(conversation.createdAt),
    previewText: previewText ?? null
  };
};

const loadPreviewTextByConversationId = async (
  conversations: ConversationRecord[]
): Promise<Map<number, string | null>> => {
  const bodies = await conversationRepository.findFirstMessageBodiesByConversationIds(
    conversations.map((row) => row.id)
  );
  const previews = new Map<number, string | null>();

  for (const row of conversations) {
    previews.set(row.id, formatRelatedCasePreviewText(bodies.get(row.id) ?? null));
  }

  return previews;
};

export const relatedRetrievalService = {
  async findRelatedCasesByMentionedNames(input: {
    employeeIdentityIds?: number[];
    searchTerms: string[];
    employeeNames?: string[];
    nameBag?: RelatedCaseNameBag;
    excludeConversationId: number;
    limit?: number;
    scope?: RelatedCaseSearchScope | null;
    /** @deprecated Use scope */
    reporterDomain?: string | null;
    refreshFromIntercom?: boolean;
  }): Promise<IntelligenceRelatedCase[]> {
    const limit = input.limit ?? RELATED_CASE_LIST_LIMIT;
    const scope = input.scope ?? legacyScopeFromDomain(input.reporterDomain);
    const employeeIdentityIds = [...new Set(input.employeeIdentityIds ?? [])];
    const nameSearchTerms = [
      ...new Set(
        [...input.searchTerms, ...(input.employeeNames ?? [])]
          .map((name) => name.trim())
          .filter((name) => name.length >= 3)
      )
    ];
    if (employeeIdentityIds.length === 0 && nameSearchTerms.length === 0) {
      return [];
    }
    const nameBag =
      input.nameBag ??
      ({
        fullNames: [...new Set((input.employeeNames ?? input.searchTerms).map((name) => name.trim()))],
        tokens: []
      } satisfies RelatedCaseNameBag);

    const [identityRows, nameRows] = await Promise.all([
      employeeIdentityIds.length > 0
        ? conversationRepository.findRelatedByEmployeeIdentityIds(
            employeeIdentityIds,
            input.excludeConversationId,
            limit,
            { scope }
          )
        : Promise.resolve([]),
      nameSearchTerms.length > 0
        ? conversationRepository.findRelatedByMentionedNames(
            nameSearchTerms,
            input.excludeConversationId,
            limit,
            { scope }
          )
        : Promise.resolve([])
    ]);

    let mergedRows = sortConversationRowsByCreatedAt(
      dedupeConversationRows([...identityRows, ...nameRows])
    )
      .filter((row) => conversationMatchesRelatedCaseScope(row, scope))
      .slice(0, limit);

    if (input.refreshFromIntercom === true) {
      mergedRows = await hydrateConversationRowsFromIntercom(mergedRows, limit);
    }

    const links =
      employeeIdentityIds.length > 0
        ? await conversationEmployeesRepository.findMentionsByEmployeeIdentityIds(employeeIdentityIds)
        : [];

    const linksByConversationId = new Map<
      number,
      Array<{ employeeIdentityId: number; extractedName: string | null }>
    >();

    for (const link of links) {
      const existing = linksByConversationId.get(link.conversationId) ?? [];
      existing.push({
        employeeIdentityId: link.employeeIdentityId,
        extractedName: link.extractedName
      });
      linksByConversationId.set(link.conversationId, existing);
    }

    logger.info('[related-retrieval] Found related conversations', {
      excludeConversationId: input.excludeConversationId,
      employeeIdentityCount: employeeIdentityIds.length,
      searchTermCount: input.searchTerms.length,
      identityMatchCount: identityRows.length,
      nameMatchCount: nameRows.length,
      mergedCount: mergedRows.length,
      scopeMode: scope?.mode ?? 'none'
    });

    const previewById = await loadPreviewTextByConversationId(mergedRows);

    return Promise.all(
      mergedRows.map(async (row) =>
        toRelatedCase(
          row,
          resolveMatchedEmployeeNames(row, {
            employeeIdentityIds,
            nameBag,
            linksByConversationId
          }),
          previewById.get(row.id) ?? null
        )
      )
    );
  },

  async findCasesByCaseType(input: {
    caseType: string;
    excludeConversationId: number;
    limit?: number;
    scope?: RelatedCaseSearchScope | null;
    /** @deprecated Use scope */
    reporterDomain?: string | null;
    refreshFromIntercom?: boolean;
  }): Promise<IntelligenceRelatedCase[]> {
    const limit = input.limit ?? RELATED_CASE_LIST_LIMIT;
    let rows = await conversationRepository.findByCaseType(
      input.caseType,
      input.excludeConversationId,
      limit,
      { scope: input.scope ?? legacyScopeFromDomain(input.reporterDomain) }
    );

    if (input.refreshFromIntercom === true) {
      rows = await hydrateConversationRowsFromIntercom(rows, limit);
    }

    logger.info('[related-retrieval] Found conversations by case category', {
      excludeConversationId: input.excludeConversationId,
      caseType: input.caseType.trim().toLowerCase(),
      scopeMode: input.scope?.mode ?? legacyScopeFromDomain(input.reporterDomain)?.mode ?? 'none',
      count: rows.length
    });

    const previewById = await loadPreviewTextByConversationId(rows);

    return Promise.all(
      rows.map(async (row) => {
        const primary = resolvePrimaryEmployeeNameForRelatedCase(row);
        return toRelatedCase(row, primary ? [primary] : [], previewById.get(row.id) ?? null);
      })
    );
  },

  async findFuzzyRelatedCases(input: {
    sourceNames: string[];
    searchTerms: string[];
    nameBag: RelatedCaseNameBag;
    excludeConversationId: number;
    excludeIntercomIds?: string[];
    caseType?: string | null;
    scope?: RelatedCaseSearchScope | null;
    limit?: number;
    refreshFromIntercom?: boolean;
  }): Promise<IntelligenceFuzzyRelatedCase[]> {
    if (input.sourceNames.length === 0) {
      return [];
    }

    const scope = input.scope ?? null;
    const limit = input.limit ?? FUZZY_RELATED_CASE_LIST_LIMIT;
    const excludedIntercomIds = new Set(input.excludeIntercomIds ?? []);

    let rows = await conversationRepository.findRecentForRelatedScan(
      input.excludeConversationId,
      FUZZY_RELATED_CASE_SCAN_LIMIT,
      { scope }
    );

    if (input.refreshFromIntercom === true) {
      rows = await hydrateConversationRowsFromIntercom(rows, FUZZY_RELATED_CASE_SCAN_LIMIT);
    }

    const fuzzyMatches: IntelligenceFuzzyRelatedCase[] = [];
    const previewById = await loadPreviewTextByConversationId(rows);

    for (const row of rows) {
      if (excludedIntercomIds.has(row.intercomId)) {
        continue;
      }

      if (!conversationMatchesRelatedCaseScope(row, scope)) {
        continue;
      }

      const subject = resolveConversationSubject(row);
      if (subjectMatchesExactRelatedCaseTerms(subject, input.searchTerms, input.nameBag)) {
        continue;
      }

      const fuzzyMatch = findBestFuzzyRelatedCaseMatch({
        sourceNames: input.sourceNames,
        subject,
        extractedNames: row.extractedNames
      });

      if (!fuzzyMatch) {
        continue;
      }

      const primary = resolvePrimaryEmployeeNameForRelatedCase(row);
      const relatedCase = await toRelatedCase(
        row,
        primary ? [primary] : [],
        previewById.get(row.id) ?? null
      );
      fuzzyMatches.push({
        ...relatedCase,
        fuzzyMatchScore: fuzzyMatch.score,
        fuzzyMatchedName: fuzzyMatch.matchedName,
        fuzzySharedTokens: fuzzyMatch.sharedTokens
      });

      if (fuzzyMatches.length >= limit) {
        break;
      }
    }

    logger.info('[related-retrieval] Found fuzzy related cases', {
      excludeConversationId: input.excludeConversationId,
      caseType: input.caseType?.trim().toLowerCase() || null,
      scopeMode: scope?.mode ?? 'none',
      count: fuzzyMatches.length
    });

    return fuzzyMatches.sort(
      (left, right) =>
        right.fuzzyMatchScore - left.fuzzyMatchScore ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  },

  /** @deprecated Use findRelatedCasesByMentionedNames */
  async findRelatedCases(input: {
    employeeIdentityId: number;
    excludeConversationId: number;
    limit?: number;
  }): Promise<IntelligenceRelatedCase[]> {
    const rows = await conversationRepository.findRelatedByEmployeeIdentity(
      input.employeeIdentityId,
      input.excludeConversationId,
      input.limit ?? RELATED_CASE_LIST_LIMIT
    );

    const previewById = await loadPreviewTextByConversationId(rows);

    return Promise.all(
      rows.map(async (row) => toRelatedCase(row, [], previewById.get(row.id) ?? null))
    );
  }
};
