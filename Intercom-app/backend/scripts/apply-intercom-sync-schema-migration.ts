import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withScriptPgClient } from './pg-script-client.js';

const sqlPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrate-intercom-sync-schema.sql'
);

await withScriptPgClient(async (client) => {
  const existing = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'conversations'
     ) AS exists`
  );

  if (!existing.rows[0]?.exists) {
    throw new Error(
      'The conversations table does not exist yet. From Intercom-app/backend run: npm run db:push && npm run db:migrate-intercom-sync'
    );
  }

  await client.query(readFileSync(sqlPath, 'utf8'));
});

console.log('Intercom sync schema migration applied');
