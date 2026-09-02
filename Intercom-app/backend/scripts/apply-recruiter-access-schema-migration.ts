import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withScriptPgClient } from './pg-script-client.js';

const sqlPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrate-recruiter-access-schema.sql'
);

await withScriptPgClient(async (client) => {
  await client.query(readFileSync(sqlPath, 'utf8'));
});

console.log('Recruiter access request schema migration applied');
