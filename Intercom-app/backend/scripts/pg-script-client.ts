import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { normalizePostgresUrl } from '../src/database/postgres-url.util.js';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

export const backendEnvPath = path.join(backendRoot, '.env');

export const getScriptDatabaseUrl = (): string => {
  const databaseUrl =
    process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is missing in ${backendEnvPath}. For Neon, set DATABASE_MIGRATION_URL to the direct (non-pooler) connection string for schema scripts.`
    );
  }
  return normalizePostgresUrl(databaseUrl);
};

const isLocalPostgres = (databaseUrl: string): boolean =>
  /localhost|127\.0\.0\.1/i.test(databaseUrl);

const createClient = (databaseUrl: string): pg.Client =>
  new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 30_000,
    ssl: isLocalPostgres(databaseUrl) ? undefined : { rejectUnauthorized: false }
  });

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const withScriptPgClient = async <T>(
  run: (client: pg.Client) => Promise<T>,
  attempts = 4
): Promise<T> => {
  const databaseUrl = getScriptDatabaseUrl();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = createClient(databaseUrl);
    try {
      await client.connect();
      try {
        return await run(client);
      } finally {
        await client.end();
      }
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      if (attempt < attempts) {
        const waitMs = attempt * 2_000;
        console.warn(
          `Postgres connection failed (attempt ${attempt}/${attempts}). Retrying in ${waitMs}ms…`
        );
        await delay(waitMs);
      }
    }
  }

  throw lastError;
};
