import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { directoryController } from './directory.controller.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';

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
  validate(z.object({
    body: z.object({
      csv: z.string().max(2_000_000).optional(),
      xlsxBase64: z.string().max(2_700_000).optional()
    }).refine((body) => Boolean(body.csv?.trim() || body.xlsxBase64?.trim()), 'Provide csv or xlsxBase64'),
    params: z.object({}),
    query: z.object({})
  })),
  asyncHandler(directoryController.importFile)
);
directoryRoutes.post(
  '/sync/box',
  requireRole(ROLES.ADMIN),
  asyncHandler(directoryController.replayBox)
);
