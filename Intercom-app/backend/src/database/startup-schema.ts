import { logger } from '../config/logger.config.js';
import { pool } from './connection.js';

const RECRUITER_ACCESS_MIGRATION_LOCK = 914_027_311;

const recruiterAccessSchemaSql = `
  CREATE TABLE IF NOT EXISTS recruiter_access_requests (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    work_email VARCHAR(255) NOT NULL,
    organization VARCHAR(160),
    role VARCHAR(120),
    purpose VARCHAR(800) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'invited', 'declined', 'expired')),
    review_note VARCHAR(500),
    consent_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS recruiter_access_requests_status_created_idx
    ON recruiter_access_requests (status, created_at DESC);

  CREATE INDEX IF NOT EXISTS recruiter_access_requests_email_idx
    ON recruiter_access_requests (work_email);

  CREATE TABLE IF NOT EXISTS workspace_invites (
    id SERIAL PRIMARY KEY,
    access_request_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS workspace_invites_request_idx
    ON workspace_invites (access_request_id);

  CREATE INDEX IF NOT EXISTS workspace_invites_email_idx
    ON workspace_invites (email);

  CREATE INDEX IF NOT EXISTS workspace_invites_active_idx
    ON workspace_invites (expires_at, used_at);
`;

/**
 * Keeps the small recruiter-access feature deploy-safe on fresh portfolio databases.
 * The transaction-scoped advisory lock prevents concurrent instances from racing
 * while the idempotent DDL is applied.
 */
export async function ensureRequiredApplicationSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [
      RECRUITER_ACCESS_MIGRATION_LOCK
    ]);
    await client.query(recruiterAccessSchemaSql);
    await client.query('COMMIT');
    logger.info('[database] Required application schema is ready');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
