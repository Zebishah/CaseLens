import type { Request, Response } from 'express';
import { logger } from '../../config/logger.config.js';
import type { IntercomWebhookEnvelope } from '../intercom/intercom.types.js';
import { webhookService } from './webhook.service.js';

export const webhookController = {
  async handleIntercomWebhook(req: Request, res: Response): Promise<void> {
    const envelope = req.body as IntercomWebhookEnvelope;
    logger.info('[webhook] Controller handling webhook', { topic: envelope.topic });

    const result = await webhookService.handle(envelope);

    logger.info('[webhook] Controller sending 200 OK', { handled: result.handled });
    res.sendStatus(200);
  }
};
