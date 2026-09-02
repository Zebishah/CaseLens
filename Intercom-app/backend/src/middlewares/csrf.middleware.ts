import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.config.js';
import { AppError } from '../utils/error.util.js';

export const requireCsrf = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const cookie = req.cookies?.[env.CSRF_COOKIE_NAME];
  const header = req.header('x-csrf-token');
  if (!cookie || !header || cookie !== header) {
    next(AppError.forbidden('CSRF token mismatch'));
    return;
  }

  next();
};
