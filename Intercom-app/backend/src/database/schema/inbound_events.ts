import {
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

export const inboundEvents = pgTable(
  'inbound_events',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 32 }).notNull(),
    externalEventId: varchar('external_event_id', { length: 255 }).notNull(),
    receivedEmailId: varchar('received_email_id', { length: 255 }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('received'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    lastErrorMessage: text('last_error_message'),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    conversationId: integer('conversation_id'),
    demoSessionId: integer('demo_session_id'),
    processingMode: varchar('processing_mode', { length: 16 }).notNull().default('fixture'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    processingAt: timestamp('processing_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('inbound_events_source_external_uidx').on(table.source, table.externalEventId),
    uniqueIndex('inbound_events_email_received_uidx').on(table.source, table.receivedEmailId),
    index('inbound_events_status_idx').on(table.status),
    index('inbound_events_completed_at_idx').on(table.completedAt),
    index('inbound_events_failed_at_idx').on(table.failedAt),
    index('inbound_events_correlation_idx').on(table.correlationId)
  ]
);

export type InboundEventRow = typeof inboundEvents.$inferSelect;
