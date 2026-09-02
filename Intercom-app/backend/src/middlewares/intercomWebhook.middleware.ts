import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import { STATUS_CODES } from '../constants/statusCodes.js';
import { verifyWebhookSignature } from '../modules/intercom/intercom.signature.js';
import { parseIntercomWebhook } from '../modules/intercom/intercom.types.js';

/** Must be mounted before express.json() on the webhook route. */
export const intercomWebhookRawBody = express.raw({
  type: 'application/json',
  limit: '2mb'
});

export const verifyIntercomWebhook = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.INTERCOM_ENABLED) {
    res.status(STATUS_CODES.SERVICE_UNAVAILABLE).send('Intercom adapter is disabled');
    return;
  }

  const signature = req.headers['x-hub-signature'];
  const rawBody = req.body;

  logger.info('[webhook] Incoming Intercom webhook request', {
    hasSignature: Boolean(signature),
    bodyIsBuffer: Buffer.isBuffer(rawBody),
    bodyBytes: Buffer.isBuffer(rawBody) ? rawBody.length : 0
  });

  if (!Buffer.isBuffer(rawBody)) {
    logger.warn('[webhook] Rejected: body is not raw Buffer (express.raw may be misconfigured)');
    res.status(STATUS_CODES.BAD_REQUEST).send('Expected raw JSON body');
    return;
  }

  if (!verifyWebhookSignature(signature, rawBody)) {
    logger.warn('[webhook] Rejected: invalid or missing x-hub-signature');
    res.status(STATUS_CODES.UNAUTHORIZED).send('Unauthorized');
    return;
  }

  try {
    const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    req.body = parseIntercomWebhook(parsed);
    logger.info('[webhook] Signature verified and payload parsed', {
      topic: req.body.topic,
      notificationId: req.body.id,
      intercomConversationId: req.body.data?.item?.id
    });
    next();
  } catch (error) {
    logger.warn('[webhook] Rejected: invalid webhook payload', {
      error: error instanceof Error ? error.message : 'unknown'
    });
    res.status(STATUS_CODES.BAD_REQUEST).send('Invalid webhook payload');
  }
};
