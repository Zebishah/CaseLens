import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withScriptPgClient } from './pg-script-client.js';

const sqlPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrate-refresh-sessions-schema.sql'
);

await withScriptPgClient(async (client) => {
  const existing = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'
     ) AS exists`
  );
  if (!existing.rows[0]?.exists) {
    throw new Error('The users table does not exist; apply the base schema first.');
  }
  await client.query(readFileSync(sqlPath, 'utf8'));
});

console.log('Refresh-session schema migration applied');
