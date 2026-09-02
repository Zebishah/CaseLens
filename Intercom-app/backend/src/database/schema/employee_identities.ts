import { index, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const employeeIdentities = pgTable(
  'employee_identities',
  {
  id: serial('id').primaryKey(),
  canonicalName: varchar('canonical_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  /** Store / location number from reporter email or name (e.g. 3456 in 3456@acmecorp.com). */
  storeNumber: varchar('store_number', { length: 50 }),
  /** Company email domain linked to this employee (e.g. acmecorp.com). */
  companyDomain: varchar('company_domain', { length: 255 }),
  intercomContactId: varchar('intercom_contact_id', { length: 100 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('employee_identities_store_number_idx').on(table.storeNumber),
    index('employee_identities_company_domain_idx').on(table.companyDomain)
  ]
);
