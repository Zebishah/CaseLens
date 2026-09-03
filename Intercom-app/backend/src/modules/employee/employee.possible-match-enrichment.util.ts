import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { EMPLOYEE_MATCH_METHOD } from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import type {
  IntelligenceEmployeeMatch,
  IntelligencePossibleSamePerson,
  IntelligenceRelatedCase
} from '../../types/intelligence.types.js';
import {
  conversationRepository,
  type ConversationRecord
} from '../conversation/conversation.repository.js';
import { resolveConversationSubject } from '../conversation/conversation-subject.util.js';
import { findPossibleSamePersonInRoster, loadCompanyDomainEmployeeRoster, loadStoreEmployeeRosterForMatching } from './employee.matching.service.js';
import { employeeRepository } from './employee.repository.js';
import { parseReporterContext } from './employee.reporter-context.util.js';
import {
  extractEmployeeNamesFromSubject,
  sanitizeExtractedEmployeeNames
} from './employee.subject-name.util.js';
import { isClearlyNonPersonEmployeeName } from './employee.mention-validation.util.js';
import {
  scorePossibleSamePersonCandidate,
  type TokenMatchScore
} from './employee.token-match.util.js';

const dedupePossibleSamePerson = (
  matches: IntelligencePossibleSamePerson[]
): IntelligencePossibleSamePerson[] =>
  matches.filter(
    (match, index, array) =>
      array.findIndex(
        (item) =>
          item.employeeIdentityId === match.employeeIdentityId &&
          item.canonicalName.toLowerCase() === match.canonicalName.toLowerCase()
      ) === index
  );

const resolveMentionedNames = (
  conversation: ConversationRecord,
  mentionedInReport: string[],
  employeeMatches: IntelligenceEmployeeMatch[]
): string[] => {
  const names = [
    ...(conversation.extractedNames ?? []),
    ...mentionedInReport,
    ...employeeMatches
      .map((match) => match.extractedName)
      .filter((name): name is string => Boolean(name?.trim()))
  ];

  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
};

const toPossibleHint = (
  canonicalName: string,
  employeeIdentityId: number,
  scored: TokenMatchScore
): IntelligencePossibleSamePerson => ({
  employeeIdentityId,
  canonicalName,
  confidenceScore: scored.confidenceScore,
  matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN,
  sharedTokens: scored.sharedTokens
});

const addRosterHints = (
  hints: IntelligencePossibleSamePerson[],
  mentionedNames: string[],
  roster: Array<{ id: number; canonicalName: string }>,
  matchedIdentityIds: Set<number>
): void => {
  for (const extractedName of mentionedNames) {
    for (const hint of findPossibleSamePersonInRoster(extractedName, roster)) {
      if (matchedIdentityIds.has(hint.employeeIdentityId)) {
        continue;
      }
      if (
        hints.some(
          (existing) =>
            existing.employeeIdentityId === hint.employeeIdentityId ||
            existing.canonicalName.toLowerCase() === hint.canonicalName.toLowerCase()
        )
      ) {
        continue;
      }
      hints.push(hint);
    }
  }
};

const addSiblingNameHints = async (
  hints: IntelligencePossibleSamePerson[],
  mentionedNames: string[],
  siblingNames: string[],
  matchedIdentityIds: Set<number>
): Promise<void> => {
  for (const siblingName of siblingNames) {
    const normalizedSibling = siblingName.trim();
    if (!normalizedSibling) {
      continue;
    }

    if (mentionedNames.some((name) => name.toLowerCase() === normalizedSibling.toLowerCase())) {
      continue;
    }

    let bestScore: TokenMatchScore | null = null;
    for (const extractedName of mentionedNames) {
      const scored = scorePossibleSamePersonCandidate(extractedName, normalizedSibling);
      if (!scored || (bestScore && scored.confidenceScore <= bestScore.confidenceScore)) {
        continue;
      }
      bestScore = scored;
    }

    if (!bestScore) {
      continue;
    }

    const identity =
      (await employeeRepository.findByCanonicalName(normalizedSibling)) ??
      (await employeeRepository.findFuzzyByCanonicalName(normalizedSibling, 0.35))[0];

    const employeeIdentityId = identity?.id ?? 0;
    if (employeeIdentityId > 0 && matchedIdentityIds.has(employeeIdentityId)) {
      continue;
    }

    if (
      hints.some(
        (existing) => existing.canonicalName.toLowerCase() === normalizedSibling.toLowerCase()
      )
    ) {
      continue;
    }

    hints.push(
      toPossibleHint(
        identity?.canonicalName ?? normalizedSibling,
        employeeIdentityId > 0 ? employeeIdentityId : -Math.abs(normalizedSibling.length * 9973),
        bestScore
      )
    );
  }
};

const loadSiblingNamesFromRelatedCases = async (
  relatedCases: IntelligenceRelatedCase[],
  excludeConversationId: number
): Promise<string[]> => {
  const names: string[] = [];

  for (const relatedCase of relatedCases) {
    if (relatedCase.conversationId === excludeConversationId) {
      continue;
    }

    names.push(...(relatedCase.matchedEmployeeNames ?? []));

    const sibling = await conversationRepository.findById(relatedCase.conversationId);
    if (!sibling) {
      continue;
    }

    names.push(...(sibling.extractedNames ?? []));
    names.push(...extractEmployeeNamesFromSubject(resolveConversationSubject(sibling)));
  }

  return sanitizeExtractedEmployeeNames(names);
};

export const enrichPossibleSamePersonHints = async (input: {
  conversation: ConversationRecord;
  mentionedInReport: string[];
  employeeMatches: IntelligenceEmployeeMatch[];
  existingHints?: IntelligencePossibleSamePerson[];
  relatedCases?: IntelligenceRelatedCase[];
}): Promise<IntelligencePossibleSamePerson[]> => {
  const reporterContext = parseReporterContext(
    input.conversation.reporterName,
    input.conversation.reporterEmail
  );
  const mentionedNames = resolveMentionedNames(
    input.conversation,
    input.mentionedInReport,
    input.employeeMatches
  ).filter((name) => !isClearlyNonPersonEmployeeName(name));
  const matchedIdentityIds = new Set(
    input.employeeMatches.map((match) => match.employeeIdentityId)
  );
  const hints = (input.existingHints ?? []).filter(
    (hint) => !isClearlyNonPersonEmployeeName(hint.canonicalName)
  );
  const relatedCases = input.relatedCases ?? [];

  if (reporterContext.storeNumber) {
    const storeRoster = await loadStoreEmployeeRosterForMatching(
      reporterContext.storeNumber,
      input.conversation.id
    );
    addRosterHints(hints, mentionedNames, storeRoster, matchedIdentityIds);

    logger.info('[possible-match] Store roster hints', {
      conversationId: input.conversation.id,
      storeNumber: reporterContext.storeNumber,
      rosterSize: storeRoster.length,
      hintCount: hints.length
    });
  }

  if (reporterContext.domain && hints.length < INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT) {
    const domainRoster = await loadCompanyDomainEmployeeRoster(
      reporterContext.domain,
      input.conversation.id,
      { excludeStoreScoped: false }
    );
    const beforeDomain = hints.length;
    addRosterHints(hints, mentionedNames, domainRoster, matchedIdentityIds);

    logger.info('[possible-match] Company domain roster hints', {
      conversationId: input.conversation.id,
      domain: reporterContext.domain,
      rosterSize: domainRoster.length,
      addedHintCount: hints.length - beforeDomain
    });
  }

  if (relatedCases.length > 0 && hints.length < INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT) {
    const siblingNames = await loadSiblingNamesFromRelatedCases(
      relatedCases,
      input.conversation.id
    );
    const beforeSibling = hints.length;
    await addSiblingNameHints(hints, mentionedNames, siblingNames, matchedIdentityIds);

    logger.info('[possible-match] Related-ticket name hints', {
      conversationId: input.conversation.id,
      siblingNameCount: siblingNames.length,
      addedHintCount: hints.length - beforeSibling
    });
  }

  const results = dedupePossibleSamePerson(hints)
    .filter((hint) => !isClearlyNonPersonEmployeeName(hint.canonicalName))
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT);

  logger.info('[possible-match] Enriched possible same person hints', {
    conversationId: input.conversation.id,
    mentionedNames,
    hintCount: results.length,
    topHint: results[0] ?? null
  });

  return results;
};
