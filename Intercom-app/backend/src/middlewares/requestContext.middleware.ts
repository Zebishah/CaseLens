import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../config/logger.config.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

const trustedRequestId = (value: string | undefined): string | null => {
  const candidate = value?.trim();
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : null;
};

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = trustedRequestId(req.header('x-request-id')) ?? randomUUID();
  const correlationId = trustedRequestId(req.header('x-correlation-id')) ?? requestId;
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
