import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { tokenizeContactName, tokenizeOrderedContactName } from './employee.name.util.js';

export type TokenMatchScore = {
  confidenceScore: number;
  sharedTokens: string[];
};

const FIRST_NAME_TYPO_MIN_SIMILARITY = 0.45;
const FIRST_NAME_TYPO_MIN_PREFIX = 3;
const LAST_NAME_TYPO_MIN_SIMILARITY = 0.68;
const LAST_NAME_PREFIX_TYPO_MIN_SIMILARITY = 0.64;
const LAST_NAME_PREFIX_MAX_LENGTH_DELTA = 2;
const POSSIBLE_DUPLICATE_MIN_LAST_SIMILARITY = 0.55;
const LAST_NAME_TYPO_MIN_PREFIX = 4;
const SINGLE_CANONICAL_MIN_SIMILARITY = 0.72;
const SINGLE_TOKEN_TYPO_MIN_SIMILARITY = 0.6;
const FIRST_NAME_TO_FULL_NAME_MIN_SIMILARITY = 0.75;
const PREFIX_ONLY_MIN_SIMILARITY = 0.58;
const EXACT_FIRST_TO_FULL_NAME_SCORE = 88;
const EXACT_LAST_TO_FULL_NAME_SCORE = 88;

const scoreSharedToken = (token: string): number => (token.length >= 5 ? 22 : 15);

const longestSharedSubstring = (left: string, right: string): number => {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  let longest = 0;

  for (let i = 0; i < a.length; i += 1) {
    for (let j = i + 3; j <= a.length; j += 1) {
      const piece = a.slice(i, j);
      if (piece.length > longest && b.includes(piece)) {
        longest = piece.length;
      }
    }
  }

  return longest;
};

const emailLocalPartBonus = (
  contactEmail: string | null | undefined,
  candidateEmail: string | null | undefined
): number => {
  if (!contactEmail || !candidateEmail) {
    return 0;
  }

  const left = contactEmail.split('@')[0]?.trim().toLowerCase() ?? '';
  const right = candidateEmail.split('@')[0]?.trim().toLowerCase() ?? '';

  if (!left || !right || left === right) {
    return 0;
  }

  const sharedLength = longestSharedSubstring(left, right);
  if (sharedLength >= 6) {
    return 18;
  }

  if (sharedLength >= 4) {
    return 10;
  }

  return 0;
};

const lastToken = (tokens: string[]): string | undefined =>
  tokens.length > 0 ? tokens[tokens.length - 1] : undefined;

const levenshteinDistance = (left: string, right: string): number => {
  const a = left.toLowerCase();
  const b = right.toLowerCase();

  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let row = 0; row <= a.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col <= b.length; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const tokenSimilarity = (left: string, right: string): number => {
  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
};

const isNicknamePrefix = (left: string, right: string): boolean => {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 3 && longer.startsWith(shorter);
};

/** First name on a full roster name must be exact or a strong typo (blocks ahsan → hassan). */
const firstNameCompatibleWithFullRosterName = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  return tokenSimilarity(left, right) >= FIRST_NAME_TO_FULL_NAME_MIN_SIMILARITY;
};

/** Stricter gate for matching one single-token identity to another (e.g. zebi vs zubair). */
const isStrictSingleCanonicalMatch = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  const similarity = tokenSimilarity(left, right);
  if (similarity >= SINGLE_CANONICAL_MIN_SIMILARITY) {
    return true;
  }

  if (isNicknamePrefix(left, right) && similarity >= PREFIX_ONLY_MIN_SIMILARITY) {
    return true;
  }

  const sharedPrefixLength = longestSharedSubstring(left, right);
  if (sharedPrefixLength >= 4 && similarity >= PREFIX_ONLY_MIN_SIMILARITY) {
    return true;
  }

  return (
    similarity >= SINGLE_TOKEN_TYPO_MIN_SIMILARITY &&
    sharedPrefixLength >= 3 &&
    Math.abs(left.length - right.length) <= 2
  );
};

/** Whether two name tokens are likely the same person with a spelling difference. */
export const tokensAreTypoVariants = (
  left: string,
  right: string,
  kind: 'first' | 'last' = 'first'
): boolean => {
  if (left === right) {
    return true;
  }

  const minSimilarity = kind === 'last' ? LAST_NAME_TYPO_MIN_SIMILARITY : FIRST_NAME_TYPO_MIN_SIMILARITY;
  const minPrefix = kind === 'last' ? LAST_NAME_TYPO_MIN_PREFIX : FIRST_NAME_TYPO_MIN_PREFIX;
  const similarity = tokenSimilarity(left, right);

  if (similarity >= minSimilarity) {
    return true;
  }

  if (kind === 'first' && isNicknamePrefix(left, right)) {
    return true;
  }

  const sharedPrefixLength = longestSharedSubstring(left, right);

  if (
    kind === 'last' &&
    sharedPrefixLength >= minPrefix &&
    Math.abs(left.length - right.length) <= LAST_NAME_PREFIX_MAX_LENGTH_DELTA &&
    similarity >= LAST_NAME_PREFIX_TYPO_MIN_SIMILARITY
  ) {
    return true;
  }

  const prefixSimilarityFloor =
    kind === 'last' ? LAST_NAME_TYPO_MIN_SIMILARITY : PREFIX_ONLY_MIN_SIMILARITY;

  return sharedPrefixLength >= minPrefix && similarity >= prefixSimilarityFloor;
};

const extractedFirstNameMatchesCandidate = (
  token: string,
  candidateOrdered: string[]
): boolean => {
  if (candidateOrdered.length === 0) {
    return false;
  }

  const candidateFirst = candidateOrdered[0];
  if (!candidateFirst) {
    return false;
  }

  if (candidateOrdered.length === 1) {
    return isStrictSingleCanonicalMatch(token, candidateFirst);
  }

  return firstNameCompatibleWithFullRosterName(token, candidateFirst);
};

const STORE_NICKNAME_LAST_MAX_LENGTH = 5;
const STORE_SAME_FIRST_NICKNAME_SCORE = 68;

/**
 * Same first name with short different lasts at one store (e.g. Cooper Joe / Cooper Salt).
 * Store-scoped only — avoids cross-linking unrelated same-first-name pairs with long surnames.
 */
export const scoreStoreSameFirstNicknameMatch = (
  extractedName: string,
  candidateName: string
): TokenMatchScore | null => {
  const extractedOrdered = tokenizeOrderedContactName(extractedName);
  const candidateOrdered = tokenizeOrderedContactName(candidateName);

  if (extractedOrdered.length < 2 || candidateOrdered.length < 2) {
    return null;
  }

  const extractedFirst = extractedOrdered[0];
  const candidateFirst = candidateOrdered[0];
  const extractedLast = extractedOrdered[extractedOrdered.length - 1];
  const candidateLast = candidateOrdered[candidateOrdered.length - 1];

  if (!extractedFirst || !candidateFirst || !extractedLast || !candidateLast) {
    return null;
  }

  const firstNamesMatch = extractedFirst === candidateFirst;

  if (!firstNamesMatch || extractedLast === candidateLast) {
    return null;
  }

  if (
    extractedLast.length > STORE_NICKNAME_LAST_MAX_LENGTH ||
    candidateLast.length > STORE_NICKNAME_LAST_MAX_LENGTH
  ) {
    return null;
  }

  return {
    confidenceScore: STORE_SAME_FIRST_NICKNAME_SCORE,
    sharedTokens: [extractedFirst]
  };
};

/**
 * Extract raw name parts that were too short for token matching but could be initials.
 * e.g. "M Sloan" → rawParts ["m","sloan"], tokens ["sloan"] → filteredInitials ["m"]
 */
const getFilteredInitials = (rawName: string, tokens: string[]): string[] => {
  const rawParts = rawName
    .trim()
    .split(/\s+/)
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((part) => part.length > 0 && part.length < INTERCOM_MATCH.TOKEN_MIN_LENGTH);

  const tokenSet = new Set(tokens);
  return rawParts.filter((part) => !tokenSet.has(part));
};

/** True when a short initial matches the start of a candidate name token. */
const initialMatchesCandidateToken = (initial: string, candidateToken: string): boolean =>
  candidateToken.startsWith(initial);

/** Reject roster matches where first/last names clearly refer to different people. */
export const shouldRejectExtractedNameMatch = (
  extractedName: string,
  candidateName: string
): boolean => {
  const extractedOrdered = tokenizeOrderedContactName(extractedName);
  const candidateOrdered = tokenizeOrderedContactName(candidateName);

  if (extractedOrdered.length === 1) {
    const token = extractedOrdered[0];
    if (!token) {
      return true;
    }

    if (candidateOrdered.length === 1) {
      return !isStrictSingleCanonicalMatch(token, candidateOrdered[0]);
    }

    if (candidateOrdered.length >= 2) {
      const candidateFirst = candidateOrdered[0];
      const candidateLast = candidateOrdered[candidateOrdered.length - 1];

      if (
        candidateFirst &&
        candidateLast &&
        (token === candidateLast || tokensAreTypoVariants(token, candidateLast, 'last')) &&
        !tokensAreTypoVariants(token, candidateFirst, 'first')
      ) {
        return false;
      }
    }

    return !extractedFirstNameMatchesCandidate(token, candidateOrdered);
  }

  if (extractedOrdered.length < 2 || candidateOrdered.length < 2) {
    return false;
  }

  const extractedFirst = extractedOrdered[0];
  const candidateFirst = candidateOrdered[0];
  const extractedLast = extractedOrdered[extractedOrdered.length - 1];
  const candidateLast = candidateOrdered[candidateOrdered.length - 1];

  if (
    !extractedFirst ||
    !candidateFirst ||
    !extractedLast ||
    !candidateLast ||
    !tokensAreTypoVariants(extractedLast, candidateLast, 'last')
  ) {
    return true;
  }

  if (!tokensAreTypoVariants(extractedFirst, candidateFirst, 'first')) {
    return true;
  }

  return false;
};

/** True when every comparable name token matched exactly (not just the surname). */
const isFullExactTokenMatch = (
  extractedName: string,
  candidateName: string,
  sharedTokens: string[]
): boolean => {
  const extractedTokens = tokenizeContactName(extractedName);
  const candidateTokens = tokenizeContactName(candidateName);

  if (extractedTokens.length === 0 || candidateTokens.length === 0) {
    return false;
  }

  if (extractedTokens.length === 1 && candidateTokens.length >= 2) {
    const extractedToken = extractedTokens[0];
    const candidateFirst = candidateTokens[0];
    const candidateLast = lastToken(candidateTokens);
    return Boolean(
      extractedToken &&
        ((candidateFirst && extractedToken === candidateFirst) ||
          (candidateLast && extractedToken === candidateLast)) &&
        sharedTokens.includes(extractedToken)
    );
  }

  if (extractedTokens.length === 1 || candidateTokens.length === 1) {
    return sharedTokens.length >= 1;
  }

  const extractedFirst = extractedTokens[0];
  const candidateFirst = candidateTokens[0];
  const extractedLast = lastToken(extractedTokens);
  const candidateLast = lastToken(candidateTokens);

  return Boolean(
    extractedFirst &&
      candidateFirst &&
      extractedLast &&
      candidateLast &&
      sharedTokens.includes(extractedFirst) &&
      sharedTokens.includes(extractedLast)
  );
};

const scoreSameSurnameFirstNameTypo = (
  extractedFirst: string,
  candidateFirst: string,
  sharedLast: string
): TokenMatchScore | null => {
  const firstSimilarity = tokenSimilarity(extractedFirst, candidateFirst);
  const sharedPrefixLength = longestSharedSubstring(extractedFirst, candidateFirst);

  if (!tokensAreTypoVariants(extractedFirst, candidateFirst, 'first')) {
    return null;
  }

  let confidenceScore = 52 + Math.round(firstSimilarity * 40);

  if (sharedPrefixLength >= FIRST_NAME_TYPO_MIN_PREFIX) {
    confidenceScore += Math.min(10, sharedPrefixLength * 2);
  }

  confidenceScore = Math.min(99, confidenceScore);

  if (confidenceScore < INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE) {
    return null;
  }

  return {
    confidenceScore,
    sharedTokens: [
      extractedFirst === candidateFirst ? extractedFirst : `${extractedFirst}~${candidateFirst}`,
      sharedLast
    ]
  };
};

const scoreExtractedFirstNameToFullName = (
  extractedToken: string,
  candidateFirst: string,
  candidateLast: string
): TokenMatchScore | null => {
  if (!firstNameCompatibleWithFullRosterName(extractedToken, candidateFirst)) {
    return null;
  }

  if (extractedToken === candidateFirst) {
    return {
      confidenceScore: EXACT_FIRST_TO_FULL_NAME_SCORE,
      sharedTokens: [extractedToken, candidateLast]
    };
  }

  const firstSimilarity = tokenSimilarity(extractedToken, candidateFirst);
  const sharedPrefixLength = longestSharedSubstring(extractedToken, candidateFirst);
  let confidenceScore = 52 + Math.round(firstSimilarity * 40);

  if (sharedPrefixLength >= FIRST_NAME_TYPO_MIN_PREFIX) {
    confidenceScore += Math.min(10, sharedPrefixLength * 2);
  }

  confidenceScore = Math.min(99, confidenceScore);

  if (confidenceScore < INTERCOM_MATCH.CONFIDENCE_THRESHOLD) {
    return null;
  }

  return {
    confidenceScore,
    sharedTokens: [`${extractedToken}~${candidateFirst}`, candidateLast]
  };
};

/** Last name on a full roster name must be exact or a strong typo. */
const lastNameCompatibleWithFullRosterName = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  return tokenSimilarity(left, right) >= LAST_NAME_TYPO_MIN_SIMILARITY;
};

/** Symmetric counterpart: extracted last name → full roster name (e.g. "M Sloan" → "Mike Sloan"). */
const scoreExtractedLastNameToFullName = (
  extractedToken: string,
  candidateFirst: string,
  candidateLast: string
): TokenMatchScore | null => {
  if (!lastNameCompatibleWithFullRosterName(extractedToken, candidateLast)) {
    return null;
  }

  if (extractedToken === candidateLast) {
    return {
      confidenceScore: EXACT_LAST_TO_FULL_NAME_SCORE,
      sharedTokens: [candidateFirst, extractedToken]
    };
  }

  const lastSimilarity = tokenSimilarity(extractedToken, candidateLast);
  const sharedPrefixLength = longestSharedSubstring(extractedToken, candidateLast);
  let confidenceScore = 52 + Math.round(lastSimilarity * 40);

  if (sharedPrefixLength >= LAST_NAME_TYPO_MIN_PREFIX) {
    confidenceScore += Math.min(10, sharedPrefixLength * 2);
  }

  confidenceScore = Math.min(99, confidenceScore);

  if (confidenceScore < INTERCOM_MATCH.CONFIDENCE_THRESHOLD) {
    return null;
  }

  return {
    confidenceScore,
    sharedTokens: [candidateFirst, `${extractedToken}~${candidateLast}`]
  };
};

/**
 * Full name → initial + last (e.g. "Mary Fortunata" → "M Fortunada").
 * Requires a candidate initial matching the extracted first name, plus exact/strong last-name typo.
 */
const scoreFullNameToInitialPlusLast = (
  extractedName: string,
  candidateName: string
): TokenMatchScore | null => {
  const extractedOrdered = tokenizeOrderedContactName(extractedName);
  const candidateTokens = tokenizeContactName(candidateName);

  if (extractedOrdered.length < 2 || candidateTokens.length !== 1) {
    return null;
  }

  const extractedFirst = extractedOrdered[0];
  const extractedLast = extractedOrdered[extractedOrdered.length - 1];
  const candidateLast = candidateTokens[0];

  if (!extractedFirst || !extractedLast || !candidateLast) {
    return null;
  }

  const candidateInitials = getFilteredInitials(candidateName, candidateTokens);
  if (
    !candidateInitials.some((initial) => initialMatchesCandidateToken(initial, extractedFirst))
  ) {
    return null;
  }

  return scoreExtractedLastNameToFullName(extractedLast, extractedFirst, candidateLast);
};

/** Scores typo-tolerant matches like "Murabi Nagumo" → "Miyabi Nagumo". */
export const scoreExtractedNameMatch = (
  extractedName: string | null | undefined,
  candidateName: string
): TokenMatchScore | null => {
  const normalizedExtracted = extractedName?.trim();
  if (!normalizedExtracted) {
    return null;
  }

  if (shouldRejectExtractedNameMatch(normalizedExtracted, candidateName)) {
    return null;
  }

  const fullNameToInitialLast = scoreFullNameToInitialPlusLast(
    normalizedExtracted,
    candidateName
  );

  const exactTokenScore = scoreTokenNameMatch(normalizedExtracted, candidateName);
  if (
    exactTokenScore &&
    isFullExactTokenMatch(normalizedExtracted, candidateName, exactTokenScore.sharedTokens)
  ) {
    if (
      fullNameToInitialLast &&
      fullNameToInitialLast.confidenceScore > exactTokenScore.confidenceScore
    ) {
      return fullNameToInitialLast;
    }

    return exactTokenScore;
  }

  const extractedTokens = tokenizeContactName(normalizedExtracted);
  const candidateTokens = tokenizeContactName(candidateName);
  const extractedFirst = extractedTokens[0];
  const candidateFirst = candidateTokens[0];
  const extractedLast = lastToken(extractedTokens);
  const candidateLast = lastToken(candidateTokens);

  if (
    extractedFirst &&
    candidateFirst &&
    extractedLast &&
    candidateLast &&
    extractedTokens.length >= 2 &&
    candidateTokens.length >= 2 &&
    tokensAreTypoVariants(extractedLast, candidateLast, 'last')
  ) {
    return scoreSameSurnameFirstNameTypo(extractedFirst, candidateFirst, extractedLast);
  }

  if (fullNameToInitialLast) {
    return fullNameToInitialLast;
  }

  if (
    extractedTokens.length === 1 &&
    candidateTokens.length >= 2 &&
    extractedFirst &&
    candidateFirst &&
    candidateLast
  ) {
    const firstToFull = scoreExtractedFirstNameToFullName(extractedFirst, candidateFirst, candidateLast);
    if (firstToFull) {
      return firstToFull;
    }

    return scoreExtractedLastNameToFullName(extractedFirst, candidateFirst, candidateLast);
  }

  if (extractedTokens.length === 1 && candidateTokens.length === 1 && extractedFirst && candidateFirst) {
    if (!isStrictSingleCanonicalMatch(extractedFirst, candidateFirst)) {
      return null;
    }

    const similarity = tokenSimilarity(extractedFirst, candidateFirst);
    const confidenceScore = Math.min(
      INTERCOM_MATCH.POSSIBLE_MATCH_MAX_CONFIDENCE,
      extractedFirst === candidateFirst ? 95 : 50 + Math.round(similarity * 45)
    );

    if (confidenceScore < INTERCOM_MATCH.CONFIDENCE_THRESHOLD) {
      return null;
    }

    return {
      confidenceScore,
      sharedTokens: [extractedFirst === candidateFirst ? extractedFirst : `${extractedFirst}~${candidateFirst}`]
    };
  }

  return null;
};

/** Near-miss full-name pairs for info-only duplicate hints when auto-linking did not run. */
export const scorePossibleDuplicateNameMatch = (
  extractedName: string | null | undefined,
  candidateName: string
): TokenMatchScore | null => {
  const normalizedExtracted = extractedName?.trim();
  if (!normalizedExtracted || scoreExtractedNameMatch(normalizedExtracted, candidateName)) {
    return null;
  }

  const extractedOrdered = tokenizeOrderedContactName(normalizedExtracted);
  const candidateOrdered = tokenizeOrderedContactName(candidateName);

  if (extractedOrdered.length < 2 || candidateOrdered.length < 2) {
    return null;
  }

  const extractedFirst = extractedOrdered[0];
  const candidateFirst = candidateOrdered[0];
  const extractedLast = extractedOrdered[extractedOrdered.length - 1];
  const candidateLast = candidateOrdered[candidateOrdered.length - 1];

  if (!extractedFirst || !candidateFirst || !extractedLast || !candidateLast) {
    return null;
  }

  if (!tokensAreTypoVariants(extractedFirst, candidateFirst, 'first')) {
    return null;
  }

  const lastSimilarity = tokenSimilarity(extractedLast, candidateLast);
  if (lastSimilarity < POSSIBLE_DUPLICATE_MIN_LAST_SIMILARITY) {
    return null;
  }

  return {
    confidenceScore: Math.round(lastSimilarity * 100),
    sharedTokens: [
      extractedFirst === candidateFirst ? extractedFirst : `${extractedFirst}~${candidateFirst}`,
      extractedLast === candidateLast ? extractedLast : `${extractedLast}~${candidateLast}`
    ]
  };
};

/** Full name in the report shares a first name with a single-name employee (Mike John → Mike). */
export const scoreSharedFirstNameFullNameHint = (
  extractedName: string,
  candidateName: string
): TokenMatchScore | null => {
  const extractedOrdered = tokenizeOrderedContactName(extractedName);
  const candidateOrdered = tokenizeOrderedContactName(candidateName);

  if (extractedOrdered.length < 2 || candidateOrdered.length !== 1) {
    return null;
  }

  const extractedFirst = extractedOrdered[0];
  const candidateOnly = candidateOrdered[0];
  if (
    !extractedFirst ||
    !candidateOnly ||
    extractedFirst.toLowerCase() !== candidateOnly.toLowerCase()
  ) {
    return null;
  }

  return {
    confidenceScore: 72,
    sharedTokens: [extractedFirst]
  };
};

const SWAPPED_TOKEN_BASE_SCORE = 72;

/** "Jhonson Charles" vs "Charles Johnson" — both tokens present but in reversed order. */
export const scoreSwappedTokenNameMatch = (
  extractedName: string,
  candidateName: string
): TokenMatchScore | null => {
  const extractedOrdered = tokenizeOrderedContactName(extractedName);
  const candidateOrdered = tokenizeOrderedContactName(candidateName);

  if (extractedOrdered.length < 2 || candidateOrdered.length < 2) {
    return null;
  }

  const extractedFirst = extractedOrdered[0];
  const candidateFirst = candidateOrdered[0];
  const extractedLast = extractedOrdered[extractedOrdered.length - 1];
  const candidateLast = candidateOrdered[candidateOrdered.length - 1];

  if (!extractedFirst || !candidateFirst || !extractedLast || !candidateLast) {
    return null;
  }

  const firstMatchesLast = tokensAreTypoVariants(extractedFirst, candidateLast, 'last');
  const lastMatchesFirst = tokensAreTypoVariants(extractedLast, candidateFirst, 'first');

  if (!firstMatchesLast || !lastMatchesFirst) {
    return null;
  }

  const crossSimilarity1 = tokenSimilarity(extractedFirst, candidateLast);
  const crossSimilarity2 = tokenSimilarity(extractedLast, candidateFirst);
  const avgSimilarity = (crossSimilarity1 + crossSimilarity2) / 2;

  const confidenceScore = Math.min(
    INTERCOM_MATCH.POSSIBLE_MATCH_MAX_CONFIDENCE,
    Math.round(SWAPPED_TOKEN_BASE_SCORE + avgSimilarity * 20)
  );

  if (confidenceScore < INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE) {
    return null;
  }

  return {
    confidenceScore,
    sharedTokens: [
      `${extractedFirst}⇄${candidateLast}`,
      `${extractedLast}⇄${candidateFirst}`
    ]
  };
};

/** Best hint score for "possible same person" — uses nickname + first-name rules, not token overlap only. */
export const scorePossibleSamePersonCandidate = (
  extractedName: string,
  candidateName: string,
  contactEmail?: string | null,
  candidateEmail?: string | null
): TokenMatchScore | null => {
  const scored = [
    scoreTokenNameMatch(extractedName, candidateName, contactEmail, candidateEmail),
    scorePossibleDuplicateNameMatch(extractedName, candidateName),
    scoreStoreSameFirstNicknameMatch(extractedName, candidateName),
    scoreSharedFirstNameFullNameHint(extractedName, candidateName),
    scoreExtractedNameMatch(extractedName, candidateName),
    scoreSwappedTokenNameMatch(extractedName, candidateName)
  ]
    .filter((value): value is TokenMatchScore => Boolean(value))
    .sort((left, right) => right.confidenceScore - left.confidenceScore)[0];

  if (!scored || scored.confidenceScore < INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE) {
    return null;
  }

  return scored;
};

export const scoreTokenNameMatch = (
  contactName: string | null | undefined,
  candidateName: string,
  contactEmail?: string | null,
  candidateEmail?: string | null
): TokenMatchScore | null => {
  const contactTokens = tokenizeContactName(contactName);
  const candidateTokens = tokenizeContactName(candidateName);

  if (contactTokens.length === 0 || candidateTokens.length === 0) {
    return null;
  }

  const candidateTokenSet = new Set(candidateTokens);
  const sharedTokens = contactTokens.filter((token) => candidateTokenSet.has(token));

  if (sharedTokens.length === 0) {
    return null;
  }

  if (contactTokens.length === 1 && candidateTokens.length >= 2) {
    const contactToken = contactTokens[0];
    const candidateFirst = candidateTokens[0];
    const candidateLast = lastToken(candidateTokens);
    if (
      contactToken &&
      candidateFirst &&
      candidateLast &&
      sharedTokens.includes(contactToken)
    ) {
      const isFirstNameMatch = contactToken === candidateFirst;
      const isLastNameMatch = contactToken === candidateLast;

      if (isFirstNameMatch || isLastNameMatch) {
        let confidenceScore = isFirstNameMatch
          ? EXACT_FIRST_TO_FULL_NAME_SCORE
          : EXACT_LAST_TO_FULL_NAME_SCORE;
        confidenceScore += emailLocalPartBonus(contactEmail, candidateEmail);
        confidenceScore = Math.min(99, confidenceScore);

        if (confidenceScore < INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE) {
          return null;
        }

        return {
          confidenceScore,
          sharedTokens: isFirstNameMatch
            ? [contactToken, candidateLast]
            : [candidateFirst, contactToken]
        };
      }
    }
  }

  let confidenceScore = 35 + sharedTokens.reduce((sum, token) => sum + scoreSharedToken(token), 0);

  const contactLast = lastToken(contactTokens);
  const candidateLast = lastToken(candidateTokens);
  if (contactLast && candidateLast && contactLast === candidateLast) {
    confidenceScore += 12;
  }

  confidenceScore += emailLocalPartBonus(contactEmail, candidateEmail);

  confidenceScore = Math.min(INTERCOM_MATCH.POSSIBLE_MATCH_MAX_CONFIDENCE, confidenceScore);

  if (confidenceScore < INTERCOM_MATCH.POSSIBLE_MATCH_MIN_CONFIDENCE) {
    return null;
  }

  return {
    confidenceScore,
    sharedTokens
  };
};
