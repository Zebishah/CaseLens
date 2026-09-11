import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: serial('id').primaryKey(),
    accessRequestId: integer('access_request_id').notNull(),
    userId: integer('user_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    requestIdx: index('workspace_invites_request_idx').on(table.accessRequestId),
    emailIdx: index('workspace_invites_email_idx').on(table.email),
    activeIdx: index('workspace_invites_active_idx').on(table.expiresAt, table.usedAt)
  })
);

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
