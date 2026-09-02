import { integer, pgTable, serial, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

/** Always-CC contacts for a company (not store-specific). */
export const companyFixedContacts = pgTable(
  'company_fixed_contacts',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 128 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('company_fixed_contacts_company_id_idx').on(table.companyId)]
);

export type CompanyFixedContactRow = typeof companyFixedContacts.$inferSelect;
