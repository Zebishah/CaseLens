import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { inboundEvents, type InboundEventRow } from '../../database/schema/inbound_events.js';
import { outboxEvents, type OutboxEventRow } from '../../database/schema/outbox_events.js';
import type { Database } from '../../database/connection.js';

type Executor = Pick<Database, 'insert' | 'update' | 'query' | 'select'>;

export const ingestionRepository = {
  async findBySourceExternalId(
    source: string,
    externalEventId: string,
    executor: Executor = db
  ): Promise<InboundEventRow | undefined> {
    const [row] = await executor
      .select()
      .from(inboundEvents)
      .where(and(eq(inboundEvents.source, source), eq(inboundEvents.externalEventId, externalEventId)))
      .limit(1);
    return row;
  },

  async findByReceivedEmailId(
    receivedEmailId: string,
    executor: Executor = db
  ): Promise<InboundEventRow | undefined> {
    const [row] = await executor
      .select()
      .from(inboundEvents)
      .where(and(eq(inboundEvents.source, 'email'), eq(inboundEvents.receivedEmailId, receivedEmailId)))
      .limit(1);
    return row;
  },

  async insertEvent(
    values: typeof inboundEvents.$inferInsert,
    executor: Executor = db
  ): Promise<InboundEventRow> {
    const [row] = await executor.insert(inboundEvents).values(values).returning();
    return row;
  },

  async insertOutbox(
    values: typeof outboxEvents.$inferInsert,
    executor: Executor = db
  ): Promise<OutboxEventRow> {
    const [row] = await executor.insert(outboxEvents).values(values).returning();
    return row;
  },

  async markQueued(id: number): Promise<void> {
    await db
      .update(inboundEvents)
      .set({ status: 'queued', queuedAt: new Date(), updatedAt: new Date() })
      .where(eq(inboundEvents.id, id));
  },

  async markDispatched(outboxId: number): Promise<void> {
    await db
      .update(outboxEvents)
      .set({ status: 'dispatched', dispatchedAt: new Date() })
      .where(eq(outboxEvents.id, outboxId));
  },

  async markFailed(
    id: number,
    errorCode: string,
    safeMessage: string,
    attemptCount: number
  ): Promise<void> {
    await db
      .update(inboundEvents)
      .set({
        status: 'failed',
        lastErrorCode: errorCode,
        lastErrorMessage: safeMessage,
        attemptCount,
        failedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(inboundEvents.id, id));
  },

  async markCompleted(id: number, conversationId: number): Promise<void> {
    await db
      .update(inboundEvents)
      .set({
        status: 'completed',
        conversationId,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(inboundEvents.id, id));
  },

  async markProcessing(id: number): Promise<void> {
    await db
      .update(inboundEvents)
      .set({
        status: 'processing',
        processingAt: new Date(),
        attemptCount: sql`${inboundEvents.attemptCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(inboundEvents.id, id));
  },

  async listPendingOutbox(limit = 50): Promise<OutboxEventRow[]> {
    return db.select().from(outboxEvents).where(eq(outboxEvents.status, 'pending')).limit(limit);
  },

  async countByStatus(status: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inboundEvents)
      .where(eq(inboundEvents.status, status));
    return row?.count ?? 0;
  },

  async incrementAttempt(id: number): Promise<void> {
    await db
      .update(inboundEvents)
      .set({
        attemptCount: sql`${inboundEvents.attemptCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(inboundEvents.id, id));
  },

  async countDuplicatesPrevented(): Promise<number> {
    const [row] = await db
      .select({
        count: sql<number>`coalesce(sum(greatest(${inboundEvents.attemptCount} - 1, 0)), 0)::int`
      })
      .from(inboundEvents);
    return row?.count ?? 0;
  },

  async latestBySource(source: string): Promise<InboundEventRow | undefined> {
    const [row] = await db
      .select()
      .from(inboundEvents)
      .where(eq(inboundEvents.source, source))
      .orderBy(sql`${inboundEvents.receivedAt} desc`)
      .limit(1);
    return row;
  },

  async countPendingOutbox(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(eq(outboxEvents.status, 'pending'));
    return row?.count ?? 0;
  }
};
