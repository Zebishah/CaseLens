import { tokenizeOrderedContactName } from '../employee/employee.name.util.js';
import {
  extractEmployeeNamesFromSubject,
  sanitizeExtractedEmployeeName
} from '../employee/employee.subject-name.util.js';
import { tokensAreTypoVariants } from '../employee/employee.token-match.util.js';
import {
  collectRelatedCaseSearchTerms,
  textContainsNamePartsAsWholeWords,
  type RelatedCaseNameBag
} from './related-case-name-match.util.js';

const FUZZY_RELATED_LAST_MIN_SIMILARITY = 0.48;
const FUZZY_RELATED_MIN_SCORE = 50;

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

const lastToken = (tokens: string[]): string | undefined =>
  tokens.length > 0 ? tokens[tokens.length - 1] : undefined;

const tokensAreFuzzyRelatedLastNameVariants = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }

  if (tokensAreTypoVariants(left, right, 'last')) {
    return true;
  }

  const shorter = Math.min(left.length, right.length);
  return shorter >= 3 && tokenSimilarity(left, right) >= FUZZY_RELATED_LAST_MIN_SIMILARITY;
};

export type FuzzyRelatedCaseMatch = {
  score: number;
  sharedTokens: string[];
  sourceName: string;
  matchedName: string;
};

export const scoreFuzzyRelatedCaseNameMatch = (
  sourceName: string,
  candidateName: string
): FuzzyRelatedCaseMatch | null => {
  const normalizedSource = sanitizeExtractedEmployeeName(sourceName);
  const normalizedCandidate = sanitizeExtractedEmployeeName(candidateName);

  if (!normalizedSource || !normalizedCandidate) {
    return null;
  }

  if (normalizedSource.toLowerCase() === normalizedCandidate.toLowerCase()) {
    return null;
  }

  const sourceOrdered = tokenizeOrderedContactName(normalizedSource);
  const candidateOrdered = tokenizeOrderedContactName(normalizedCandidate);

  if (sourceOrdered.length === 0 || candidateOrdered.length === 0) {
    return null;
  }

  if (sourceOrdered.length >= 2 && candidateOrdered.length >= 2) {
    const sourceFirst = sourceOrdered[0];
    const candidateFirst = candidateOrdered[0];
    const sourceLast = lastToken(sourceOrdered);
    const candidateLast = lastToken(candidateOrdered);

    if (!sourceFirst || !candidateFirst || !sourceLast || !candidateLast) {
      return null;
    }

    if (!tokensAreTypoVariants(sourceFirst, candidateFirst, 'first')) {
      return null;
    }

    if (!tokensAreFuzzyRelatedLastNameVariants(sourceLast, candidateLast)) {
      return null;
    }

    const score = Math.min(
      99,
      Math.round(
        ((tokenSimilarity(sourceFirst, candidateFirst) +
          tokenSimilarity(sourceLast, candidateLast)) /
          2) *
          100
      )
    );

    if (score < FUZZY_RELATED_MIN_SCORE) {
      return null;
    }

    return {
      score,
      sharedTokens: [
        sourceFirst === candidateFirst ? sourceFirst : `${sourceFirst}~${candidateFirst}`,
        sourceLast === candidateLast ? sourceLast : `${sourceLast}~${candidateLast}`
      ],
      sourceName: normalizedSource,
      matchedName: normalizedCandidate
    };
  }

  if (sourceOrdered.length === 1) {
    return scoreOneWordAgainstTokens(
      sourceOrdered[0]!,
      candidateOrdered,
      normalizedSource,
      normalizedCandidate
    );
  }

  if (candidateOrdered.length === 1) {
    return scoreOneWordAgainstTokens(
      candidateOrdered[0]!,
      sourceOrdered,
      normalizedSource,
      normalizedCandidate
    );
  }

  return null;
};

const tokensAreFuzzyRelatedNameVariants = (left: string, right: string): boolean =>
  tokensAreTypoVariants(left, right, 'first') || tokensAreFuzzyRelatedLastNameVariants(left, right);

const scoreOneWordAgainstTokens = (
  sourceToken: string,
  candidateTokens: string[],
  sourceName: string,
  candidateName: string
): FuzzyRelatedCaseMatch | null => {
  let best: FuzzyRelatedCaseMatch | null = null;

  for (const candidateToken of candidateTokens) {
    if (!tokensAreFuzzyRelatedNameVariants(sourceToken, candidateToken)) {
      continue;
    }

    const score = Math.min(99, Math.round(tokenSimilarity(sourceToken, candidateToken) * 100));
    if (score < FUZZY_RELATED_MIN_SCORE) {
      continue;
    }

    const match: FuzzyRelatedCaseMatch = {
      score,
      sharedTokens: [
        sourceToken === candidateToken ? sourceToken : `${sourceToken}~${candidateToken}`
      ],
      sourceName,
      matchedName: candidateName
    };

    if (!best || match.score > best.score) {
      best = match;
    }
  }

  return best;
};

const collectCandidateNames = (
  subject: string | null | undefined,
  extractedNames?: string[] | null
): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];

  const addName = (raw: string | null | undefined): void => {
    const sanitized = sanitizeExtractedEmployeeName(raw ?? '');
    if (!sanitized) {
      return;
    }

    const key = sanitized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    names.push(sanitized);
  };

  for (const name of extractEmployeeNamesFromSubject(subject)) {
    addName(name);
  }

  for (const name of extractedNames ?? []) {
    addName(name);
  }

  return names;
};

export const findBestFuzzyRelatedCaseMatch = (input: {
  sourceNames: string[];
  subject?: string | null;
  extractedNames?: string[] | null;
}): FuzzyRelatedCaseMatch | null => {
  const sourceNames = [...new Set(input.sourceNames.map((name) => name.trim()).filter(Boolean))];
  if (sourceNames.length === 0) {
    return null;
  }

  const candidateNames = collectCandidateNames(input.subject, input.extractedNames);
  if (candidateNames.length === 0) {
    return null;
  }

  let best: FuzzyRelatedCaseMatch | null = null;

  for (const sourceName of sourceNames) {
    for (const candidateName of candidateNames) {
      const match = scoreFuzzyRelatedCaseNameMatch(sourceName, candidateName);
      if (!match) {
        continue;
      }

      if (!best || match.score > best.score) {
        best = match;
      }
    }
  }

  return best;
};

export const subjectMatchesExactRelatedCaseTerms = (
  subject: string | null | undefined,
  searchTerms: string[],
  nameBag: RelatedCaseNameBag
): boolean => {
  const trimmedSubject = subject?.trim() ?? '';
  if (!trimmedSubject) {
    return false;
  }

  for (const term of collectRelatedCaseSearchTerms(nameBag)) {
    if (textContainsNamePartsAsWholeWords(trimmedSubject, term)) {
      return true;
    }
  }

  for (const term of searchTerms.map((value) => value.trim()).filter((value) => value.length >= 3)) {
    if (textContainsNamePartsAsWholeWords(trimmedSubject, term)) {
      return true;
    }
  }

  return false;
};
