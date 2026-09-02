/**
 * Clears old rows from app_logs to reclaim space after noisy logging.
 *
 * Usage:
 *   npm run db:cleanup-app-logs
 *   KEEP_DAYS=7 npm run db:cleanup-app-logs
 *   TRUNCATE_ALL=true npm run db:cleanup-app-logs
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendRoot, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is missing from backend/.env');
  process.exit(1);
}

const truncateAll = process.env.TRUNCATE_ALL === 'true';
const keepDays = Number(process.env.KEEP_DAYS ?? '7');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === 'production' && !databaseUrl.includes('localhost')
      ? { rejectUnauthorized: false }
      : undefined
});

try {
  const before = await pool.query('SELECT COUNT(*)::int AS n FROM app_logs');
  console.info('app_logs rows before cleanup:', before.rows[0]?.n ?? 0);

  if (truncateAll) {
    await pool.query('TRUNCATE app_logs RESTART IDENTITY');
    console.info('app_logs truncated.');
  } else {
    const result = await pool.query(
      `DELETE FROM app_logs WHERE created_at < NOW() - ($1::text || ' days')::interval`,
      [String(Math.max(1, keepDays))]
    );
    console.info(`Deleted rows older than ${keepDays} day(s):`, result.rowCount ?? 0);
  }

  const after = await pool.query('SELECT COUNT(*)::int AS n FROM app_logs');
  console.info('app_logs rows after cleanup:', after.rows[0]?.n ?? 0);
} catch (error) {
  console.error('Cleanup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
