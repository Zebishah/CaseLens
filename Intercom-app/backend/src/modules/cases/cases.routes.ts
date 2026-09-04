import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { casesController } from './cases.controller.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';

export const casesRoutes = Router();

const requireCaseReader = requireRole(ROLES.ADMIN, ROLES.VIEWER);
const caseIdSchema = z.object({ body: z.unknown().optional(), params: z.object({ id: z.coerce.number().int().positive() }), query: z.object({}) });

casesRoutes.get(
  '/overview',
  authMiddleware,
  requireCaseReader,
  asyncHandler(casesController.overview)
);
casesRoutes.get('/', authMiddleware, requireCaseReader, asyncHandler(casesController.list));
casesRoutes.get('/:id', authMiddleware, requireCaseReader, validate(caseIdSchema), asyncHandler(casesController.get));

casesRoutes.post(
  '/:id/corrections',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(caseIdSchema),
  asyncHandler(casesController.correct)
);
casesRoutes.post(
  '/:id/feedback',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(caseIdSchema),
  asyncHandler(casesController.feedback)
);
