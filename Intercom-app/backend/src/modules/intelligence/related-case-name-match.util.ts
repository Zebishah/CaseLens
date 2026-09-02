import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { getNameMatchVariants, tokenizeContactName } from '../employee/employee.name.util.js';

const MIN_TERM_LENGTH = INTERCOM_MATCH.TOKEN_MIN_LENGTH;

export type RelatedCaseNameBag = {
  fullNames: string[];
  tokens: string[];
};

export const buildRelatedCaseNameBag = (names: Iterable<string>): RelatedCaseNameBag => {
  const fullNames = new Set<string>();
  const tokens = new Set<string>();

  for (const raw of names) {
    for (const variant of getNameMatchVariants(raw)) {
      const trimmed = variant.trim();
      if (trimmed.length >= MIN_TERM_LENGTH) {
        fullNames.add(trimmed);
      }

      for (const token of tokenizeContactName(variant)) {
        tokens.add(token);
      }
    }
  }

  return {
    fullNames: [...fullNames],
    tokens: [...tokens]
  };
};

export const collectRelatedCaseSearchTerms = (nameBag: RelatedCaseNameBag): string[] => {
  const terms = new Set<string>();

  for (const name of nameBag.fullNames) {
    if (name.length >= MIN_TERM_LENGTH) {
      terms.add(name);
    }
  }

  for (const token of nameBag.tokens) {
    terms.add(token);
  }

  return [...terms];
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** POSIX regex for PostgreSQL ~* — whole word only (not Daniella/Isabella/Arellano for "ella"). */
export const buildWholeWordRegexPattern = (word: string): string => {
  const escaped = escapeRegex(word.trim());
  return `(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`;
};

export const splitRelatedCaseSearchWords = (term: string): string[] => {
  const trimmed = term.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed.split(/\s+/).filter((part) => part.length >= MIN_TERM_LENGTH);
};

export const textContainsNameTerm = (
  text: string,
  term: string,
  options?: { tokenMatch?: boolean }
): boolean => {
  const normalizedText = text.trim();
  const normalizedTerm = term.trim();
  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  if (options?.tokenMatch || normalizedTerm.includes(' ')) {
    return textContainsNamePartsAsWholeWords(normalizedText, normalizedTerm);
  }

  return normalizedText.toLowerCase().includes(normalizedTerm.toLowerCase());
};

/** Every word in term must appear as a full word in text (first, last, or full name). */
export const textContainsNamePartsAsWholeWords = (text: string, term: string): boolean => {
  const words = splitRelatedCaseSearchWords(term);
  if (words.length === 0) {
    return false;
  }

  return words.every((word) => {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(word)}(?:[^a-z0-9]|$)`, 'i');
    return pattern.test(text.trim());
  });
};

export const findMentionedEmployeeNamesInConversation = (input: {
  subject?: string | null;
  extractedNames?: string[] | null;
  linkedExtractedName?: string | null;
  nameBag: RelatedCaseNameBag;
}): string[] => {
  const mentioned = new Set<string>();
  const texts = [
    input.subject?.trim() ?? '',
    ...(input.extractedNames ?? []).map((name) => name.trim()),
    input.linkedExtractedName?.trim() ?? ''
  ].filter((text) => text.length > 0);

  if (texts.length === 0) {
    return [];
  }

  if (input.linkedExtractedName?.trim()) {
    mentioned.add(input.linkedExtractedName.trim());
  }

  for (const fullName of input.nameBag.fullNames) {
    for (const text of texts) {
      if (textContainsNamePartsAsWholeWords(text, fullName)) {
        mentioned.add(fullName);
      }
    }
  }

  for (const token of input.nameBag.tokens) {
    for (const text of texts) {
      if (!textContainsNameTerm(text, token, { tokenMatch: true })) {
        continue;
      }

      const matchingFullName = input.nameBag.fullNames.find((fullName) =>
        fullName.toLowerCase().includes(token)
      );
      mentioned.add(matchingFullName ?? token);
    }
  }

  return [...mentioned];
};
