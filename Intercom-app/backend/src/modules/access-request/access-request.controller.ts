import type { Request, Response } from 'express';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import {
  accessRequestService,
  type SubmitAccessRequest
} from './access-request.service.js';
import type { AccessRequestStatus } from './access-request.repository.js';
import { authService } from '../auth/auth.service.js';

export const accessRequestController = {
  async submit(req: Request, res: Response): Promise<void> {
    const result = await accessRequestService.submit(req.body as SubmitAccessRequest);
    sendSuccess(res, result, STATUS_CODES.CREATED);
  },

  async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as AccessRequestStatus | undefined;
    sendSuccess(res, await accessRequestService.list(status));
  },

  async review(req: Request, res: Response): Promise<void> {
    const { status, reviewNote } = req.body as {
      status: AccessRequestStatus;
      reviewNote?: string;
    };
    const reviewed = await accessRequestService.review(Number(req.params.id), status, reviewNote);
    if (status === 'approved') {
      const invitation = await authService.issueWorkspaceInvite({
        accessRequestId: reviewed.id,
        email: reviewed.workEmail,
        name: reviewed.fullName
      });
      sendSuccess(res, { ...reviewed, invitation });
      return;
    }
    sendSuccess(res, reviewed);
  }
};
