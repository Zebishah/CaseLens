import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import { employeeIdentities } from './employee_identities.js';

export const employeeAliases = pgTable(
  'employee_aliases',
  {
  id: serial('id').primaryKey(),
  employeeIdentityId: integer('employee_identity_id')
    .notNull()
    .references(() => employeeIdentities.id, { onDelete: 'cascade' }),
  alias: varchar('alias', { length: 255 }).notNull(),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }).notNull(),
  matchMethod: varchar('match_method', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('employee_aliases_alias_idx').on(table.alias)]
);
