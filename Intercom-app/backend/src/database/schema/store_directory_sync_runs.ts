import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const storeDirectorySyncRuns = pgTable('store_directory_sync_runs', {
  id: serial('id').primaryKey(),
  status: varchar('status', { length: 32 }).notNull(),
  source: varchar('source', { length: 64 }).notNull().default('box'),
  boxFileId: varchar('box_file_id', { length: 64 }),
  storesUpserted: integer('stores_upserted').notNull().default(0),
  errorMessage: text('error_message'),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true })
});

export type StoreDirectorySyncRunRow = typeof storeDirectorySyncRuns.$inferSelect;
