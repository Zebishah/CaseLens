import { withScriptPgClient } from './pg-script-client.js';

const extensions = ['vector', 'pg_trgm'] as const;

try {
  await withScriptPgClient(async (client) => {
    for (const extension of extensions) {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
      console.info(`Extension enabled: ${extension}`);
    }
  });
} catch (error: unknown) {
  console.error('Failed to enable extensions:', error);
  console.error(
    '\nIf you use a host without pgvector, use local Docker Postgres:\n' +
      '  docker compose up -d\n' +
      '  DATABASE_URL=postgresql://user:password@localhost:5432/db_name\n'
  );
  process.exit(1);
}
