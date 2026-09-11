import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { workspaceInvites } from '../../database/schema/workspace_invites.js';

export const workspaceInviteRepository = {
  async create(values: typeof workspaceInvites.$inferInsert) {
    const [invite] = await db.insert(workspaceInvites).values(values).returning();
    return invite;
  },

  async revokeActiveForRequest(accessRequestId: number): Promise<void> {
    await db
      .update(workspaceInvites)
      .set({ usedAt: new Date() })
      .where(and(eq(workspaceInvites.accessRequestId, accessRequestId), isNull(workspaceInvites.usedAt)));
  },

  async findUsableByHash(tokenHash: string) {
    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.tokenHash, tokenHash),
          isNull(workspaceInvites.usedAt),
          gt(workspaceInvites.expiresAt, new Date())
        )
      )
      .limit(1);
    return invite;
  },

  async consume(id: number) {
    const [invite] = await db
      .update(workspaceInvites)
      .set({ usedAt: new Date() })
      .where(and(eq(workspaceInvites.id, id), isNull(workspaceInvites.usedAt), gt(workspaceInvites.expiresAt, new Date())))
      .returning();
    return invite;
  }
};
