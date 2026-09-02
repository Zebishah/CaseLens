import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';

/** Normalize a name for case-insensitive comparison. */
export const normalizeForMatch = (value: string): string => value.trim().toLowerCase();

const TOKEN_STOP_WORDS = new Set(['from', 'the', 'and', 'von', 'van', 'de', 'del', 'la', 'le']);

/** Ordered name tokens (first → last) for surname/given-name compatibility checks. */
export const tokenizeOrderedContactName = (contactName: string | null | undefined): string[] => {
  const variants = getNameMatchVariants(contactName);
  const canonical = variants.length > 1 ? variants[variants.length - 1] : variants[0];
  if (!canonical) {
    return [];
  }

  return canonical
    .split(/\s+/)
    .map((part) => normalizeForMatch(part).replace(/[^a-z0-9]/g, ''))
    .filter(
      (token) => token.length >= INTERCOM_MATCH.TOKEN_MIN_LENGTH && !TOKEN_STOP_WORDS.has(token)
    );
};

/** Split a contact name into comparable tokens (strips company suffix first). */
export const tokenizeContactName = (contactName: string | null | undefined): string[] => {
  const tokens = new Set<string>();

  for (const variant of getNameMatchVariants(contactName)) {
    for (const part of variant.split(/\s+/)) {
      const token = normalizeForMatch(part).replace(/[^a-z0-9]/g, '');
      if (
        token.length >= INTERCOM_MATCH.TOKEN_MIN_LENGTH &&
        !TOKEN_STOP_WORDS.has(token)
      ) {
        tokens.add(token);
      }
    }
  }

  return [...tokens];
};

/**
 * Intercom often appends company to display names, e.g. "Jon Fritz from Acme".
 * Returns both the full name and a stripped variant for matching attempts.
 */
export const getNameMatchVariants = (contactName: string | null | undefined): string[] => {
  if (!contactName?.trim()) {
    return [];
  }

  const trimmed = contactName.trim();
  const fromIndex = trimmed.toLowerCase().lastIndexOf(' from ');

  if (fromIndex > 0) {
    const stripped = trimmed.slice(0, fromIndex).trim();
    return stripped.length > 0 && stripped !== trimmed ? [trimmed, stripped] : [trimmed];
  }

  return [trimmed];
};

/** Prefer person name without Intercom company suffix for canonical identity. */
export const getCanonicalNameFromContact = (
  contactName: string | null | undefined
): string | null => {
  const variants = getNameMatchVariants(contactName);
  if (variants.length === 0) {
    return null;
  }

  return variants.length > 1 ? variants[variants.length - 1] : variants[0];
};
