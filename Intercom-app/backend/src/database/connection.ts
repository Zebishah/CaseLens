import dns from 'node:dns';
import net from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.config.js';
import { dbConfig } from '../config/db.config.js';
import { logger } from '../config/logger.config.js';
import * as schema from './schema/index.js';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const isLocalPostgres = /localhost|127\.0\.0\.1/i.test(dbConfig.databaseUrl);

const pool = new pg.Pool({
  connectionString: dbConfig.databaseUrl,
  connectionTimeoutMillis: 30_000,
  idleTimeoutMillis: 20_000,
  max: env.DATABASE_POOL_MAX,
  ssl: isLocalPostgres ? undefined : { rejectUnauthorized: false }
});

/**
 * Idle clients can emit errors when the remote DB/proxy closes the socket
 * (common on free Render + Railway). Without this listener, Node treats it as
 * an unhandled 'error' event and exits with status 1.
 */
pool.on('error', (error) => {
  logger.error('[database] Idle client error — connection discarded, pool will reconnect', {
    message: error.message,
    code: (error as NodeJS.ErrnoException).code
  });
});

export const db = drizzle(pool, { schema });
export { pool };
export type Database = typeof db;
