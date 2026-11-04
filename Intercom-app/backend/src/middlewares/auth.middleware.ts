import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type AppJwtPayload } from '../services/jwt.service.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { AppError } from '../utils/error.util.js';

declare global {
  namespace Express {
    interface Request { user?: AppJwtPayload; }
  }
}

export const authenticateAccessToken = async (token: string): Promise<AppJwtPayload> => {
  let payload: AppJwtPayload;
  try { payload = verifyToken(token); } catch { throw AppError.unauthorized(); }
  if (payload.demo === true) {
    if (payload.role !== 'viewer') throw AppError.unauthorized();
    return payload;
  }
  const user = await authRepository.findUserById(payload.sub);
  if (!user || !user.emailVerifiedAt || payload.authVersion !== user.authVersion ||
      payload.email !== user.email || payload.role !== user.role) {
    throw AppError.unauthorized('Session expired; sign in again');
  }
  return payload;
};

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    req.user = await authenticateAccessToken(authHeader.slice(7));
    next();
  } catch (error) { next(error); }
};
