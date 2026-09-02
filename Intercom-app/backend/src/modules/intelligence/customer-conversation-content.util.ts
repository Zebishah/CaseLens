import { buildExtractionV2UserPrompt } from '../employee/employee.extraction-v2.prompt.js';

export const ALLOWED_CUSTOMER_PART_TYPES = new Set(['comment']);
export const ALLOWED_CUSTOMER_AUTHOR_TYPES = new Set(['user', 'lead', 'contact']);

export type ConversationContentPart = {
  id: string;
  partType: string | null;
  authorType: string | null;
  body: string | null;
};

export type ClassifiedConversationPart = ConversationContentPart & {
  reason?:
    | 'disallowed_part_type'
    | 'disallowed_author_type'
    | 'application_generated'
    | 'empty_body';
};

export type SelectedCustomerConversationContent = {
  included: ConversationContentPart[];
  excluded: ClassifiedConversationPart[];
};

export type SanitizedAnalysisInputInspection = {
  subject: string | null;
  customerMessageBodies: string[];
  reporterName: string | null;
  reporterEmail: string | null;
  includedParts: ConversationContentPart[];
  excludedParts: ClassifiedConversationPart[];
  tags: string[];
  modelUserPrompt: string;
  containsApplicationOutput: boolean;
};

const APPLICATION_NOTE_MARKER = /HR Intelligence\s*·\s*sync:/i;
const APPLICATION_SYNC_FINGERPRINT = /sync:[a-f0-9]{8,}/i;

const normalizeAuthorType = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

const normalizePartType = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

export const isApplicationGeneratedContent = (body: string | null | undefined): boolean => {
  if (!body?.trim()) {
    return false;
  }

  return APPLICATION_NOTE_MARKER.test(body) ||
    (APPLICATION_SYNC_FINGERPRINT.test(body) && /HR Intelligence/i.test(body));
};

const classifyPart = (
  part: ConversationContentPart,
  options?: { isSource?: boolean }
): { allowed: boolean; reason?: ClassifiedConversationPart['reason'] } => {
  if (!part.body?.trim()) {
    return { allowed: false, reason: 'empty_body' };
  }

  if (isApplicationGeneratedContent(part.body)) {
    return { allowed: false, reason: 'application_generated' };
  }

  const partType = normalizePartType(part.partType);
  const authorType = normalizeAuthorType(part.authorType);

  if (authorType === 'bot' || authorType === 'team') {
    return { allowed: false, reason: 'disallowed_author_type' };
  }

  if (options?.isSource) {
    if (partType && partType !== 'comment' && partType !== 'email' && partType !== 'conversation') {
      return { allowed: false, reason: 'disallowed_part_type' };
    }

    return { allowed: true };
  }

  if (partType && !ALLOWED_CUSTOMER_PART_TYPES.has(partType)) {
    return { allowed: false, reason: 'disallowed_part_type' };
  }

  if (!ALLOWED_CUSTOMER_AUTHOR_TYPES.has(authorType)) {
    return { allowed: false, reason: 'disallowed_author_type' };
  }

  return { allowed: true };
};

export const selectCustomerConversationMessages = (input: {
  subject?: string | null;
  source?: ConversationContentPart | null;
  parts?: ConversationContentPart[];
}): SelectedCustomerConversationContent => {
  const included: ConversationContentPart[] = [];
  const excluded: ClassifiedConversationPart[] = [];
  const seenBodies = new Set<string>();

  const consider = (part: ConversationContentPart | null | undefined, isSource = false): void => {
    if (!part) {
      return;
    }

    const classified = classifyPart(part, { isSource });
    if (!classified.allowed) {
      excluded.push({ ...part, reason: classified.reason });
      return;
    }

    const bodyKey = part.body?.trim().toLowerCase() ?? '';
    if (bodyKey && seenBodies.has(bodyKey)) {
      excluded.push({ ...part, reason: 'empty_body' });
      return;
    }

    if (bodyKey) {
      seenBodies.add(bodyKey);
    }

    included.push(part);
  };

  consider(input.source ?? null, true);
  for (const part of input.parts ?? []) {
    consider(part, false);
  }

  return { included, excluded };
};

export const filterStoredMessagesForAnalysis = <
  T extends { senderType: string | null; messageBody: string | null; intercomPartId?: string | null }
>(
  messages: T[]
): T[] =>
  messages.filter((message) => {
    if (isApplicationGeneratedContent(message.messageBody)) {
      return false;
    }

    const authorType = normalizeAuthorType(message.senderType);
    if (message.intercomPartId?.endsWith('-initial')) {
      return authorType !== 'bot' && authorType !== 'team';
    }

    return ALLOWED_CUSTOMER_AUTHOR_TYPES.has(authorType);
  });

export const inspectSanitizedAnalysisInput = (input: {
  subject?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  source?: ConversationContentPart | null;
  parts?: ConversationContentPart[];
  tags?: string[];
}): SanitizedAnalysisInputInspection => {
  const selected = selectCustomerConversationMessages(input);
  const customerMessageBodies = selected.included
    .map((part) => part.body?.trim() ?? '')
    .filter(Boolean);
  const modelUserPrompt = buildExtractionV2UserPrompt({
    subject: input.subject,
    messageBody: customerMessageBodies.join('\n\n'),
    reporterName: input.reporterName ?? null,
    reporterEmail: input.reporterEmail ?? null
  });

  return {
    subject: input.subject?.trim() || null,
    customerMessageBodies,
    reporterName: input.reporterName ?? null,
    reporterEmail: input.reporterEmail ?? null,
    includedParts: selected.included,
    excludedParts: selected.excluded,
    tags: input.tags ?? [],
    modelUserPrompt,
    containsApplicationOutput:
      isApplicationGeneratedContent(modelUserPrompt) ||
      /Employee mentioned:/i.test(modelUserPrompt) ||
      /hr-intelligence-processed/i.test(modelUserPrompt)
  };
};
