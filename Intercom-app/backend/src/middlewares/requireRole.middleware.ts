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

/** Allows the explicitly marked short-lived recruiter demo token on read-only routes. */
export const requireRoleOrDemo = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (req.user.demo === true && roles.includes(req.user.role as Role)) {
      next();
      return;
    }

    if (req.user.role !== ROLES.ADMIN) {
      next(AppError.forbidden());
      return;
    }

    next();
  };
