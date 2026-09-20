import { index, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const recruiterAccessRequests = pgTable(
  'recruiter_access_requests',
  {
    id: serial('id').primaryKey(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    workEmail: varchar('work_email', { length: 255 }).notNull(),
    organization: varchar('organization', { length: 160 }),
    role: varchar('role', { length: 120 }),
    workspaceId: varchar('workspace_id', { length: 64 }),
    purpose: varchar('purpose', { length: 800 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    reviewNote: varchar('review_note', { length: 500 }),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    statusCreatedIdx: index('recruiter_access_requests_status_created_idx').on(
      table.status,
      table.createdAt
    ),
    emailIdx: index('recruiter_access_requests_email_idx').on(table.workEmail)
  })
);

export type RecruiterAccessRequest = typeof recruiterAccessRequests.$inferSelect;
