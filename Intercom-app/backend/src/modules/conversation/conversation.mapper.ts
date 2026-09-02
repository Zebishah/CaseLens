import type { IntercomConversation, IntercomWebhookEnvelope } from '../intercom/intercom.types.js';
import { resolveReporterContext } from '../employee/employee.reporter-context.util.js';
import { resolveConversationSubjectFromIntercomPayload } from './conversation-subject.util.js';
import { CONVERSATION_MESSAGE_SAVE_LIMIT } from '../../constants/intelligence.constants.js';
import { parseIntercomUnixTimestamp } from '../intelligence/intelligence-revision.util.js';
import { selectCustomerConversationMessages } from '../intelligence/customer-conversation-content.util.js';

type IntercomRecord = Record<string, unknown>;

const asRecord = (value: unknown): IntercomRecord | undefined =>
  typeof value === 'object' && value !== null ? (value as IntercomRecord) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asIntercomId = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return undefined;
};

export type MappedConversation = {
  intercomId: string;
  subject: string | null;
  status: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterStoreNumber: string | null;
  reporterCompanyDomain: string | null;
  companyName: string | null;
  intercomContactId: string | null;
  assignedIntercomAdminId: string | null;
  rawPayload: IntercomRecord;
  source?: 'demo' | 'email' | 'intercom';
  correlationId?: string | null;
  processingMode?: 'live' | 'fixture';
  demoSessionId?: number | null;
  sourceUpdatedAt?: Date | null;
};

export type MappedConversationMessage = {
  intercomPartId: string;
  senderType: string | null;
  senderId: string | null;
  messageBody: string | null;
};

const mapSourceMessage = (
  intercomId: string,
  source: IntercomRecord | undefined
): MappedConversationMessage | null => {
  const messageBody = asString(source?.body);
  if (!messageBody) {
    return null;
  }

  const author = asRecord(source?.author);
  return {
    intercomPartId: `${intercomId}-initial`,
    senderType: asString(author?.type) ?? null,
    senderId: asIntercomId(author?.id) ?? null,
    messageBody
  };
};

const mapConversationParts = (
  intercomId: string,
  item: IntercomRecord,
  sourceMessage: MappedConversationMessage | null
): MappedConversationMessage[] => {
  const partsWrapper = asRecord(item.conversation_parts);
  const parts = Array.isArray(partsWrapper?.conversation_parts)
    ? partsWrapper.conversation_parts
    : [];

  const selected = selectCustomerConversationMessages({
    subject: asString(item.title) ?? asString(item.subject),
    source: sourceMessage
      ? {
          id: sourceMessage.intercomPartId,
          partType: 'comment',
          authorType: sourceMessage.senderType,
          body: sourceMessage.messageBody
        }
      : null,
    parts: parts.flatMap((part) => {
      const partRecord = asRecord(part);
      const partId = asIntercomId(partRecord?.id);
      if (!partId) {
        return [];
      }

      const partAuthor = asRecord(partRecord?.author);
      return [
        {
          id: partId,
          partType: asString(partRecord?.part_type) ?? asString(partRecord?.message_type) ?? null,
          authorType: asString(partAuthor?.type) ?? null,
          body: asString(partRecord?.body) ?? null
        }
      ];
    })
  });

  const senderByPartId = new Map<string, { senderType: string | null; senderId: string | null }>();
  if (sourceMessage) {
    senderByPartId.set(sourceMessage.intercomPartId, {
      senderType: sourceMessage.senderType,
      senderId: sourceMessage.senderId
    });
  }

  for (const part of parts) {
    const partRecord = asRecord(part);
    const partId = asIntercomId(partRecord?.id);
    if (!partId) {
      continue;
    }

    const partAuthor = asRecord(partRecord?.author);
    senderByPartId.set(partId, {
      senderType: asString(partAuthor?.type) ?? null,
      senderId: asIntercomId(partAuthor?.id) ?? null
    });
  }

  return selected.included.slice(0, CONVERSATION_MESSAGE_SAVE_LIMIT).map((part) => ({
    intercomPartId: part.id,
    senderType: senderByPartId.get(part.id)?.senderType ?? part.authorType,
    senderId: senderByPartId.get(part.id)?.senderId ?? null,
    messageBody: part.body
  }));
};

const mapConversationItem = (
  item: IntercomRecord
): { conversation: MappedConversation; messages: MappedConversationMessage[] } => {
  const source = asRecord(item.source);
  const author = asRecord(source?.author);
  const company = asRecord(author?.company);
  const intercomId = asIntercomId(item.id);

  if (!intercomId) {
    throw new Error('Intercom conversation id is missing from payload');
  }

  const sourceMessage = mapSourceMessage(intercomId, source);

  const conversation: MappedConversation = {
    intercomId,
    subject: resolveConversationSubjectFromIntercomPayload(item),
    status: asString(item.state) ?? null,
    reporterName: asString(author?.name) ?? null,
    reporterEmail: asString(author?.email) ?? null,
    reporterStoreNumber: null,
    reporterCompanyDomain: null,
    companyName: asString(company?.name) ?? asString(item.company_name) ?? null,
    intercomContactId: asIntercomId(author?.id) ?? null,
    assignedIntercomAdminId:
      asIntercomId(item.admin_assignee_id) ?? asIntercomId(asRecord(item.assignee)?.id) ?? null,
    rawPayload: item,
    sourceUpdatedAt: parseIntercomUnixTimestamp(item.updated_at)
  };

  const messages = mapConversationParts(intercomId, item, sourceMessage);

  return { conversation, messages };
};

const collectContactEmails = (item: IntercomRecord): string[] => {
  const contactsWrapper = asRecord(item.contacts);
  const contacts = contactsWrapper?.contacts;
  if (!Array.isArray(contacts)) {
    return [];
  }

  const emails: string[] = [];
  for (const contact of contacts) {
    const email = asString(asRecord(contact)?.email);
    if (email) {
      emails.push(email);
    }
  }

  return emails;
};

const enrichReporterFromContactsList = (
  conversation: MappedConversation,
  item: IntercomRecord
): void => {
  const contactsWrapper = asRecord(item.contacts);
  const contacts = contactsWrapper?.contacts;
  const firstContact = Array.isArray(contacts) ? asRecord(contacts[0]) : undefined;

  if (!firstContact) {
    return;
  }

  if (!conversation.reporterName) {
    conversation.reporterName = asString(firstContact.name) ?? null;
  }
  if (!conversation.reporterEmail) {
    conversation.reporterEmail = asString(firstContact.email) ?? null;
  }
  if (!conversation.intercomContactId) {
    conversation.intercomContactId = asIntercomId(firstContact.id) ?? null;
  }
  if (!conversation.companyName) {
    conversation.companyName = asString(asRecord(firstContact.company)?.name) ?? null;
  }
};

const applyReporterContext = (conversation: MappedConversation, item: IntercomRecord): void => {
  const reporterContext = resolveReporterContext(
    conversation.reporterName,
    conversation.reporterEmail,
    collectContactEmails(item)
  );
  conversation.reporterStoreNumber = reporterContext.storeNumber;
  conversation.reporterCompanyDomain = reporterContext.domain;
};

export const mapWebhookToConversation = (
  envelope: IntercomWebhookEnvelope
): { conversation: MappedConversation; messages: MappedConversationMessage[] } => {
  const mapped = mapConversationItem(envelope.data.item);
  enrichReporterFromContactsList(mapped.conversation, envelope.data.item);
  applyReporterContext(mapped.conversation, envelope.data.item);
  return mapped;
};

/** Maps GET /conversations/:id API response to the same DB shape as webhooks. */
export const mapApiConversationToConversation = (
  apiConversation: IntercomConversation
): { conversation: MappedConversation; messages: MappedConversationMessage[] } => {
  const item = apiConversation as IntercomRecord;
  const mapped = mapConversationItem(item);
  enrichReporterFromContactsList(mapped.conversation, item);
  applyReporterContext(mapped.conversation, item);
  return mapped;
};
