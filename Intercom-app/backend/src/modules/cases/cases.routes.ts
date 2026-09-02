import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { casesController } from './cases.controller.js';

export const casesRoutes = Router();

const requireCaseReader = requireRole(ROLES.ADMIN, ROLES.VIEWER);

casesRoutes.get(
  '/overview',
  authMiddleware,
  requireCaseReader,
  asyncHandler(casesController.overview)
);
casesRoutes.get('/', authMiddleware, requireCaseReader, asyncHandler(casesController.list));
casesRoutes.get('/:id', authMiddleware, requireCaseReader, asyncHandler(casesController.get));

casesRoutes.post(
  '/:id/corrections',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  asyncHandler(casesController.correct)
);
casesRoutes.post(
  '/:id/feedback',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  asyncHandler(casesController.feedback)
);
