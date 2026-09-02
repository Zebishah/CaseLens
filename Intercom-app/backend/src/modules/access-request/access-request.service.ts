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
  purpose: string;
};

const clean = (value: string): string => value.trim().replace(/\s+/g, ' ');

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
        purpose: clean(input.purpose),
        consentAt: new Date()
      });
    }

    return { received: true };
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
