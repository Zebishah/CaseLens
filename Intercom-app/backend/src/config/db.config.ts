import { normalizePostgresUrl } from '../database/postgres-url.util.js';
import { env } from './env.config.js';

export const dbConfig = {
  databaseUrl: normalizePostgresUrl(env.DATABASE_URL)
};
