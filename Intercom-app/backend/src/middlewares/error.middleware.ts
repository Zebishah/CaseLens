import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.config.js';
import { MESSAGES } from '../constants/messages.js';
import { STATUS_CODES } from '../constants/statusCodes.js';
import { AppError } from '../utils/error.util.js';
import { errorResponse } from '../utils/response.util.js';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  void next;
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(errorResponse('Validation error', err.flatten()));
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error', { message, stack, err });
  res
    .status(STATUS_CODES.INTERNAL_SERVER_ERROR)
    .json(errorResponse(MESSAGES.INTERNAL_SERVER_ERROR));
};
