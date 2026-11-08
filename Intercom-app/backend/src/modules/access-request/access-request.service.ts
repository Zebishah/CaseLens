import { AppError } from '../../utils/error.util.js';
import { env } from '../../config/env.config.js';
import { logger } from '../../config/logger.config.js';
import { escapeEmailHtml, sendAccountEmail } from '../auth/account-email.service.js';
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
      if (env.ACCESS_REQUEST_NOTIFY_EMAIL) {
        const name = clean(input.fullName);
        const organization = input.organization ? clean(input.organization) : 'Not provided';
        const role = input.role ? clean(input.role) : 'Not provided';
        const workspace = cleanWorkspaceId(input.workspaceId) || 'Not provided';
        const purpose = clean(input.purpose);
        const text = [
          'A new CaseLens access request was submitted.',
          `Name: ${name}`,
          `Email: ${workEmail}`,
          `Organization: ${organization}`,
          `Role: ${role}`,
          `Workspace ID: ${workspace}`,
          `Purpose: ${purpose}`,
          '',
          'Review the request in the CaseLens admin dashboard under Access management.'
        ].join('\n');
        const html = `<h2>New CaseLens access request</h2><p><strong>Name:</strong> ${escapeEmailHtml(name)}</p><p><strong>Email:</strong> ${escapeEmailHtml(workEmail)}</p><p><strong>Organization:</strong> ${escapeEmailHtml(organization)}</p><p><strong>Role:</strong> ${escapeEmailHtml(role)}</p><p><strong>Workspace ID:</strong> ${escapeEmailHtml(workspace)}</p><p><strong>Purpose:</strong> ${escapeEmailHtml(purpose)}</p><p>Review the request in CaseLens → Access management.</p>`;
        try {
          await sendAccountEmail({ email: env.ACCESS_REQUEST_NOTIFY_EMAIL, subject: 'CaseLens: new reviewer access request', text, html });
        } catch (error) {
          logger.error('[access-request] admin notification failed', {
            error: error instanceof Error ? error.message : 'Unknown notification error'
          });
        }
      }
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
