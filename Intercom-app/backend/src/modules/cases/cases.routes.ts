import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { casesController } from './cases.controller.js';

export const casesRoutes = Router();

casesRoutes.get(
  '/overview',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  asyncHandler(casesController.overview)
);
casesRoutes.get('/', authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(casesController.list));
casesRoutes.get('/:id', authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(casesController.get));
casesRoutes.post('/:id/corrections', authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(casesController.correct));
casesRoutes.post('/:id/feedback', authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(casesController.feedback));
