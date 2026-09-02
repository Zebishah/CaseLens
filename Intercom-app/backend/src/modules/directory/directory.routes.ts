import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { directoryController } from './directory.controller.js';

export const directoryRoutes = Router();

directoryRoutes.use(authMiddleware);
directoryRoutes.get(
  '/',
  requireRole(ROLES.ADMIN, ROLES.VIEWER),
  asyncHandler(directoryController.list)
);
directoryRoutes.post(
  '/import',
  requireRole(ROLES.ADMIN),
  asyncHandler(directoryController.importFile)
);
directoryRoutes.post(
  '/sync/box',
  requireRole(ROLES.ADMIN),
  asyncHandler(directoryController.replayBox)
);
