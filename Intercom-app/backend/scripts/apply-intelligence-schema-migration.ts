/**
 * Applies intelligence schema changes when `npm run db:push` fails with Postgres 42P16.
 *
 * Usage: tsx scripts/apply-intelligence-schema-migration.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendRoot, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is missing from backend/.env');
  process.exit(1);
}

const sqlPath = path.join(backendRoot, 'migrate-intelligence-schema.sql');
const sql = readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.info('Intelligence schema migration applied successfully.');
  console.info('  - conversations.reporter_name / reporter_email');
  console.info('  - conversations.extracted_names');
  console.info('  - conversations.case_type');
  console.info('  - conversation_employees table');
  console.info('');
  console.info('Restart npm run dev and retry the webhook.');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
