import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authController } from './auth.controller.js';
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.validation.js';

export const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRoutes.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRoutes.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler(authController.refreshToken)
);
authRoutes.post('/logout', asyncHandler(authController.logout));
