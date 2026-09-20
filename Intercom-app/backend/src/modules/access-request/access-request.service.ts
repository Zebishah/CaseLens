import { AppError } from '../../utils/error.util.js';
import {
  accessRequestRepository,
  type AccessRequestStatus
} from './access-request.repository.js';

export type SubmitAccessRequest = {
  fullName: string;
  workEmail: string;
  organization?: string;
  role?: string;
  workspaceId?: string;
  purpose: string;
};

const clean = (value: string): string => value.trim().replace(/\s+/g, ' ');

const cleanWorkspaceId = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

export const accessRequestService = {
  async submit(input: SubmitAccessRequest): Promise<{ received: true }> {
    const workEmail = input.workEmail.trim().toLowerCase();
    const existing = await accessRequestRepository.findPendingByEmail(workEmail);

    // Return the same response for a new or existing request to avoid exposing request state.
    if (!existing) {
      await accessRequestRepository.create({
        fullName: clean(input.fullName),
        workEmail,
        organization: input.organization ? clean(input.organization) : undefined,
        role: input.role ? clean(input.role) : undefined,
        workspaceId: cleanWorkspaceId(input.workspaceId),
        purpose: clean(input.purpose),
        consentAt: new Date()
      });
    }

    return { received: true };
  },

  async status(workEmail: string) {
    const row = await accessRequestRepository.findLatestByEmail(workEmail.trim().toLowerCase());
    if (!row) {
      return null;
    }
    return {
      status: row.status,
      workspaceId: row.workspaceId,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt
    };
  },

  async list(status?: AccessRequestStatus) {
    return accessRequestRepository.list(status);
  },

  async review(id: number, status: AccessRequestStatus, reviewNote?: string) {
    const row = await accessRequestRepository.updateStatus(id, status, reviewNote?.trim());
    if (!row) {
      throw AppError.notFound('Access request not found');
    }
    return row;
  }
};
