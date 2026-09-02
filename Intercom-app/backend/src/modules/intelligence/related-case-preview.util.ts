import { stripHtmlToText } from '../../utils/html.util.js';

/** Max characters shown under related-case titles in the Canvas sidebar (~4–5 lines). */
export const RELATED_CASE_PREVIEW_MAX_CHARS = 240;

/**
 * Turn a stored Intercom message body into a short plain-text preview
 * for related / category / fuzzy case cards (Phase 1 — opening email snippet).
 */
export const formatRelatedCasePreviewText = (
  messageBody: string | null | undefined,
  maxChars = RELATED_CASE_PREVIEW_MAX_CHARS
): string | null => {
  if (!messageBody?.trim()) {
    return null;
  }

  const plain = stripHtmlToText(messageBody).replace(/\s+/g, ' ').trim();
  if (!plain) {
    return null;
  }

  if (plain.length <= maxChars) {
    return plain;
  }

  const sliced = plain.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(' ');
  const clipped =
    lastSpace > Math.floor(maxChars * 0.6) ? sliced.slice(0, lastSpace).trimEnd() : sliced;

  return `${clipped}…`;
};
