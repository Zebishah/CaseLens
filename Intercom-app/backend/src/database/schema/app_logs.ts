import { jsonb, pgTable, serial, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';

/**
 * Persistent application logs (error + warn) for overnight / post-incident review
 * when Render log retention is limited.
 */
export const appLogs = pgTable(
  'app_logs',
  {
    id: serial('id').primaryKey(),
    level: varchar('level', { length: 16 }).notNull(),
    message: text('message').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    conversationId: varchar('conversation_id', { length: 64 }),
    intercomId: varchar('intercom_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('app_logs_created_at_idx').on(table.createdAt),
    index('app_logs_level_idx').on(table.level)
  ]
);

export type AppLogRow = typeof appLogs.$inferSelect;
