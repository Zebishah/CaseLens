import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { conversations } from './conversations.js';
import { employeeIdentities } from './employee_identities.js';

export const conversationEmployees = pgTable(
  'conversation_employees',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    employeeIdentityId: integer('employee_identity_id')
      .notNull()
      .references(() => employeeIdentities.id, { onDelete: 'cascade' }),
    extractedName: varchar('extracted_name', { length: 255 }),
    confidenceScore: integer('confidence_score'),
    matchMethod: varchar('match_method', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('conversation_employees_conversation_identity_idx').on(
      table.conversationId,
      table.employeeIdentityId
    )
  ]
);
