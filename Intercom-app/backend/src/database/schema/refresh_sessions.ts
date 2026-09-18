import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
  },
  (table) => [
    index('refresh_sessions_user_revoked_idx').on(table.userId, table.revokedAt),
    index('refresh_sessions_expires_at_idx').on(table.expiresAt)
  ]
);
