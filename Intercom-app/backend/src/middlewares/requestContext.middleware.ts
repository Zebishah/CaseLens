import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../config/logger.config.js';

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  const correlationId = req.header('x-correlation-id')?.trim() || requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);
  (req as Request & { requestId?: string; correlationId?: string }).requestId = requestId;
  (req as Request & { requestId?: string; correlationId?: string }).correlationId = correlationId;

  const start = Date.now();
  res.on('finish', () => {
    logger.http('request.completed', {
      requestId,
      correlationId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    });
  });

  next();
};
