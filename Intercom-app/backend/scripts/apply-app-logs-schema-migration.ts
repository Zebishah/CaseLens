/**
 * Creates app_logs table for persistent error/warn logging.
 *
 * Usage: npm run db:migrate-app-logs
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

const sqlPath = path.join(backendRoot, 'migrate-app-logs-schema.sql');
const sql = readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === 'production' && !databaseUrl.includes('localhost')
      ? { rejectUnauthorized: false }
      : undefined
});

try {
  await pool.query(sql);
  console.info('app_logs schema migration applied successfully.');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
