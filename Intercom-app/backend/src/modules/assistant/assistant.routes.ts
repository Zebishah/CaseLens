import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { optionalAuthMiddleware } from '../../middlewares/optional-auth.middleware.js';
import { assistantRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { sendSuccess } from '../../utils/response.util.js';
import { assistantService } from './assistant.service.js';

const askSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1).max(1200),
    route: z.string().trim().min(1).max(120).default('/'),
    workspace: z.string().trim().min(1).max(80).default('hr-intelligence-workspace'),
    entityId: z.coerce.number().int().positive().optional()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const assistantRoutes = Router();

assistantRoutes.post('/ask', assistantRateLimit, optionalAuthMiddleware, validate(askSchema), asyncHandler(async (req, res) => {
  const body = askSchema.parse({ body: req.body, params: req.params, query: req.query }).body;
  const result = await assistantService.answer(body.message, {
    route: body.route,
    workspace: body.workspace,
    entityId: body.entityId,
    role: req.user?.role
  });
  sendSuccess(res, { ...result, provider: result.provider ?? 'deterministic-fallback', readOnly: true });
}));
