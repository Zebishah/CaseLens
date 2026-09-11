import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/jwt.service.js';
import { AppError } from '../utils/error.util.js';

/**
 * Public assistant requests may omit a bearer token. If a caller supplies one,
 * it must still be valid; an invalid token must never silently become public.
 */
export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    next();
    return;
  }
  if (!authorization.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    req.user = verifyToken(authorization.replace('Bearer ', ''));
    next();
  } catch {
    next(AppError.unauthorized());
  }
};
