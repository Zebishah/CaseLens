import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import {
  recruiterAccessRequests,
  type RecruiterAccessRequest
} from '../../database/schema/recruiter_access_requests.js';

export type AccessRequestStatus = 'pending' | 'approved' | 'invited' | 'declined' | 'expired';

export type CreateAccessRequest = {
  fullName: string;
  workEmail: string;
  organization?: string;
  role?: string;
  workspaceId?: string;
  purpose: string;
  consentAt: Date;
};

export const accessRequestRepository = {
  async findPendingByEmail(workEmail: string): Promise<RecruiterAccessRequest | undefined> {
    return db.query.recruiterAccessRequests.findFirst({
      where: and(
        eq(recruiterAccessRequests.workEmail, workEmail),
        eq(recruiterAccessRequests.status, 'pending')
      )
    });
  },

  async findLatestByEmail(workEmail: string): Promise<RecruiterAccessRequest | undefined> {
    return db.query.recruiterAccessRequests.findFirst({
      where: eq(recruiterAccessRequests.workEmail, workEmail),
      orderBy: (requests, { desc }) => [desc(requests.createdAt)]
    });
  },

  async create(values: CreateAccessRequest): Promise<RecruiterAccessRequest> {
    const [row] = await db.insert(recruiterAccessRequests).values(values).returning();
    return row;
  },

  async list(status?: AccessRequestStatus): Promise<RecruiterAccessRequest[]> {
    const query = db.select().from(recruiterAccessRequests);
    return status
      ? query
          .where(eq(recruiterAccessRequests.status, status))
          .orderBy(desc(recruiterAccessRequests.createdAt))
          .limit(100)
      : query.orderBy(desc(recruiterAccessRequests.createdAt)).limit(100);
  },

  async updateStatus(
    id: number,
    status: AccessRequestStatus,
    reviewNote?: string
  ): Promise<RecruiterAccessRequest | undefined> {
    const [row] = await db
      .update(recruiterAccessRequests)
      .set({
        status,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(recruiterAccessRequests.id, id))
      .returning();
    return row;
  }
};
