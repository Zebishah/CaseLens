import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/error.util.js';
import { ROLES, type Role } from '../constants/roles.js';

export const requireRole = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role as Role) && req.user.role !== ROLES.ADMIN) {
      next(AppError.forbidden());
      return;
    }

    next();
  };
