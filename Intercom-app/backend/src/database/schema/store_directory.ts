import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

/**
 * One row per store from the Box Excel store directories.
 * Lookup for CC recipients is by store_number only (not Intercom company name).
 */
export const storeDirectory = pgTable(
  'store_directory',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    storeNumber: varchar('store_number', { length: 64 }).notNull(),
    storeName: varchar('store_name', { length: 255 }),
    vpName: varchar('vp_name', { length: 255 }),
    vpEmail: varchar('vp_email', { length: 255 }),
    directorName: varchar('director_name', { length: 255 }),
    directorEmail: varchar('director_email', { length: 255 }),
    districtManagerName: varchar('district_manager_name', { length: 255 }),
    districtManagerEmail: varchar('district_manager_email', { length: 255 }),
    ownerName: varchar('owner_name', { length: 255 }),
    ownerEmail: varchar('owner_email', { length: 255 }),
    rawRow: jsonb('raw_row').$type<Record<string, string | null>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('store_directory_company_store_uidx').on(table.companyId, table.storeNumber),
    index('store_directory_store_number_idx').on(table.storeNumber)
  ]
);

export type StoreDirectoryRow = typeof storeDirectory.$inferSelect;
