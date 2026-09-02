import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { directoryController } from './directory.controller.js';

export const directoryRoutes = Router();

directoryRoutes.use(authMiddleware, requireRole(ROLES.ADMIN));
directoryRoutes.get('/', asyncHandler(directoryController.list));
directoryRoutes.post('/import', asyncHandler(directoryController.importFile));
directoryRoutes.post('/sync/box', asyncHandler(directoryController.replayBox));
