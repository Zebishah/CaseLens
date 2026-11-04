import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { users } from '../../database/schema/users.js';
import { emailVerifications } from '../../database/schema/email_verifications.js';
import { refreshSessions } from '../../database/schema/refresh_sessions.js';
import { workspaceInvites } from '../../database/schema/workspace_invites.js';
import { userRepository } from '../user/user.repository.js';

export const authRepository = {
  findUserByEmail: userRepository.findByEmail,
  findUserById: userRepository.findById,

  async createVerification(input: typeof emailVerifications.$inferInsert): Promise<boolean> {
    return db.transaction(async (tx) => {
      // Serialize requests per account, including across API instances.
      const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).for('update');
      if (!user || user.email !== input.email || user.emailVerifiedAt) return false;
      const [recent] = await tx.select({ id: emailVerifications.id }).from(emailVerifications)
        .where(and(eq(emailVerifications.userId, input.userId),
          gt(emailVerifications.createdAt, new Date(Date.now() - 60_000)))).limit(1);
      if (recent) return false;
      await tx.insert(emailVerifications).values(input);
      return true;
    });
  },

  async discardVerification(tokenHash: string): Promise<void> {
    await db.delete(emailVerifications).where(eq(emailVerifications.tokenHash, tokenHash));
  },

  async verifyEmail(tokenHash: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [pending] = await tx.select().from(emailVerifications)
        .where(eq(emailVerifications.tokenHash, tokenHash)).limit(1);
      if (!pending) return false;
      // Lock the account before tokens, matching issuance and preventing deadlocks
      // when two outstanding links are confirmed concurrently.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, pending.userId)).for('update');
      const [verification] = await tx.update(emailVerifications).set({ usedAt: now })
        .where(and(eq(emailVerifications.tokenHash, tokenHash), isNull(emailVerifications.usedAt),
          gt(emailVerifications.expiresAt, now))).returning();
      if (!verification) return false;
      const [user] = await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now })
        .where(and(eq(users.id, verification.userId), eq(users.email, verification.email),
          isNull(users.emailVerifiedAt))).returning({ id: users.id });
      if (!user) return false;
      await tx.update(emailVerifications).set({ usedAt: now })
        .where(and(eq(emailVerifications.userId, user.id), isNull(emailVerifications.usedAt)));
      return true;
    });
  },

  async changeAdminPassword(userId: number, oldHash: string, password: string) {
    return db.transaction(async (tx) => {
      const [user] = await tx.update(users)
        .set({ password, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.password, oldHash), eq(users.role, 'admin')))
        .returning();
      if (!user) return undefined;
      await tx.update(refreshSessions).set({ revokedAt: new Date() })
        .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
      return user;
    });
  },

  async acceptInvite(tokenHash: string, password: string) {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [invite] = await tx.update(workspaceInvites).set({ usedAt: now })
        .where(and(eq(workspaceInvites.tokenHash, tokenHash), isNull(workspaceInvites.usedAt),
          gt(workspaceInvites.expiresAt, now))).returning();
      if (!invite) return undefined;
      const [user] = await tx.update(users)
        .set({ password, emailVerifiedAt: now, authVersion: sql`${users.authVersion} + 1`, updatedAt: now })
        .where(and(eq(users.id, invite.userId), eq(users.email, invite.email), eq(users.role, 'viewer')))
        .returning();
      if (!user) return undefined;
      await tx.update(refreshSessions).set({ revokedAt: now })
        .where(and(eq(refreshSessions.userId, user.id), isNull(refreshSessions.revokedAt)));
      return { user, accessRequestId: invite.accessRequestId };
    });
  }
};
