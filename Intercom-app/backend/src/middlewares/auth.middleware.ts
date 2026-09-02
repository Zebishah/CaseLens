import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/jwt.service.js';
import { AppError } from '../utils/error.util.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: number;
        email: string;
        role: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(AppError.unauthorized());
  }
};
