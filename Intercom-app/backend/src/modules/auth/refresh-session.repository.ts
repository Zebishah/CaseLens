import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { refreshSessions } from '../../database/schema/refresh_sessions.js';

export type NewRefreshSession = {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
};

export const refreshSessionRepository = {
  async create(input: NewRefreshSession): Promise<void> {
    await db.delete(refreshSessions).where(lt(refreshSessions.expiresAt, new Date()));
    await db.insert(refreshSessions).values(input);
  },

  async rotate(input: NewRefreshSession & { currentTokenHash: string }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [consumed] = await tx
        .update(refreshSessions)
        .set({ revokedAt: now, lastUsedAt: now })
        .where(
          and(
            eq(refreshSessions.userId, input.userId),
            eq(refreshSessions.tokenHash, input.currentTokenHash),
            isNull(refreshSessions.revokedAt),
            gt(refreshSessions.expiresAt, now)
          )
        )
        .returning({ id: refreshSessions.id });

      if (!consumed) return false;

      await tx.insert(refreshSessions).values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt
      });
      return true;
    });
  },

  async revoke(tokenHash: string): Promise<void> {
    const now = new Date();
    await db
      .update(refreshSessions)
      .set({ revokedAt: now, lastUsedAt: now })
      .where(and(eq(refreshSessions.tokenHash, tokenHash), isNull(refreshSessions.revokedAt)));
  },

  async revokeAllForUser(userId: number): Promise<void> {
    const now = new Date();
    await db
      .update(refreshSessions)
      .set({ revokedAt: now })
      .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
  }
};
