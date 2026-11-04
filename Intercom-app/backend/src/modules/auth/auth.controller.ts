import type { Request, Response } from 'express';
import { AppError } from '../../utils/error.util.js';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookie.js';
import { authService } from './auth.service.js';

const sendSession = (
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
  statusCode: number = STATUS_CODES.OK
): void => {
  const { refreshToken, ...session } = result;
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, session, statusCode);
};

export const authController = {
  async register(_req: Request, _res: Response): Promise<void> {
    throw AppError.forbidden('Public registration is disabled; access is invite-controlled');
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    sendSession(res, result);
  },

  async resendVerification(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.resendVerification(req.body));
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.verifyEmail(req.body.token));
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const result = await authService.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
    clearRefreshCookie(res);
    sendSuccess(res, result);
  },

  async enterDemo(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.enterDemo());
  },

  async inspectInvite(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.inspectWorkspaceInvite(req.query.token as string));
  },

  async acceptInvite(req: Request, res: Response): Promise<void> {
    sendSession(res, await authService.acceptWorkspaceInvite(req.body.token, req.body.password));
  },

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw AppError.unauthorized('Session expired');
    }
    const result = await authService.refreshToken(refreshToken);
    sendSession(res, result);
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    sendSuccess(res, { signedOut: true });
  }
};
