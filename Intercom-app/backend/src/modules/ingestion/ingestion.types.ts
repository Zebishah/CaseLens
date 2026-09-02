import { z } from 'zod';

export const CASE_SOURCES = ['demo', 'email', 'intercom'] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

export const PROCESSING_MODES = ['live', 'fixture'] as const;
export type ProcessingMode = (typeof PROCESSING_MODES)[number];

export const INBOUND_EVENT_STATUSES = [
  'received',
  'queued',
  'processing',
  'completed',
  'failed',
  'duplicate'
] as const;
export type InboundEventStatus = (typeof INBOUND_EVENT_STATUSES)[number];

export type AttachmentMetadata = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type CaseIngestionEvent = {
  source: CaseSource;
  externalEventId: string;
  senderEmail: string;
  senderName?: string | null;
  recipients: string[];
  subject?: string | null;
  plainTextContent: string;
  receivedAt: Date;
  attachments: AttachmentMetadata[];
  providerMetadata: Record<string, unknown>;
  correlationId: string;
  demoSessionId?: string | null;
  processingMode: ProcessingMode;
  /** Resend received-email id when source is email. */
  receivedEmailId?: string | null;
};

export const attachmentMetadataSchema = z.object({
  filename: z.string().max(255),
  contentType: z.string().max(127),
  sizeBytes: z.number().int().nonnegative()
});

export const caseIngestionEventSchema = z.object({
  source: z.enum(CASE_SOURCES),
  externalEventId: z.string().min(1).max(255),
  senderEmail: z.string().email().max(320),
  senderName: z.string().max(255).nullable().optional(),
  recipients: z.array(z.string().email().max(320)).max(50),
  subject: z.string().max(500).nullable().optional(),
  plainTextContent: z.string().min(1).max(20_000),
  receivedAt: z.coerce.date(),
  attachments: z.array(attachmentMetadataSchema).max(0),
  providerMetadata: z.record(z.unknown()).default({}),
  correlationId: z.string().min(8).max(128),
  demoSessionId: z.string().max(64).nullable().optional(),
  processingMode: z.enum(PROCESSING_MODES),
  receivedEmailId: z.string().max(255).nullable().optional()
});
