import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { stripHtmlToText } from '../../utils/html.util.js';
import { ingestionService } from '../ingestion/ingestion.service.js';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import type { ResendEmailFetchJob } from './resend.queue.js';

type ReceivedEmail = {
  id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
};

const parseFrom = (value: string | undefined) => {
  if (!value) {
    return { email: 'unknown@example.invalid', name: null as string | null };
  }
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1]?.replace(/"/g, '').trim() || null, email: match[2]!.trim().toLowerCase() };
  }
  return { email: value.trim().toLowerCase(), name: null as string | null };
};

export const fetchResendReceivedEmail = async (emailId: string): Promise<ReceivedEmail> => {
  if (!env.RESEND_API_KEY) {
    throw new Error('Resend API key is not configured');
  }

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` }
  });

  if (!response.ok) {
    throw new Error(`Resend provider failure: HTTP ${response.status}`);
  }

  return (await response.json()) as ReceivedEmail;
};

export const processResendEmailFetch = async (job: ResendEmailFetchJob): Promise<void> => {
  await ingestionRepository.markProcessing(job.inboundEventId);
  const email = await fetchResendReceivedEmail(job.emailId);
  const sender = parseFrom(email.from);
  const text = email.text?.trim() || stripHtmlToText(email.html ?? '') || email.subject || 'No text body';

  const result = await ingestionService.ingest({
    source: 'email',
    externalEventId: job.webhookId,
    receivedEmailId: job.emailId,
    senderEmail: sender.email,
    senderName: sender.name,
    recipients: email.to ?? [],
    subject: email.subject ?? null,
    plainTextContent: text,
    receivedAt: new Date(),
    attachments: [],
    providerMetadata: { resendEmailId: job.emailId },
    correlationId: job.correlationId,
    processingMode: env.LLM_MODE === 'live' ? 'live' : 'fixture'
  });

  if (result.conversationId) {
    await ingestionRepository.markCompleted(job.inboundEventId, result.conversationId);
  }

  logger.info('[resend] Email ingested', {
    inboundEventId: job.inboundEventId,
    duplicate: result.duplicate,
    conversationId: result.conversationId
  });
};
