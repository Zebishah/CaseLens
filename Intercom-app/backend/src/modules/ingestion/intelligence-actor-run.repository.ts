import { and, count, desc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import {
  intelligenceActorRuns,
  type IntelligenceActorRunRow
} from '../../database/schema/intelligence_actor_runs.js';

export type NewActorRun = typeof intelligenceActorRuns.$inferInsert;

export const intelligenceActorRunRepository = {
  async createOrGet(values: NewActorRun): Promise<{ row: IntelligenceActorRunRow; created: boolean }> {
    const [inserted] = await db
      .insert(intelligenceActorRuns)
      .values(values)
      .onConflictDoNothing({
        target: [
          intelligenceActorRuns.conversationId,
          intelligenceActorRuns.jobType,
          intelligenceActorRuns.dedupeKey
        ]
      })
      .returning();
    if (inserted) return { row: inserted, created: true };
    const [existing] = await db
      .select()
      .from(intelligenceActorRuns)
      .where(
        and(
          eq(intelligenceActorRuns.conversationId, values.conversationId!),
          eq(intelligenceActorRuns.jobType, values.jobType!),
          eq(intelligenceActorRuns.dedupeKey, values.dedupeKey!)
        )
      )
      .limit(1);
    if (!existing) throw new Error('Actor dispatch dedupe row could not be loaded.');
    return { row: existing, created: false };
  },

  async attachApifyRun(id: number, apifyRunId: string): Promise<void> {
    await db
      .update(intelligenceActorRuns)
      .set({ apifyRunId, updatedAt: new Date() })
      .where(eq(intelligenceActorRuns.id, id));
  },

  async markStarted(id: number): Promise<void> {
    await db
      .update(intelligenceActorRuns)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(intelligenceActorRuns.id, id));
  },

  async markCompleted(id: number): Promise<void> {
    await db
      .update(intelligenceActorRuns)
      .set({ status: 'completed', retryable: false, retryAfter: null, lastError: null, safeErrorCode: null, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(intelligenceActorRuns.id, id));
  },

  async markFailed(input: {
    id: number;
    code: string;
    safeMessage: string;
    retryable: boolean;
    attemptCount?: number;
  }): Promise<void> {
    await db
      .update(intelligenceActorRuns)
      .set({
        status: 'failed',
        retryable: input.retryable,
        retryAfter: input.retryable
          ? new Date(Date.now() + Math.min(60 * 60_000, 5 * 60_000 * 2 ** Math.max(0, (input.attemptCount ?? 1) - 1)))
          : null,
        safeErrorCode: input.code,
        lastError: input.safeMessage,
        finishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(intelligenceActorRuns.id, input.id));
  },

  async claimRetry(id: number, maxAttempts: number): Promise<IntelligenceActorRunRow | undefined> {
    const [row] = await db
      .update(intelligenceActorRuns)
      .set({
        status: 'queued',
        apifyRunId: null,
        retryAfter: null,
        attemptCount: sql`${intelligenceActorRuns.attemptCount} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(intelligenceActorRuns.id, id),
          eq(intelligenceActorRuns.status, 'failed'),
          eq(intelligenceActorRuns.retryable, true),
          lt(intelligenceActorRuns.attemptCount, maxAttempts),
          or(isNull(intelligenceActorRuns.retryAfter), lte(intelligenceActorRuns.retryAfter, new Date()))
        )
      )
      .returning();
    return row;
  },

  async listRetryable(maxAttempts: number, limit: number): Promise<IntelligenceActorRunRow[]> {
    return db
      .select()
      .from(intelligenceActorRuns)
      .where(
        and(
          eq(intelligenceActorRuns.status, 'failed'),
          eq(intelligenceActorRuns.retryable, true),
          lt(intelligenceActorRuns.attemptCount, maxAttempts),
          or(isNull(intelligenceActorRuns.retryAfter), lte(intelligenceActorRuns.retryAfter, new Date()))
        )
      )
      .limit(limit);
  },

  async listStale(limit: number, olderThan: Date): Promise<IntelligenceActorRunRow[]> {
    return db
      .select()
      .from(intelligenceActorRuns)
      .where(
        and(
          inArray(intelligenceActorRuns.status, ['queued', 'running']),
          lte(intelligenceActorRuns.updatedAt, olderThan)
        )
      )
      .limit(limit);
  },

  async operationalSummary(maxAttempts = 3) {
    const grouped = await db
      .select({ status: intelligenceActorRuns.status, total: count() })
      .from(intelligenceActorRuns)
      .groupBy(intelligenceActorRuns.status);
    const retryable = await db
      .select({ total: count() })
      .from(intelligenceActorRuns)
      .where(
        and(
          eq(intelligenceActorRuns.status, 'failed'),
          eq(intelligenceActorRuns.retryable, true),
          lt(intelligenceActorRuns.attemptCount, maxAttempts)
        )
      );
    const [latestFailure] = await db
      .select({ safeErrorCode: intelligenceActorRuns.safeErrorCode })
      .from(intelligenceActorRuns)
      .where(eq(intelligenceActorRuns.status, 'failed'))
      .orderBy(desc(intelligenceActorRuns.updatedAt))
      .limit(1);
    const [recentCompleted] = await db
      .select({
        durationMs: sql<number>`GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${intelligenceActorRuns.finishedAt} - ${intelligenceActorRuns.startedAt})) * 1000))`
      })
      .from(intelligenceActorRuns)
      .where(
        and(
          eq(intelligenceActorRuns.status, 'completed'),
          sql`${intelligenceActorRuns.startedAt} IS NOT NULL`,
          sql`${intelligenceActorRuns.finishedAt} IS NOT NULL`
        )
      )
      .orderBy(desc(intelligenceActorRuns.finishedAt))
      .limit(1);

    const byStatus = Object.fromEntries(grouped.map(({ status, total }) => [status, Number(total)]));
    const code = latestFailure?.safeErrorCode;
    return {
      queued: byStatus.queued ?? 0,
      running: byStatus.running ?? 0,
      completed: byStatus.completed ?? 0,
      failed: byStatus.failed ?? 0,
      retryableFailures: Number(retryable[0]?.total ?? 0),
      latestFailureCode: code && /^[A-Z0-9_]{1,64}$/.test(code) ? code : null,
      recentRunDurationMs:
        recentCompleted?.durationMs === undefined ? null : Number(recentCompleted.durationMs)
    };
  }
};
