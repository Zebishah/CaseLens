import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { accessRequestRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { accessRequestController } from './access-request.controller.js';

const statuses = ['pending', 'approved', 'invited', 'declined', 'expired'] as const;

const submitSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    workEmail: z.string().trim().email().max(255),
    organization: z.string().trim().max(160).optional(),
    role: z.string().trim().max(120).optional(),
    purpose: z.string().trim().min(20).max(800),
    consent: z.literal(true),
    website: z.string().max(0).optional().default('')
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

const listSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).default({}),
  query: z.object({
    status: z.enum(statuses).optional()
  })
});

const reviewSchema = z.object({
  body: z.object({
    status: z.enum(statuses),
    reviewNote: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const accessRequestRoutes = Router();

accessRequestRoutes.post(
  '/',
  accessRequestRateLimit,
  validate(submitSchema),
  asyncHandler(accessRequestController.submit)
);

accessRequestRoutes.get(
  '/',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(listSchema),
  asyncHandler(accessRequestController.list)
);

accessRequestRoutes.patch(
  '/:id',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(reviewSchema),
  asyncHandler(accessRequestController.review)
);
