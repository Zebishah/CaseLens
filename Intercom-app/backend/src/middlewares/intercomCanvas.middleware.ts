import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';
import { STATUS_CODES } from '../constants/statusCodes.js';
import { verifyCanvasSignature } from '../modules/intercom/intercom.signature.js';
import { canvasBuilder } from '../modules/canvas/canvas.builder.js';

/**
 * Intercom Canvas initialize/submit can include the full conversation object.
 * Default express.raw limit is 100kb — long email threads exceed that (~160kb+).
 */
export const intercomCanvasRawBody = express.raw({
  type: 'application/json',
  limit: '2mb'
});

export const verifyIntercomCanvas = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.INTERCOM_ENABLED) {
    res.status(STATUS_CODES.OK).json(canvasBuilder.buildDisabled());
    return;
  }

  const signature = req.headers['x-body-signature'];
  const rawBody = req.body;

  logger.info('[canvas] Incoming Intercom canvas request', {
    path: req.path,
    hasSignature: Boolean(signature),
    bodyIsBuffer: Buffer.isBuffer(rawBody),
    bodyBytes: Buffer.isBuffer(rawBody) ? rawBody.length : 0
  });

  if (!Buffer.isBuffer(rawBody)) {
    logger.warn('[canvas] Rejected: body is not raw Buffer');
    res.status(STATUS_CODES.BAD_REQUEST).send('Expected raw JSON body');
    return;
  }

  if (!verifyCanvasSignature(signature, rawBody)) {
    logger.warn('[canvas] Rejected: invalid or missing x-body-signature');
    res.status(STATUS_CODES.UNAUTHORIZED).json({ error: 'Unauthorized' });
    return;
  }

  try {
    req.body = JSON.parse(rawBody.toString('utf8')) as unknown;
    const body =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)
        : {};
    const conversation = body.conversation as Record<string, unknown> | undefined;
    const context = body.context as Record<string, unknown> | undefined;

    logger.info('[canvas] Signature verified and payload parsed', {
      path: req.path,
      conversationId:
        body.conversation_id ??
        conversation?.id ??
        context?.conversation_id ??
        null
    });
    next();
  } catch {
    logger.warn('[canvas] Rejected: invalid JSON body');
    res.status(STATUS_CODES.BAD_REQUEST).send('Invalid JSON body');
  }
};
