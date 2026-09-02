import type { Request, Response } from 'express';
import { env } from '../../config/env.config.js';
import { AppError } from '../../utils/error.util.js';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookie.js';
import { authService } from './auth.service.js';

const sendSession = (
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
  statusCode = STATUS_CODES.OK
): void => {
  const { refreshToken, ...session } = result;
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, session, statusCode);
};

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw AppError.forbidden('Public registration is disabled');
    }
    const result = await authService.register(req.body);
    sendSession(res, result, STATUS_CODES.CREATED);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    sendSession(res, result);
  },

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw AppError.unauthorized('Session expired');
    }
    const result = await authService.refreshToken(refreshToken);
    sendSession(res, result);
  },

  async logout(_req: Request, res: Response): Promise<void> {
    clearRefreshCookie(res);
    sendSuccess(res, { signedOut: true });
  }
};
