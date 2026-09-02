import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';

export const demoSessions = pgTable(
  'demo_sessions',
  {
    id: serial('id').primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    receivingAddress: varchar('receiving_address', { length: 320 }).notNull(),
    emailCount: integer('email_count').notNull().default(0),
    maxEmails: integer('max_emails').notNull(),
    caseSubmissionCount: integer('case_submission_count').notNull().default(0),
    maxCaseSubmissions: integer('max_case_submissions').notNull(),
    liveLlmCount: integer('live_llm_count').notNull().default(0),
    maxLiveLlm: integer('max_live_llm').notNull(),
    active: boolean('active').notNull().default(true),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
  },
  (table) => [
    index('demo_sessions_expires_at_idx').on(table.expiresAt),
    index('demo_sessions_receiving_address_idx').on(table.receivingAddress)
  ]
);

export type DemoSessionRow = typeof demoSessions.$inferSelect;
