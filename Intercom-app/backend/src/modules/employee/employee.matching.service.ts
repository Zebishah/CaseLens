import {
  EMPLOYEE_MATCH_METHOD,
  type EmployeeMatchMethod
} from '../../constants/intelligence.constants.js';
import {
  EMPLOYEE_SEARCH_NOTICE,
  EMPLOYEE_SEARCH_PATH,
  type EmployeeSearchPath
} from '../../constants/employee-search.constants.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { logger } from '../../config/logger.config.js';
import type { IntelligenceEmployeeMatch } from '../../types/intelligence.types.js';
import type { IntelligencePossibleSamePerson } from '../../types/intelligence.types.js';
import { getCanonicalNameFromContact, getNameMatchVariants, normalizeForMatch, tokenizeOrderedContactName } from './employee.name.util.js';
import {
  scoreExtractedNameMatch,
  scorePossibleSamePersonCandidate,
  scoreStoreSameFirstNicknameMatch,
  shouldRejectExtractedNameMatch
} from './employee.token-match.util.js';
import {
  dedupeMatchesByIdentity,
  filterMatchesAboveThreshold,
  similarityToConfidence
} from './employee.matching.util.js';
import { filterMatchesByReporterDomain } from './employee.domain-gate.util.js';
import { parseReporterContext } from './employee.reporter-context.util.js';
import { employeeRepository, type EmployeeIdentityRow } from './employee.repository.js';

export type EmployeeMatchInput = {
  contactName: string | null;
  contactEmail: string | null;
  intercomContactId?: string | null;
};

export type EmployeeNameInput = {
  extractedName: string;
  /** Reporter name on the open conversation — used for store/domain scoping. */
  caseReporterName?: string | null;
  /** Reporter email on the open conversation — domain gate and store/domain scoping. */
  caseReporterEmail?: string | null;
  /** Current conversation — used to detect prior store cases and linked employees. */
  conversationId?: number;
  /** User chose company domain search in the sidebar — skip store roster. */
  searchFromDomain?: boolean;
  /** Prior linked employees — boosts re-matching after subject edits. */
  preferredEmployeeIdentityIds?: number[];
};

export type EmployeeMentionStatus = 'resolved' | 'unresolved' | 'ambiguous' | 'no_employee_mentioned';

export type EmployeeMatchResolution = {
  matches: IntelligenceEmployeeMatch[];
  searchPath: EmployeeSearchPath;
  notices: string[];
  mentionStatus?: EmployeeMentionStatus;
  /** Store roster had no match — wait for teammate to click domain search. */
  awaitingCompanyDomainSearch?: boolean;
  /** Near-miss roster names when store search found no exact match. */
  possibleSamePerson?: IntelligencePossibleSamePerson[];
};

const parseStoredConfidence = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 95;
};

const toMatchResult = (
  identity: { id: number; canonicalName: string },
  confidenceScore: number,
  matchMethod: string
): IntelligenceEmployeeMatch => ({
  employeeIdentityId: identity.id,
  canonicalName: identity.canonicalName,
  confidenceScore,
  matchMethod
});

const deriveCanonicalName = (input: EmployeeMatchInput): string | null => {
  const fromName = getCanonicalNameFromContact(input.contactName);
  if (fromName) {
    return fromName;
  }

  if (input.contactEmail) {
    const localPart = input.contactEmail.split('@')[0]?.trim();
    return localPart || input.contactEmail;
  }

  if (input.intercomContactId) {
    return `Contact ${input.intercomContactId}`;
  }

  return null;
};

const shouldLearnAliasFromMatch = (
  match: IntelligenceEmployeeMatch,
  extractedName?: string
): boolean => {
  const normalizedExtracted = normalizeForMatch(extractedName ?? '');

  if (
    normalizedExtracted &&
    !scoreStoreSameFirstNicknameMatch(extractedName ?? '', match.canonicalName) &&
    shouldRejectExtractedNameMatch(extractedName ?? '', match.canonicalName)
  ) {
    return false;
  }

  if (match.matchMethod === EMPLOYEE_MATCH_METHOD.EXACT) {
    return true;
  }

  if (match.matchMethod === EMPLOYEE_MATCH_METHOD.TOKEN) {
    return match.confidenceScore >= INTERCOM_MATCH.ALIAS_LEARNING_MIN_CONFIDENCE;
  }

  if (match.confidenceScore >= INTERCOM_MATCH.ALIAS_LEARNING_MIN_CONFIDENCE) {
    return true;
  }

  return false;
};

const recordNameAliases = async (
  employeeIdentityId: number,
  extractedName: string,
  match: IntelligenceEmployeeMatch
): Promise<void> => {
  if (!shouldLearnAliasFromMatch(match, extractedName)) {
    logger.info('[employee-matching] Skipped alias learning — confidence below threshold', {
      employeeIdentityId,
      extractedName,
      confidenceScore: match.confidenceScore,
      matchMethod: match.matchMethod,
      minConfidence: INTERCOM_MATCH.ALIAS_LEARNING_MIN_CONFIDENCE
    });
    return;
  }

  const variants = getNameMatchVariants(extractedName);
  const confidenceScore = Math.round(match.confidenceScore);
  const matchMethod = match.matchMethod as EmployeeMatchMethod;

  for (const alias of variants) {
    const created = await employeeRepository.createAlias({
      employeeIdentityId,
      alias,
      confidenceScore,
      matchMethod
    });

    if (created) {
      logger.info('[employee-matching] Learned alias from extracted name', {
        employeeIdentityId,
        alias
      });
    }
  }
};

const recordContactAliases = async (
  employeeIdentityId: number,
  input: EmployeeMatchInput,
  match: IntelligenceEmployeeMatch
): Promise<void> => {
  if (!input.contactName) {
    return;
  }

  await recordNameAliases(employeeIdentityId, input.contactName, match);
};

const EXTRACTED_NAME_FUZZY_THRESHOLD = 0.35;
/** Auto-link extracted names only at alias-learning confidence — below this is hints only. */
const NAME_RESOLUTION_CONFIDENCE_THRESHOLD = INTERCOM_MATCH.ALIAS_LEARNING_MIN_CONFIDENCE;
const PREFERRED_IDENTITY_BOOST = 12;

const collapseTypoDuplicateMatches = (
  extractedName: string,
  matches: IntelligenceEmployeeMatch[]
): IntelligenceEmployeeMatch[] => {
  if (matches.length <= 1) {
    return matches;
  }

  const sameSpellingDifferentPeople = matches.some((left, index) =>
    matches.slice(index + 1).some(
      (right) =>
        left.employeeIdentityId !== right.employeeIdentityId &&
        normalizeForMatch(left.canonicalName) === normalizeForMatch(right.canonicalName)
    )
  );

  if (sameSpellingDifferentPeople) {
    return matches;
  }

  const allAreTypoVariants = matches.every((left) =>
    matches.every((right) => {
      if (left.employeeIdentityId === right.employeeIdentityId) {
        return true;
      }

      return Boolean(
        scoreExtractedNameMatch(left.canonicalName, right.canonicalName) ||
          scoreExtractedNameMatch(extractedName, right.canonicalName)
      );
    })
  );

  if (!allAreTypoVariants) {
    return matches;
  }

  return [...matches].sort((left, right) => {
    const leftTokens = tokenizeOrderedContactName(left.canonicalName).length;
    const rightTokens = tokenizeOrderedContactName(right.canonicalName).length;
    if (rightTokens !== leftTokens) {
      return rightTokens - leftTokens;
    }

    return left.employeeIdentityId - right.employeeIdentityId;
  }).slice(0, 1);
};

const filterRejectedNameMatches = (
  extractedName: string,
  matches: IntelligenceEmployeeMatch[]
): IntelligenceEmployeeMatch[] =>
  matches.filter((match) => {
    if (scoreStoreSameFirstNicknameMatch(extractedName, match.canonicalName)) {
      return true;
    }

    return !shouldRejectExtractedNameMatch(extractedName, match.canonicalName);
  });

const matchExtractedNameAgainstRoster = async (
  extractedName: string,
  roster?: EmployeeIdentityRow[]
): Promise<IntelligenceEmployeeMatch[]> => {
  const identities = roster ?? (await employeeRepository.findAll());
  const matches: IntelligenceEmployeeMatch[] = [];
  const normalizedExtracted = normalizeForMatch(extractedName);

  for (const identity of identities) {
    if (normalizeForMatch(identity.canonicalName) === normalizedExtracted) {
      continue;
    }

    const scored = scoreExtractedNameMatch(extractedName, identity.canonicalName);
    if (scored) {
      matches.push({
        employeeIdentityId: identity.id,
        canonicalName: identity.canonicalName,
        confidenceScore: scored.confidenceScore,
        matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN
      });
      continue;
    }

    const storeNickname = scoreStoreSameFirstNicknameMatch(extractedName, identity.canonicalName);
    if (storeNickname) {
      matches.push({
        employeeIdentityId: identity.id,
        canonicalName: identity.canonicalName,
        confidenceScore: storeNickname.confidenceScore,
        matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN
      });
    }
  }

  return matches;
};

const findPossibleDuplicateNotices = async (
  extractedName: string,
  roster?: EmployeeIdentityRow[]
): Promise<string[]> => {
  const scopedRoster = roster ?? (await employeeRepository.findAll());
  return findPossibleSamePersonInRoster(extractedName, scopedRoster).map((match) =>
    EMPLOYEE_SEARCH_NOTICE.possibleDuplicate(match.canonicalName, match.confidenceScore)
  );
};

export const findPossibleSamePersonInRoster = (
  extractedName: string,
  roster?: Array<Pick<EmployeeIdentityRow, 'id' | 'canonicalName'>>
): IntelligencePossibleSamePerson[] => {
  const identities = roster ?? [];
  const matches: IntelligencePossibleSamePerson[] = [];

  for (const identity of identities) {
    const scored = scorePossibleSamePersonCandidate(extractedName, identity.canonicalName);

    if (!scored) {
      continue;
    }

    matches.push({
      employeeIdentityId: identity.id,
      canonicalName: identity.canonicalName,
      confidenceScore: scored.confidenceScore,
      matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN,
      sharedTokens: scored.sharedTokens
    });
  }

  return matches
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT);
};

const dedupeEmployeeIdentitiesById = (rows: EmployeeIdentityRow[]): EmployeeIdentityRow[] => {
  const seen = new Set<number>();
  const result: EmployeeIdentityRow[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    result.push(row);
  }

  return result;
};

const loadStoreEmployeeRoster = async (
  storeNumber: string,
  excludeConversationId?: number
): Promise<EmployeeIdentityRow[]> => {
  const storeRoster = await employeeRepository.findByStoreNumber(storeNumber);
  if (!excludeConversationId) {
    return storeRoster;
  }

  const fromOtherStoreCases = await employeeRepository.findIdentitiesLinkedAtStoreConversations(
    storeNumber,
    excludeConversationId
  );

  return dedupeEmployeeIdentitiesById([...storeRoster, ...fromOtherStoreCases]);
};

export const loadCompanyDomainEmployeeRoster = async (
  domain: string,
  excludeConversationId?: number,
  options?: { excludeStoreScoped?: boolean }
): Promise<EmployeeIdentityRow[]> => {
  const fromColumn = await employeeRepository.findByCompanyDomain(domain, {
    excludeStoreScoped: options?.excludeStoreScoped
  });

  if (!excludeConversationId) {
    return dedupeEmployeeIdentitiesById(fromColumn);
  }

  const fromConversations = await employeeRepository.findIdentitiesLinkedAtCompanyDomainConversations(
    domain,
    excludeConversationId,
    { excludeStoreScopedConversations: options?.excludeStoreScoped }
  );

  return dedupeEmployeeIdentitiesById([...fromColumn, ...fromConversations]);
};

export const loadStoreEmployeeRosterForMatching = loadStoreEmployeeRoster;

const buildStoreDomainSearchResolution = (
  reporterContext: ReturnType<typeof parseReporterContext>,
  notices: string[],
  possibleSamePerson?: IntelligencePossibleSamePerson[]
): EmployeeMatchResolution => {
  const resultNotices = [...notices, EMPLOYEE_SEARCH_NOTICE.NO_EXACT_STORE_MATCH];

  if (reporterContext.domain) {
    resultNotices.push(
      EMPLOYEE_SEARCH_NOTICE.noStoreMatchOfferDomainSearch(reporterContext.storeNumber ?? '')
    );
    return {
      matches: [],
      searchPath: EMPLOYEE_SEARCH_PATH.STORE,
      notices: resultNotices,
      awaitingCompanyDomainSearch: true,
      possibleSamePerson
    };
  }

  return {
    matches: [],
    searchPath: EMPLOYEE_SEARCH_PATH.STORE,
    notices: resultNotices,
    possibleSamePerson
  };
};

const _buildStoreNoExactMatchResolution = (
  input: EmployeeNameInput,
  reporterContext: ReturnType<typeof parseReporterContext>,
  storeRoster: EmployeeIdentityRow[],
  notices: string[]
): EmployeeMatchResolution => {
  const possibleSamePerson = findPossibleSamePersonInRoster(input.extractedName, storeRoster);
  return buildStoreDomainSearchResolution(reporterContext, notices, possibleSamePerson);
};

type MatchNameVariantsOptions = {
  typoTolerant?: boolean;
  allowedIdentityIds?: Set<number>;
  roster?: EmployeeIdentityRow[];
};

const filterMatchesToScope = (
  matches: IntelligenceEmployeeMatch[],
  allowedIdentityIds?: Set<number>
): IntelligenceEmployeeMatch[] => {
  if (!allowedIdentityIds || allowedIdentityIds.size === 0) {
    return matches;
  }

  return matches.filter((match) => allowedIdentityIds.has(match.employeeIdentityId));
};

const matchNameVariants = async (
  nameVariants: string[],
  options?: MatchNameVariantsOptions
): Promise<IntelligenceEmployeeMatch[]> => {
  const matches: IntelligenceEmployeeMatch[] = [];
  const fuzzyThreshold = options?.typoTolerant
    ? EXTRACTED_NAME_FUZZY_THRESHOLD
    : INTERCOM_MATCH.FUZZY_SIMILARITY_THRESHOLD;

  for (const name of nameVariants) {
    const byCanonicalRows = await employeeRepository.findAllByCanonicalName(name);
    for (const row of byCanonicalRows) {
      matches.push(toMatchResult(row, 100, EMPLOYEE_MATCH_METHOD.EXACT));
    }

    const byAlias = await employeeRepository.findAliasOwner(name);
    if (byAlias) {
      matches.push({
        employeeIdentityId: byAlias.identity.id,
        canonicalName: byAlias.identity.canonicalName,
        confidenceScore: parseStoredConfidence(byAlias.aliasRow.confidenceScore),
        matchMethod: EMPLOYEE_MATCH_METHOD.ALIAS
      });
    }

    const fuzzyCanonical = await employeeRepository.findFuzzyByCanonicalName(name, fuzzyThreshold);
    for (const row of fuzzyCanonical) {
      matches.push({
        employeeIdentityId: row.id,
        canonicalName: row.canonicalName,
        confidenceScore: similarityToConfidence(Number(row.similarity)),
        matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
      });
    }

    const fuzzyAlias = await employeeRepository.findFuzzyByAlias(name, fuzzyThreshold);
    for (const row of fuzzyAlias) {
      matches.push({
        employeeIdentityId: row.employeeIdentityId,
        canonicalName: row.canonicalName,
        confidenceScore: similarityToConfidence(Number(row.similarity)),
        matchMethod: EMPLOYEE_MATCH_METHOD.FUZZY
      });
    }

    if (options?.typoTolerant) {
      matches.push(...(await matchExtractedNameAgainstRoster(name, options.roster)));
    }
  }

  return filterMatchesAboveThreshold(
    filterMatchesToScope(dedupeMatchesByIdentity(matches), options?.allowedIdentityIds),
    options?.typoTolerant
      ? NAME_RESOLUTION_CONFIDENCE_THRESHOLD
      : INTERCOM_MATCH.CONFIDENCE_THRESHOLD
  );
};

const longestSharedSubstringLength = (left: string, right: string): number => {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  let longest = 0;

  for (let index = 0; index < a.length; index += 1) {
    for (let end = index + 3; end <= a.length; end += 1) {
      const piece = a.slice(index, end);
      if (piece.length > longest && b.includes(piece)) {
        longest = piece.length;
      }
    }
  }

  return longest;
};

const pickBestExtractedNameMatch = (
  extractedName: string,
  matches: IntelligenceEmployeeMatch[],
  options?: { preferredEmployeeIdentityIds?: number[] }
): IntelligenceEmployeeMatch | undefined => {
  const sorted = dedupeMatchesByIdentity(matches);
  const qualifying = filterMatchesAboveThreshold(
    sorted,
    NAME_RESOLUTION_CONFIDENCE_THRESHOLD
  );

  if (qualifying.length === 0) {
    return undefined;
  }

  const preferredIds = new Set(options?.preferredEmployeeIdentityIds ?? []);
  const normalizedExtracted = normalizeForMatch(extractedName);
  const isSingleToken = !normalizedExtracted.includes(' ');

  const exactCanonical = qualifying.find(
    (match) =>
      normalizeForMatch(match.canonicalName) === normalizedExtracted &&
      match.matchMethod === EMPLOYEE_MATCH_METHOD.EXACT
  );

  if (exactCanonical) {
    if (isSingleToken && qualifying.length > 1) {
      const prefixMatches = qualifying.filter((match) => {
        const canonicalToken = normalizeForMatch(match.canonicalName).split(/\s+/)[0] ?? '';
        return longestSharedSubstringLength(normalizedExtracted, canonicalToken) >= 3;
      });

      if (prefixMatches.length > 0) {
        const established = prefixMatches.reduce((best, current) =>
          current.employeeIdentityId < best.employeeIdentityId ? current : best
        );

        if (established.employeeIdentityId < exactCanonical.employeeIdentityId) {
          return {
            employeeIdentityId: established.employeeIdentityId,
            canonicalName: established.canonicalName,
            confidenceScore: established.confidenceScore,
            matchMethod: established.matchMethod,
            extractedName: established.extractedName,
            nameVariants: established.nameVariants
          };
        }
      }
    }

    return exactCanonical;
  }

  if (isSingleToken && qualifying.length > 1) {
    const prefixMatches = qualifying.filter((match) => {
      const canonicalToken = normalizeForMatch(match.canonicalName).split(/\s+/)[0] ?? '';
      return longestSharedSubstringLength(normalizedExtracted, canonicalToken) >= 3;
    });

    if (prefixMatches.length > 0) {
      const established = prefixMatches.reduce((best, current) =>
        current.employeeIdentityId < best.employeeIdentityId ? current : best
      );

      return {
        employeeIdentityId: established.employeeIdentityId,
        canonicalName: established.canonicalName,
        confidenceScore: established.confidenceScore,
        matchMethod: established.matchMethod,
        extractedName: established.extractedName,
        nameVariants: established.nameVariants
      };
    }
  }

  const ranked = qualifying
    .map((match) => ({
      ...match,
      effectiveScore:
        match.confidenceScore +
        (preferredIds.has(match.employeeIdentityId) ? PREFERRED_IDENTITY_BOOST : 0)
    }))
    .sort((left, right) => {
      if (right.effectiveScore !== left.effectiveScore) {
        return right.effectiveScore - left.effectiveScore;
      }

      return left.employeeIdentityId - right.employeeIdentityId;
    });

  const winner = ranked[0];
  return {
    employeeIdentityId: winner.employeeIdentityId,
    canonicalName: winner.canonicalName,
    confidenceScore: winner.confidenceScore,
    matchMethod: winner.matchMethod,
    extractedName: winner.extractedName,
    nameVariants: winner.nameVariants
  };
};

const attachExtractedNameToMatches = (
  extractedName: string,
  matches: IntelligenceEmployeeMatch[]
): IntelligenceEmployeeMatch[] => {
  const normalizedExtracted = normalizeForMatch(extractedName);

  return matches.map((match) => ({
    ...match,
    extractedName:
      normalizeForMatch(match.canonicalName) !== normalizedExtracted
        ? extractedName
        : match.extractedName
  }));
};

const findExistingIdentity = async (
  input: EmployeeMatchInput
): Promise<IntelligenceEmployeeMatch | null> => {
  if (input.intercomContactId) {
    const byContact = await employeeRepository.findByIntercomContactId(input.intercomContactId);
    if (byContact) {
      return toMatchResult(byContact, 100, EMPLOYEE_MATCH_METHOD.EXACT);
    }
  }

  if (input.contactEmail) {
    const byEmail = await employeeRepository.findByEmail(input.contactEmail);
    if (byEmail) {
      return toMatchResult(byEmail, 100, EMPLOYEE_MATCH_METHOD.EXACT);
    }
  }

  return null;
};

const createIdentityFromContact = async (
  input: EmployeeMatchInput
): Promise<IntelligenceEmployeeMatch | null> => {
  const existing = await findExistingIdentity(input);
  if (existing) {
    await recordContactAliases(existing.employeeIdentityId, input, existing);
    return existing;
  }

  const canonicalName = deriveCanonicalName(input);
  if (!canonicalName) {
    logger.warn('[employee-matching] Cannot create identity — no contact signals', {
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      intercomContactId: input.intercomContactId
    });
    return null;
  }

  try {
    const identity = await employeeRepository.createIdentity({
      canonicalName,
      email: input.contactEmail,
      intercomContactId: input.intercomContactId
    });

    const created = toMatchResult(identity, 100, EMPLOYEE_MATCH_METHOD.EXACT);

    logger.info('[employee-matching] Created employee identity from Intercom contact', {
      employeeIdentityId: identity.id,
      canonicalName: identity.canonicalName,
      email: identity.email,
      intercomContactId: identity.intercomContactId
    });

    await recordContactAliases(identity.id, input, created);
    return created;
  } catch (error) {
    const raced = await findExistingIdentity(input);
    if (raced) {
      await recordContactAliases(raced.employeeIdentityId, input, raced);
      return raced;
    }

    throw error;
  }
};

const backfillMatchedEmployeeScope = async (
  matches: IntelligenceEmployeeMatch[],
  reporterContext: ReturnType<typeof parseReporterContext>,
  searchPath: EmployeeSearchPath
): Promise<void> => {
  const uniqueIds = [...new Set(matches.map((match) => match.employeeIdentityId))];
  const storeNumber =
    searchPath === EMPLOYEE_SEARCH_PATH.STORE ? reporterContext.storeNumber : null;

  await Promise.all(
    uniqueIds.map((employeeIdentityId) =>
      employeeRepository.updateIdentityScopeIfEmpty(employeeIdentityId, {
        storeNumber,
        companyDomain: reporterContext.domain
      })
    )
  );
};

const createIdentityFromExtractedName = async (
  extractedName: string,
  reporterContext: ReturnType<typeof parseReporterContext>
): Promise<IntelligenceEmployeeMatch> => {
  const canonicalName = getCanonicalNameFromContact(extractedName);
  if (!canonicalName) {
    throw new Error('Cannot create identity — invalid extracted name');
  }

  const identity = await employeeRepository.createIdentity({
    canonicalName,
    storeNumber: reporterContext.storeNumber,
    companyDomain: reporterContext.domain
  });
  const created = toMatchResult(identity, 100, EMPLOYEE_MATCH_METHOD.EXACT);

  logger.info('[employee-matching] Created employee identity from extracted name', {
    employeeIdentityId: identity.id,
    canonicalName: identity.canonicalName,
    extractedName,
    storeNumber: identity.storeNumber,
    companyDomain: identity.companyDomain
  });

  await recordNameAliases(identity.id, extractedName, created);
  return created;
};

const finalizeNameMatches = async (
  extractedName: string,
  qualifyingMatches: IntelligenceEmployeeMatch[],
  options?: { preferredEmployeeIdentityIds?: number[] }
): Promise<IntelligenceEmployeeMatch[]> => {
  const bestMatch = pickBestExtractedNameMatch(extractedName, qualifyingMatches, options);

  if (bestMatch) {
    await recordNameAliases(bestMatch.employeeIdentityId, extractedName, bestMatch);
  }

  const attached = attachExtractedNameToMatches(extractedName, qualifyingMatches);
  if (!bestMatch) {
    return attached;
  }

  const bestId = bestMatch.employeeIdentityId;
  const bestIndex = attached.findIndex((match) => match.employeeIdentityId === bestId);
  if (bestIndex <= 0) {
    return attached;
  }

  return [
    attached[bestIndex],
    ...attached.slice(0, bestIndex),
    ...attached.slice(bestIndex + 1)
  ];
};

export const findCompanyDomainDisplayMatches = async (
  input: Pick<EmployeeNameInput, 'extractedName' | 'caseReporterEmail'>,
  domainRoster: EmployeeIdentityRow[],
  excludeIdentityIds: Set<number>
): Promise<IntelligencePossibleSamePerson[]> => {
  if (domainRoster.length === 0) {
    return [];
  }

  const scopedMatches = await matchByNameInScope(
    {
      extractedName: input.extractedName,
      caseReporterEmail: input.caseReporterEmail
    },
    domainRoster
  );

  const strongMatches: IntelligencePossibleSamePerson[] = [];
  for (const match of scopedMatches) {
    if (excludeIdentityIds.has(match.employeeIdentityId)) {
      continue;
    }

    const scored = scorePossibleSamePersonCandidate(input.extractedName, match.canonicalName);
    strongMatches.push({
      employeeIdentityId: match.employeeIdentityId,
      canonicalName: match.canonicalName,
      confidenceScore: match.confidenceScore,
      matchMethod: match.matchMethod,
      sharedTokens: scored?.sharedTokens ?? []
    });
  }

  const strongIds = new Set(strongMatches.map((match) => match.employeeIdentityId));
  const hintMatches = findPossibleSamePersonInRoster(input.extractedName, domainRoster).filter(
    (hint) =>
      !excludeIdentityIds.has(hint.employeeIdentityId) && !strongIds.has(hint.employeeIdentityId)
  );

  return [...strongMatches, ...hintMatches]
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT);
};

const matchByNameInScope = async (
  input: EmployeeNameInput,
  roster: EmployeeIdentityRow[]
): Promise<IntelligenceEmployeeMatch[]> => {
  const allowedIdentityIds = new Set(roster.map((identity) => identity.id));
  const nameVariants = getNameMatchVariants(input.extractedName);

  let results = await matchNameVariants(nameVariants, {
    typoTolerant: true,
    allowedIdentityIds,
    roster
  });

  const identityIds = [...new Set(results.map((match) => match.employeeIdentityId))];
  const reporterEmailHistory =
    await employeeRepository.findReporterEmailHistoryByIdentityIds(identityIds);
  results = filterMatchesByReporterDomain(
    results,
    input.caseReporterEmail,
    reporterEmailHistory
  );

  return filterRejectedNameMatches(
    input.extractedName,
    filterMatchesAboveThreshold(
      dedupeMatchesByIdentity(results),
      NAME_RESOLUTION_CONFIDENCE_THRESHOLD
    )
  );
};

export const employeeMatchingService = {
  async match(input: EmployeeMatchInput): Promise<IntelligenceEmployeeMatch[]> {
    const matches: IntelligenceEmployeeMatch[] = [];
    const nameVariants = getNameMatchVariants(input.contactName);

    logger.info('[employee-matching] Starting match', {
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      nameVariants
    });

    if (input.intercomContactId) {
      const byContact = await employeeRepository.findByIntercomContactId(input.intercomContactId);
      if (byContact) {
        matches.push(toMatchResult(byContact, 100, EMPLOYEE_MATCH_METHOD.EXACT));
      }
    }

    if (input.contactEmail) {
      const byEmail = await employeeRepository.findByEmail(input.contactEmail);
      if (byEmail) {
        matches.push(toMatchResult(byEmail, 100, EMPLOYEE_MATCH_METHOD.EXACT));
      }
    }

    matches.push(...(await matchNameVariants(nameVariants)));

    const results = filterMatchesAboveThreshold(dedupeMatchesByIdentity(matches));

    logger.info('[employee-matching] Match complete', {
      matchCount: results.length,
      topMatch: results[0] ?? null
    });

    return results;
  },

  /**
   * Match against existing identities, learn aliases for new spellings,
   * or create a new identity from Intercom contact when no match exists.
   */
  async resolve(input: EmployeeMatchInput): Promise<IntelligenceEmployeeMatch[]> {
    const matches = await this.match(input);

    if (matches.length > 0) {
      const bestMatch = matches[0];
      await recordContactAliases(bestMatch.employeeIdentityId, input, bestMatch);
      return matches;
    }

    const created = await createIdentityFromContact(input);
    return created ? [created] : [];
  },

  async matchByName(input: EmployeeNameInput): Promise<IntelligenceEmployeeMatch[]> {
    const nameVariants = getNameMatchVariants(input.extractedName);

    logger.info('[employee-matching] Starting name match', {
      extractedName: input.extractedName,
      nameVariants,
      caseReporterEmail: input.caseReporterEmail ?? null
    });

    // Global name match — no store/domain roster gate and no reporter-domain filter.
    const results = await matchNameVariants(nameVariants, { typoTolerant: true });

    logger.info('[employee-matching] Name match complete', {
      extractedName: input.extractedName,
      matchCount: results.length,
      topMatch: results[0] ?? null
    });

    return results;
  },

  /**
   * Match extracted employee name against existing directory identities.
   * If the name is valid and nobody matches, create a new identity (same as live case processing).
   */
  async resolveByName(input: EmployeeNameInput): Promise<EmployeeMatchResolution> {
    const reporterContext = parseReporterContext(input.caseReporterName, input.caseReporterEmail);
    const notices: string[] = [];

    logger.info('[employee-matching] Starting global name resolve', {
      extractedName: input.extractedName,
      caseReporterName: input.caseReporterName ?? null,
      caseReporterEmail: input.caseReporterEmail ?? null
    });

    const fullMatches = filterRejectedNameMatches(
      input.extractedName,
      await this.matchByName(input)
    );
    const qualifyingMatches = collapseTypoDuplicateMatches(
      input.extractedName,
      filterMatchesAboveThreshold(
        dedupeMatchesByIdentity(fullMatches),
        NAME_RESOLUTION_CONFIDENCE_THRESHOLD
      )
    );

    const exactCanonical = qualifyingMatches.filter(
      (match) =>
        match.matchMethod === EMPLOYEE_MATCH_METHOD.EXACT &&
        normalizeForMatch(match.canonicalName) === normalizeForMatch(input.extractedName)
    );

    if (exactCanonical.length === 1) {
      const exactTokens = tokenizeOrderedContactName(exactCanonical[0]?.canonicalName ?? '').length;
      const fullerMatches = qualifyingMatches.filter(
        (match) => tokenizeOrderedContactName(match.canonicalName).length > exactTokens
      );
      if (exactTokens > 1 || fullerMatches.length === 0) {
        const matches = await finalizeNameMatches(input.extractedName, exactCanonical, {
          preferredEmployeeIdentityIds: input.preferredEmployeeIdentityIds
        });
        await backfillMatchedEmployeeScope(
          matches,
          reporterContext,
          EMPLOYEE_SEARCH_PATH.NAME
        );
        return {
          matches,
          searchPath: EMPLOYEE_SEARCH_PATH.NAME,
          notices,
          mentionStatus: 'resolved'
        };
      }
    }

    if (qualifyingMatches.length > 1) {
      notices.push(EMPLOYEE_SEARCH_NOTICE.UNRESOLVED_EMPLOYEE);
      return {
        matches: [],
        searchPath: EMPLOYEE_SEARCH_PATH.NAME,
        notices,
        mentionStatus: 'ambiguous',
        possibleSamePerson: qualifyingMatches.map((match) => ({
          employeeIdentityId: match.employeeIdentityId,
          canonicalName: match.canonicalName,
          confidenceScore: match.confidenceScore,
          matchMethod: match.matchMethod,
          sharedTokens: getNameMatchVariants(input.extractedName)
        }))
      };
    }

    if (qualifyingMatches.length > 0) {
      const matches = await finalizeNameMatches(input.extractedName, qualifyingMatches, {
        preferredEmployeeIdentityIds: input.preferredEmployeeIdentityIds
      });
      await backfillMatchedEmployeeScope(
        matches,
        reporterContext,
        EMPLOYEE_SEARCH_PATH.NAME
      );
      return {
        matches,
        searchPath: EMPLOYEE_SEARCH_PATH.NAME,
        notices,
        mentionStatus: 'resolved'
      };
    }

    const canonicalName = getCanonicalNameFromContact(input.extractedName);
    if (!canonicalName) {
      return {
        matches: [],
        searchPath: EMPLOYEE_SEARCH_PATH.NAME,
        notices,
        mentionStatus: 'no_employee_mentioned'
      };
    }

    const duplicateNotices = await findPossibleDuplicateNotices(input.extractedName);
    const created = await createIdentityFromExtractedName(input.extractedName, reporterContext);
    notices.push(EMPLOYEE_SEARCH_NOTICE.CREATED_NEW_EMPLOYEE);
    notices.push(...duplicateNotices);

    return {
      matches: attachExtractedNameToMatches(input.extractedName, [created]),
      searchPath: EMPLOYEE_SEARCH_PATH.CREATED,
      notices,
      mentionStatus: 'resolved'
    };
  },

  async createFromOperatorAction(input: {
    extractedName: string;
    operatorId: string;
    caseReporterName?: string | null;
    caseReporterEmail?: string | null;
  }): Promise<IntelligenceEmployeeMatch> {
    const reporterContext = parseReporterContext(input.caseReporterName, input.caseReporterEmail);
    logger.info('[employee-matching] Operator creating employee identity', {
      operatorId: input.operatorId,
      extractedName: input.extractedName
    });
    return createIdentityFromExtractedName(input.extractedName, reporterContext);
  }
};
