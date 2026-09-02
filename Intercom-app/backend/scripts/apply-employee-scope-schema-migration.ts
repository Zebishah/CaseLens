/**
 * Applies employee store_number / company_domain schema when db:push is unavailable.
 *
 * Usage: npm run db:migrate-employee-scope
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

const sqlPath = path.join(backendRoot, 'migrate-employee-scope-schema.sql');
const sql = readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.info('Employee scope schema migration applied successfully.');
  console.info('  - employee_identities.store_number');
  console.info('  - employee_identities.company_domain');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
