import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { conversations } from './conversations.js';

export const caseCorrections = pgTable('case_corrections', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  fieldName: varchar('field_name', { length: 64 }).notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  actorRole: varchar('actor_role', { length: 32 }).notNull().default('demo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const caseFeedback = pgTable('case_feedback', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  rating: varchar('rating', { length: 32 }).notNull(),
  comment: text('comment'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const aiEvaluationRuns = pgTable('ai_evaluation_runs', {
  id: serial('id').primaryKey(),
  datasetVersion: varchar('dataset_version', { length: 64 }).notNull(),
  promptVersion: varchar('prompt_version', { length: 64 }).notNull(),
  modelVersion: varchar('model_version', { length: 64 }).notNull(),
  metrics: jsonb('metrics').$type<Record<string, number | string | null>>().notNull(),
  environment: varchar('environment', { length: 32 }).notNull(),
  gitCommit: varchar('git_commit', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
