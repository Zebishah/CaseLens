import { createHash, randomUUID } from 'node:crypto';
import { stripHtmlToText } from '../../utils/html.util.js';
import {
  caseIngestionEventSchema,
  type CaseIngestionEvent,
  type CaseSource
} from './ingestion.types.js';

const MAX_PLAIN_TEXT = 20_000;

export const sanitizePlainText = (value: string): string => {
  const stripped = stripHtmlToText(value)
    .split('')
    .filter((char) => char.charCodeAt(0) !== 0)
    .join('')
    .trim();
  if (stripped.length <= MAX_PLAIN_TEXT) {
    return stripped;
  }

  return stripped.slice(0, MAX_PLAIN_TEXT);
};

export const buildCorrelationId = (): string => randomUUID();

export const buildSourceExternalId = (source: CaseSource, externalEventId: string): string =>
  `${source}:${externalEventId}`;

export const hashIngestionPayload = (event: CaseIngestionEvent): string => {
  const canonical = JSON.stringify({
    source: event.source,
    externalEventId: event.externalEventId,
    senderEmail: event.senderEmail.trim().toLowerCase(),
    recipients: [...event.recipients].map((item) => item.trim().toLowerCase()).sort(),
    subject: event.subject ?? '',
    plainTextContent: event.plainTextContent,
    receivedEmailId: event.receivedEmailId ?? ''
  });

  return createHash('sha256').update(canonical).digest('hex');
};

export const normalizeIngestionEvent = (input: CaseIngestionEvent): CaseIngestionEvent => {
  const normalized: CaseIngestionEvent = {
    ...input,
    senderEmail: input.senderEmail.trim().toLowerCase(),
    senderName: input.senderName?.trim() || null,
    recipients: [
      ...new Set(input.recipients.map((item) => item.trim().toLowerCase()).filter(Boolean))
    ],
    subject: input.subject?.trim() || null,
    plainTextContent: sanitizePlainText(input.plainTextContent),
    attachments: [],
    correlationId: input.correlationId.trim() || buildCorrelationId(),
    demoSessionId: input.demoSessionId ?? null,
    receivedEmailId: input.receivedEmailId ?? null
  };

  return caseIngestionEventSchema.parse(normalized);
};

export const buildIdempotencyKey = (source: CaseSource, externalEventId: string): string =>
  `${source}:${externalEventId.trim()}`;
