import type { Request, Response } from 'express';
import { env } from '../../config/env.config.js';
import { AppError } from '../../utils/error.util.js';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import { authService } from './auth.service.js';

export const authController = {
  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register new user
   *     tags: [Auth]
   */
  async register(req: Request, res: Response): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw AppError.forbidden('Public registration is disabled');
    }
    const result = await authService.register(req.body);
    sendSuccess(res, result, STATUS_CODES.CREATED);
  },

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login user
   *     tags: [Auth]
   */
  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  },

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Refresh access token
   *     tags: [Auth]
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const result = await authService.refreshToken(req.body.refreshToken);
    sendSuccess(res, result);
  }
};
