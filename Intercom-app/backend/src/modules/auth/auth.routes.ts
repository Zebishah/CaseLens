import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authLoginRateLimit, publicDemoRateLimit } from '../../middlewares/rateLimit.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/requireRole.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { authController } from './auth.controller.js';
import { changePasswordSchema, verifyEmailSchema, verifyEmailCodeSchema, acceptInviteSchema, inspectInviteSchema, loginSchema, refreshTokenSchema, registerSchema } from './auth.validation.js';

export const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRoutes.post(
  '/login',
  authLoginRateLimit,
  validate(loginSchema),
  asyncHandler(authController.login)
);
authRoutes.post('/email-verification/resend', authLoginRateLimit, validate(loginSchema), asyncHandler(authController.resendVerification));
authRoutes.post('/email-verification/verify-code', authLoginRateLimit, validate(verifyEmailCodeSchema), asyncHandler(authController.verifyEmailCode));
authRoutes.post('/email-verification/verify', authLoginRateLimit, validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));
authRoutes.post('/change-password', authMiddleware, requireRole(ROLES.ADMIN), authLoginRateLimit,
  validate(changePasswordSchema), asyncHandler(authController.changePassword));
authRoutes.post('/demo', publicDemoRateLimit, asyncHandler(authController.enterDemo));
authRoutes.get('/invite', authLoginRateLimit, validate(inspectInviteSchema), asyncHandler(authController.inspectInvite));
authRoutes.post('/invite/accept', authLoginRateLimit, validate(acceptInviteSchema), asyncHandler(authController.acceptInvite));
authRoutes.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler(authController.refreshToken)
);
authRoutes.post('/logout', asyncHandler(authController.logout));
