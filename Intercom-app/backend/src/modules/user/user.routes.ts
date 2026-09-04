import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { userController } from './user.controller.js';

const idSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.coerce.number().int().positive() })
});

const createSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    name: z.string().trim().min(1).max(255),
    role: z.enum([ROLES.ADMIN, ROLES.VIEWER, ROLES.USER]).optional()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

const updateSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().optional(),
      password: z.string().min(8).optional(),
      name: z.string().trim().min(1).max(255).optional(),
      role: z.enum([ROLES.ADMIN, ROLES.VIEWER, ROLES.USER]).optional()
    })
    .refine((v) => Object.keys(v).length > 0, 'At least one field is required'),
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({}).default({})
});

export const userRoutes = Router();

userRoutes.get('/', authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(userController.getUsers));
userRoutes.post(
  '/',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createSchema),
  asyncHandler(userController.createUser)
);
userRoutes.get('/:id', validate(idSchema), authMiddleware, requireRole(ROLES.ADMIN), asyncHandler(userController.getUser));
userRoutes.put(
  '/:id',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateSchema),
  asyncHandler(userController.updateUser)
);
userRoutes.delete(
  '/:id',
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(idSchema),
  asyncHandler(userController.deleteUser)
);
