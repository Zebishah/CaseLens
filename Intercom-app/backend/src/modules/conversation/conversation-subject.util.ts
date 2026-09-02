const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

/**
 * Intercom inbox "Subject" in Conversation attributes is usually a custom attribute.
 * Prefer that over API `title`, which can stay on the original email subject line.
 */
export const resolveConversationSubjectFromIntercomPayload = (
  payload: Record<string, unknown> | null | undefined
): string | null => {
  if (!payload) {
    return null;
  }

  const source = asRecord(payload.source);
  const customAttributes = asRecord(payload.custom_attributes);
  const ticket = asRecord(payload.ticket);
  const ticketCustomAttributes = asRecord(ticket?.custom_attributes);

  const candidates = [
    asString(customAttributes?.Subject),
    asString(customAttributes?.subject),
    asString(ticketCustomAttributes?.Subject),
    asString(ticketCustomAttributes?.subject),
    asString(payload.title),
    asString(payload.subject),
    asString(source?.subject),
    asString(source?.title),
    asString(customAttributes?.title),
    asString(ticket?.subject),
    asString(ticket?.title)
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

/** Prefer latest Intercom payload over the stored DB column. */
export const resolveConversationSubject = (input: {
  subject?: string | null;
  rawPayload?: Record<string, unknown> | null;
}): string | null =>
  resolveConversationSubjectFromIntercomPayload(input.rawPayload ?? null) ??
  input.subject?.trim() ??
  null;
