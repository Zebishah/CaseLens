import { geminiConfig } from '../../config/gemini.config.js';
import { logger } from '../../config/logger.config.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { stripHtmlToText } from '../../utils/html.util.js';
import type { IntelligenceRelatedCase } from '../../types/intelligence.types.js';

/** Max characters for the related-case summary paragraph (~4 sidebar lines). */
export const RELATED_CASE_SUMMARY_MAX_CHARS = 340;
/** Hard ceiling used when clamping any summary. */
export const RELATED_CASE_SUMMARY_MAX_SENTENCES = 4;
/** A one-line report has nothing to expand — keep its summary short too. */
const SHORT_MESSAGE_CHARS = 140;

/** Sentence budget scaled to how much the original message actually says. */
export const resolveSentenceRange = (
  openingMessage: string
): { minSentences: number; maxSentences: number; words: string } => {
  const length = openingMessage.replace(/\s+/g, ' ').trim().length;

  if (length <= SHORT_MESSAGE_CHARS) {
    return { minSentences: 1, maxSentences: 2, words: 'about 15–30 words' };
  }

  return { minSentences: 3, maxSentences: 4, words: 'about 45–65 words' };
};

/** Cap Gemini fan-out so one intelligence job cannot flood the API. */
const SUMMARY_CONCURRENCY = 3;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

/** Guards against a truncated Gemini payload reaching the Intercom card. */
const looksLikeRawJson = (text: string): boolean =>
  text.trimStart().startsWith('{') || text.includes('"summary"');

const splitSentences = (text: string): string[] => {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches?.length) {
    return text.trim() ? [text.trim()] : [];
  }

  return matches.map((part) => part.trim()).filter(Boolean);
};

const countSentences = (text: string): number => splitSentences(text).length;

/** Single paragraph, whole sentences only — never a mid-sentence cut. */
const clampSummaryText = (text: string, maxChars = RELATED_CASE_SUMMARY_MAX_CHARS): string => {
  const sentences = splitSentences(text.replace(/\s+/g, ' ').trim()).slice(
    0,
    RELATED_CASE_SUMMARY_MAX_SENTENCES
  );
  if (sentences.length === 0) {
    return '';
  }

  const kept: string[] = [];
  for (const sentence of sentences) {
    if ([...kept, sentence].join(' ').length > maxChars && kept.length > 0) {
      break;
    }
    kept.push(sentence);
  }

  return kept.join(' ');
};

const buildSummaryPrompt = (subject: string, openingMessage: string): string => {
  const { minSentences, maxSentences, words } = resolveSentenceRange(openingMessage);

  return `
You are helping an HR advisor understand a past case quickly.

Read the conversation message below and explain what it means in YOUR OWN WORDS,
so the advisor never needs to open the original.

Requirements:
- Return ONE short paragraph of ${minSentences} to ${maxSentences} sentences (${words}).
- Match the size of the original: a one-line report gets a one-line summary.
- Never pad with detail the message does not contain.
- Cover what the message says: who it is about, what happened, and what happens next if stated.
- Paraphrase completely. Do NOT copy or lightly reword sentences from the message.
- Do NOT start with "This document", "This notice", or "This notification".
- Plain everyday language. No markdown, no bullets, no labels, no line breaks.
- Use only facts from the message and subject. Never invent details.

Subject:
${subject || '(no subject)'}

Conversation message:
${openingMessage || '(no message)'}
`.trim();
};

const buildRewritePrompt = (subject: string, openingMessage: string): string => {
  const { minSentences, maxSentences } = resolveSentenceRange(openingMessage);

  return `
Your previous summary reused the original wording, which is not allowed.

Explain the conversation message below again, as if telling a colleague what it says.

Requirements:
- ONE paragraph of ${minSentences} to ${maxSentences} sentences.
- Change the sentence structure and vocabulary; keep only the facts.
- Do NOT reuse phrases from the message.
- Plain everyday language. No quoting, no markdown, no line breaks.

Subject:
${subject || '(no subject)'}

Conversation message:
${openingMessage || '(no message)'}
`.trim();
};

const normalizeForCompare = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Longest shared word run — catches sentences lifted straight from the message. */
const longestSharedPhraseLength = (summary: string, source: string): number => {
  const summaryWords = normalizeForCompare(summary).split(' ').filter(Boolean);
  const sourceText = ` ${normalizeForCompare(source)} `;
  let longest = 0;

  for (let start = 0; start < summaryWords.length; start += 1) {
    for (let end = start + longest + 1; end <= summaryWords.length; end += 1) {
      const phrase = summaryWords.slice(start, end).join(' ');
      if (!sourceText.includes(` ${phrase} `)) {
        break;
      }
      longest = end - start;
    }
  }

  return longest;
};

/**
 * True when Gemini echoed the original message instead of summarizing it.
 * A one-line report shares most of its words with any honest summary, so the
 * overlap rules only apply to longer messages.
 */
const isTooSimilarToPreview = (summary: string, preview: string | null | undefined): boolean => {
  const left = normalizeForCompare(summary);
  const right = normalizeForCompare(preview ?? '');
  if (!left || !right) {
    return false;
  }

  if (left === right || left.includes(right) || right.includes(left)) {
    return true;
  }

  if (right.length <= SHORT_MESSAGE_CHARS) {
    return false;
  }

  // A 7+ word verbatim run means it was copied, not paraphrased.
  if (longestSharedPhraseLength(summary, preview ?? '') >= 7) {
    return true;
  }

  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 2));
  const rightTokens = right.split(' ').filter((token) => token.length > 2);
  if (rightTokens.length === 0) {
    return false;
  }

  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap / rightTokens.length >= 0.8;
};

const buildSummaryResponseSchema = (minSentences: number, maxSentences: number) => ({
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: `One paraphrased paragraph of ${minSentences}-${maxSentences} sentences, no line breaks.`
    }
  },
  required: ['summary']
});

type StructuredSummaryPayload = {
  summary?: unknown;
};

/**
 * Parse Gemini structured JSON into one clamped paragraph.
 * Returns '' rather than leaking JSON syntax into the Intercom card.
 */
export const parseStructuredSummaryText = (raw: string): string => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  try {
    const parsed = JSON.parse(cleaned) as StructuredSummaryPayload;
    if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
      return clampSummaryText(parsed.summary);
    }
  } catch {
    // Truncated JSON — recover the text of the summary field if it started.
    const partial = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/);
    const recovered = partial?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    if (recovered) {
      // Drop the trailing partial sentence left by the cut-off.
      const complete = recovered.match(/^.*[.!?]/)?.[0];
      return complete ? clampSummaryText(complete) : '';
    }
  }

  // Anything still shaped like JSON is unusable for the sidebar.
  if (cleaned.startsWith('{') || cleaned.startsWith('[') || cleaned.includes('"summary"')) {
    return '';
  }

  return clampSummaryText(cleaned);
};

/**
 * Dedicated Gemini call for related-case card summaries.
 * Thinking is disabled so the token budget goes to the answer — otherwise
 * gemini-2.5-* burns the budget reasoning and returns truncated JSON.
 */
const callGeminiForSummary = async (
  prompt: string,
  temperature: number,
  sentenceRange: { minSentences: number; maxSentences: number }
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiConfig.model}:generateContent?key=${geminiConfig.apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 3000,
          responseMimeType: 'application/json',
          responseSchema: buildSummaryResponseSchema(
            sentenceRange.minSentences,
            sentenceRange.maxSentences
          ),
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('Gemini related-case summary timed out after 20000ms');
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini summary API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    logger.warn('[related-case-summary] Gemini stopped early', {
      finishReason: candidate.finishReason,
      textChars: text?.length ?? 0
    });
  }

  if (!text?.trim()) {
    throw new Error('Gemini summary API returned empty response');
  }

  return text;
};

const summarizeOne = async (input: {
  subject: string | null | undefined;
  openingMessage: string | null | undefined;
  previewText?: string | null;
  usedFirstMessageBody?: boolean;
}): Promise<string | null> => {
  if (!geminiConfig.apiKey) {
    return null;
  }

  const subject = (input.subject ?? '').trim();
  const openingMessage = stripHtmlToText(input.openingMessage ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!subject && !openingMessage) {
    return null;
  }

  const sentenceRange = resolveSentenceRange(openingMessage);
  let summary = parseStructuredSummaryText(
    await callGeminiForSummary(buildSummaryPrompt(subject, openingMessage), 0.3, sentenceRange)
  );

  // One retry with hotter temperature when the draft is lifted from the message.
  const echoSource = openingMessage || input.previewText || '';
  if (summary && isTooSimilarToPreview(summary, echoSource)) {
    logger.info('[related-case-summary] Draft echoed the message — rewriting', {
      openingMessageChars: openingMessage.length
    });
    const rewritten = parseStructuredSummaryText(
      await callGeminiForSummary(buildRewritePrompt(subject, openingMessage), 0.6, sentenceRange)
    );
    summary = rewritten && !isTooSimilarToPreview(rewritten, echoSource) ? rewritten : '';
  }

  if (!summary || looksLikeRawJson(summary)) {
    logger.warn('[related-case-summary] No usable paraphrase — leaving card without summary', {
      openingMessageChars: openingMessage.length,
      subjectChars: subject.length,
      rawJsonLeak: Boolean(summary) && looksLikeRawJson(summary)
    });
    return null;
  }

  logger.info('[related-case-summary] Summary drafted', {
    openingMessageChars: openingMessage.length,
    targetSentences: `${sentenceRange.minSentences}-${sentenceRange.maxSentences}`,
    usedFirstMessageBody: input.usedFirstMessageBody === true,
    summaryChars: summary.length,
    summarySentences: countSentences(summary),
    summaryStart: summary.slice(0, 100)
  });

  return summary;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
};

/**
 * Attach AI `summaryText` onto related cases using subject + first message.
 * On any Gemini failure, keeps the case as-is (previewText still available for UI).
 */
export const attachRelatedCaseSummaries = async (
  relatedCases: IntelligenceRelatedCase[]
): Promise<IntelligenceRelatedCase[]> => {
  if (relatedCases.length === 0) {
    return relatedCases;
  }

  if (!geminiConfig.apiKey) {
    logger.warn('[related-case-summary] GEMINI_API_KEY missing — skipping summaries');
    return relatedCases;
  }

  const bodies = await conversationRepository.findFirstMessageBodiesByConversationIds(
    relatedCases.map((relatedCase) => relatedCase.conversationId)
  );

  const startedAt = Date.now();
  let successCount = 0;
  let failureCount = 0;

  const enriched = await mapWithConcurrency(
    relatedCases,
    SUMMARY_CONCURRENCY,
    async (relatedCase) => {
      const firstMessageBody = bodies.get(relatedCase.conversationId) ?? null;
      const openingMessage = firstMessageBody ?? relatedCase.previewText ?? '';
      const echoSource = stripHtmlToText(openingMessage).replace(/\s+/g, ' ').trim();

      // Reuse a stored summary only when it is a real paraphrase of the right length.
      const existingFlat = (relatedCase.summaryText ?? '').replace(/\s+/g, ' ').trim();
      const { minSentences } = resolveSentenceRange(echoSource);
      const existingIsUsable =
        Boolean(existingFlat) &&
        countSentences(existingFlat) >= minSentences &&
        existingFlat.length <= RELATED_CASE_SUMMARY_MAX_CHARS &&
        !existingFlat.includes('…') &&
        !looksLikeRawJson(existingFlat) &&
        !isTooSimilarToPreview(existingFlat, echoSource);

      if (existingIsUsable) {
        return { ...relatedCase, summaryText: existingFlat };
      }

      try {
        const summaryText = await summarizeOne({
          subject: relatedCase.subject,
          openingMessage,
          previewText: relatedCase.previewText,
          usedFirstMessageBody: Boolean(firstMessageBody?.trim())
        });

        if (!summaryText) {
          return { ...relatedCase, summaryText: null };
        }

        successCount += 1;
        return { ...relatedCase, summaryText };
      } catch (error) {
        failureCount += 1;
        logger.warn('[related-case-summary] Failed to summarize related case — using preview fallback', {
          conversationId: relatedCase.conversationId,
          intercomId: relatedCase.intercomId,
          error: error instanceof Error ? error.message : String(error)
        });
        return relatedCase;
      }
    }
  );

  logger.info('[related-case-summary] Related case summaries attached', {
    relatedCaseCount: relatedCases.length,
    successCount,
    failureCount,
    durationMs: Date.now() - startedAt,
    samples: enriched.slice(0, 3).map((relatedCase) => ({
      intercomId: relatedCase.intercomId,
      hasSummary: Boolean(relatedCase.summaryText?.trim()),
      summaryStart: relatedCase.summaryText?.slice(0, 80) ?? null,
      previewStart: relatedCase.previewText?.slice(0, 80) ?? null
    }))
  });

  return enriched;
};

export const relatedCaseSummaryService = {
  summarizeOne,
  attachSummaries: attachRelatedCaseSummaries,
  clampSummaryText,
  parseStructuredSummaryText,
  buildSummaryPrompt,
  resolveSentenceRange,
  isTooSimilarToPreview
};
