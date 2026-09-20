import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { employeeIdentities } from './employee_identities.js';

export const conversations = pgTable(
  'conversations',
  {
  id: serial('id').primaryKey(),
  intercomId: varchar('intercom_id', { length: 100 }).notNull().unique(),
  source: varchar('source', { length: 32 }).notNull().default('intercom'),
  correlationId: varchar('correlation_id', { length: 128 }),
  demoSessionId: integer('demo_session_id'),
  processingMode: varchar('processing_mode', { length: 16 }).notNull().default('live'),
  subject: text('subject'),
  status: varchar('status', { length: 50 }),
  reporterName: varchar('reporter_name', { length: 255 }),
  reporterEmail: varchar('reporter_email', { length: 255 }),
  /** Parsed from reporter email/name — numeric local part e.g. 3456@acmecorp.com */
  reporterStoreNumber: varchar('reporter_store_number', { length: 50 }),
  /** Parsed company email domain from reporter e.g. acmecorp.com */
  reporterCompanyDomain: varchar('reporter_company_domain', { length: 255 }),
  extractedNames: jsonb('extracted_names').$type<string[]>(),
  caseType: varchar('case_type', { length: 50 }),
  companyName: varchar('company_name', { length: 255 }),
  intercomContactId: varchar('intercom_contact_id', { length: 100 }),
  assignedIntercomAdminId: varchar('assigned_intercom_admin_id', { length: 100 }),
  employeeIdentityId: integer('employee_identity_id').references(() => employeeIdentities.id, {
    onDelete: 'set null'
  }),
  intelligenceStatus: varchar('intelligence_status', { length: 20 }).notNull().default('pending'),
  intelligenceSnapshot: jsonb('intelligence_snapshot').$type<IntelligenceSnapshot>(),
  intelligenceError: text('intelligence_error'),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  intercomSyncStatus: varchar('intercom_sync_status', { length: 32 }),
  intercomLastSyncedAt: timestamp('intercom_last_synced_at', { withTimezone: true }),
  intercomSyncError: text('intercom_sync_error'),
  intercomIntelligenceNoteId: varchar('intercom_intelligence_note_id', { length: 100 }),
  intercomSyncFingerprint: varchar('intercom_sync_fingerprint', { length: 64 }),
  intercomSyncTags: jsonb('intercom_sync_tags').$type<string[]>(),
  intercomSourceUpdatedAt: timestamp('intercom_source_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('conversations_employee_identity_id_idx').on(table.employeeIdentityId),
    index('conversations_intelligence_status_idx').on(table.intelligenceStatus),
    index('conversations_created_at_idx').on(table.createdAt),
    index('conversations_reporter_store_number_idx').on(table.reporterStoreNumber),
    index('conversations_reporter_company_domain_idx').on(table.reporterCompanyDomain)
  ]
);
