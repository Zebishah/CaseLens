import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoleOrDemo } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { sendSuccess } from '../../utils/response.util.js';
import { runEvaluation } from './evaluation.runner.js';

export const evaluationRoutes = Router();

evaluationRoutes.get(
  '/',
  authMiddleware,
  requireRoleOrDemo(ROLES.VIEWER),
  asyncHandler(async (_req, res) => {
    const metrics = runEvaluation();
    sendSuccess(res, metrics);
  })
);
