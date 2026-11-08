import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  kind: varchar('kind', { length: 12 }).notNull().default('link'),
  attemptCount: integer('attempt_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ userIdx: index('email_verifications_user_idx').on(table.userId) }));
