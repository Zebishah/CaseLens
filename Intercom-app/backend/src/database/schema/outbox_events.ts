import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { inboundEvents } from './inbound_events.js';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: serial('id').primaryKey(),
    inboundEventId: integer('inbound_event_id')
      .notNull()
      .references(() => inboundEvents.id, { onDelete: 'cascade' }),
    jobName: varchar('job_name', { length: 64 }).notNull(),
    jobId: varchar('job_id', { length: 255 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorMessage: text('last_error_message'),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true })
  },
  (table) => [
    index('outbox_events_status_idx').on(table.status),
    index('outbox_events_job_id_idx').on(table.jobId)
  ]
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
