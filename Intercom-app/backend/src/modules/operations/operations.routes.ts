import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { operationsController } from './operations.controller.js';

export const operationsRoutes = Router();

operationsRoutes.use(authMiddleware, requireRole(ROLES.ADMIN));
operationsRoutes.get('/queues', asyncHandler(operationsController.summary));
operationsRoutes.post('/replay/:conversationId', asyncHandler(operationsController.replay));
operationsRoutes.post('/intercom-sync/:conversationId', asyncHandler(operationsController.retryIntercomSync));
operationsRoutes.post('/outbox/recover', asyncHandler(operationsController.recoverOutbox));
