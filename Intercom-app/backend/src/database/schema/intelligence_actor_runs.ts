import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { conversations } from './conversations.js';

export const intelligenceActorRuns = pgTable(
  'intelligence_actor_runs',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    intercomId: varchar('intercom_id', { length: 255 }).notNull(),
    sourceRevision: varchar('source_revision', { length: 160 }),
    jobType: varchar('job_type', { length: 48 }).notNull(),
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
    apifyRunId: varchar('apify_run_id', { length: 128 }),
    status: varchar('status', { length: 24 }).notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(1),
    forceReprocess: boolean('force_reprocess').notNull().default(false),
    skipSync: boolean('skip_sync').notNull().default(false),
    skipPeerRefresh: boolean('skip_peer_refresh').notNull().default(false),
    retryable: boolean('retryable').notNull().default(false),
    retryAfter: timestamp('retry_after', { withTimezone: true }),
    safeErrorCode: varchar('safe_error_code', { length: 64 }),
    lastError: text('last_error'),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('intelligence_actor_runs_dedupe_uidx').on(
      table.conversationId,
      table.jobType,
      table.dedupeKey
    ),
    uniqueIndex('intelligence_actor_runs_apify_run_uidx')
      .on(table.apifyRunId)
      .where(sql`${table.apifyRunId} IS NOT NULL`),
    index('intelligence_actor_runs_status_created_idx').on(table.status, table.createdAt),
    index('intelligence_actor_runs_retry_idx').on(table.status, table.retryAfter),
    index('intelligence_actor_runs_revision_idx').on(table.conversationId, table.sourceRevision)
  ]
);

export type IntelligenceActorRunRow = typeof intelligenceActorRuns.$inferSelect;
