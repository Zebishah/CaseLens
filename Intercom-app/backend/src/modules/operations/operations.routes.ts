import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { operationsController } from './operations.controller.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';

export const operationsRoutes = Router();

operationsRoutes.get(
  '/reviewer-summary',
  authMiddleware,
  requireRole(ROLES.VIEWER),
  asyncHandler(operationsController.reviewerSummary)
);
operationsRoutes.get(
  '/metrics',
  authMiddleware,
  requireRole(ROLES.VIEWER),
  asyncHandler(operationsController.metrics)
);
operationsRoutes.use(authMiddleware, requireRole(ROLES.ADMIN));
const conversationIdSchema = z.object({ body: z.unknown().optional(), params: z.object({ conversationId: z.coerce.number().int().positive() }), query: z.object({}) });
operationsRoutes.get('/queues', asyncHandler(operationsController.summary));
operationsRoutes.post('/replay/:conversationId', validate(conversationIdSchema), asyncHandler(operationsController.replay));
operationsRoutes.post('/intercom-sync/:conversationId', validate(conversationIdSchema), asyncHandler(operationsController.retryIntercomSync));
operationsRoutes.post('/outbox/recover', asyncHandler(operationsController.recoverOutbox));
