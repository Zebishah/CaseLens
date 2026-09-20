import type { Request, Response } from 'express';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import {
  accessRequestService,
  type SubmitAccessRequest
} from './access-request.service.js';
import type { AccessRequestStatus } from './access-request.repository.js';
import { authService } from '../auth/auth.service.js';
import { intercomConfig } from '../../config/intercom.config.js';

const connectedInboxUrl = (workspaceId: string | null | undefined, status: string): string | null =>
  (status === 'approved' || status === 'invited') &&
  Boolean(workspaceId) &&
  intercomConfig.enabled &&
  workspaceId === intercomConfig.workspaceId
    ? `https://app.intercom.com/a/inbox/${encodeURIComponent(intercomConfig.workspaceId)}`
    : null;

export const accessRequestController = {
  async submit(req: Request, res: Response): Promise<void> {
    const result = await accessRequestService.submit(req.body as SubmitAccessRequest);
    sendSuccess(res, result, STATUS_CODES.CREATED);
  },

  async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as AccessRequestStatus | undefined;
    sendSuccess(res, await accessRequestService.list(status));
  },

  async status(req: Request, res: Response): Promise<void> {
    const result = await accessRequestService.status(req.user?.email ?? '');
    sendSuccess(res, result ? { ...result, connectedInboxUrl: connectedInboxUrl(result.workspaceId, result.status) } : null);
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
