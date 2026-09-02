import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../../utils/error.util.js';
import { sendSuccess } from '../../utils/response.util.js';
import { db } from '../../database/connection.js';
import { buildCorrelationId } from '../ingestion/ingestion.normalize.js';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import { verifyResendSignature } from './resend.signature.js';
import { demoSessionService } from '../demo/demo-session.service.js';
import { enqueueResendEmailFetch } from './resend.queue.js';

const receivedSchema = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().min(1),
      from: z.string().optional(),
      to: z.array(z.string()).optional(),
      subject: z.string().optional(),
      created_at: z.string().optional()
    })
    .passthrough()
});

const parseAddress = (value: string | undefined): { email: string; name: string | null } => {
  if (!value?.trim()) {
    return { email: 'unknown@example.invalid', name: null };
  }

  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1]?.replace(/"/g, '').trim() || null, email: match[2]!.trim().toLowerCase() };
  }

  return { email: value.trim().toLowerCase(), name: null };
};

export const resendWebhookController = {
  async handle(req: Request, res: Response): Promise<void> {
    if (!env.RESEND_ENABLED || !env.RESEND_WEBHOOK_SECRET) {
      throw AppError.serviceUnavailable('Resend inbound email is not enabled');
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const valid = verifyResendSignature({
      payload: rawBody,
      id: String(req.header('svix-id') ?? ''),
      timestamp: String(req.header('svix-timestamp') ?? ''),
      signatureHeader: String(req.header('svix-signature') ?? ''),
      secret: env.RESEND_WEBHOOK_SECRET
    });

    if (!valid) {
      throw AppError.unauthorized('Invalid Resend webhook signature');
    }

    const parsed = receivedSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success || parsed.data.type !== 'email.received') {
      sendSuccess(res, { ignored: true });
      return;
    }

    const emailId = parsed.data.data.email_id;
    const webhookId = String(req.header('svix-id') ?? emailId);
    const existing =
      (await ingestionRepository.findByReceivedEmailId(emailId)) ??
      (await ingestionRepository.findBySourceExternalId('email', webhookId));

    if (existing) {
      sendSuccess(res, { duplicate: true, inboundEventId: existing.id });
      return;
    }

    const sender = parseAddress(parsed.data.data.from);
    const recipients = (parsed.data.data.to ?? []).map((item) => parseAddress(item).email);
    const session = await demoSessionService.findByReceivingAddress(recipients[0] ?? '');
    if (session && !(await demoSessionService.incrementEmail(session.id))) {
      throw AppError.badRequest('Demo session email limit reached');
    }

    const correlationId = buildCorrelationId();
    const recorded = await db.transaction(async (tx) => {
      const event = await ingestionRepository.insertEvent(
        {
          source: 'email',
          externalEventId: webhookId,
          receivedEmailId: emailId,
          eventType: 'email.received',
          payloadHash: emailId,
          status: 'received',
          correlationId,
          demoSessionId: session?.id ?? null,
          processingMode: env.LLM_MODE === 'live' ? 'live' : 'fixture',
          payload: {
            subject: parsed.data.data.subject ?? null,
            senderEmail: sender.email,
            recipientCount: recipients.length
          },
          receivedAt: parsed.data.data.created_at ? new Date(parsed.data.data.created_at) : new Date()
        },
        tx
      );

      const outbox = await ingestionRepository.insertOutbox(
        {
          inboundEventId: event.id,
          jobName: 'fetch-resend-email',
          jobId: webhookId,
          payload: { emailId, inboundEventId: event.id, correlationId, webhookId },
          status: 'pending',
          correlationId
        },
        tx
      );

      return { event, outbox };
    });

    try {
      await enqueueResendEmailFetch({
        emailId,
        inboundEventId: recorded.event.id,
        correlationId,
        webhookId
      });
      await ingestionRepository.markDispatched(recorded.outbox.id);
      logger.info('[resend] Inbound email recorded', {
        inboundEventId: recorded.event.id,
        correlationId
      });
    } catch (error) {
      logger.error('[resend] Fetch job dispatch failed — outbox will recover', {
        inboundEventId: recorded.event.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    sendSuccess(res, {
      accepted: true,
      inboundEventId: recorded.event.id,
      correlationId
    });
  }
};
