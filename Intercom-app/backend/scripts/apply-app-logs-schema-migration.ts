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

const safeErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' &&
    /^(?:[0-9A-Z]{5}|E[A-Z0-9_]{2,24}|ERR_[A-Z0-9_]{1,24})$/.test(code)
    ? code
    : undefined;
};

const safeErrorType = (error: unknown): string => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : 'UnknownError';
};

const safeErrorMessage = (error: unknown): string | undefined => {
  if (!(error instanceof Error) || !error.message.trim()) {
    return undefined;
  }

  return error.message
    .replaceAll(databaseUrl, '[redacted DATABASE_URL]')
    .replace(/(?:postgres(?:ql)?):\/\/[^\s'"<>]+/gi, '[redacted database URL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(password|token|secret|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/(password authentication failed for user )\S+/gi, '$1[redacted]')
    .slice(0, 400);
};

const safeMigrationError = (error: unknown): Record<string, unknown> => {
  const diagnostics: Record<string, unknown> = {
    errorType: safeErrorType(error),
    ...(safeErrorCode(error) ? { errorCode: safeErrorCode(error) } : {}),
    ...(safeErrorMessage(error) ? { message: safeErrorMessage(error) } : { message: 'No error message available.' })
  };

  if (error instanceof AggregateError) {
    diagnostics.causes = [...error.errors].slice(0, 5).map((cause) => ({
      errorType: safeErrorType(cause),
      ...(safeErrorCode(cause) ? { errorCode: safeErrorCode(cause) } : {})
    }));
  }

  return diagnostics;
};

try {
  await pool.query(sql);
  console.info('app_logs schema migration applied successfully.');
} catch (error) {
  console.error('Migration failed:', JSON.stringify(safeMigrationError(error)));
  process.exit(1);
} finally {
  await pool.end();
}
