import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOrderedMigrations } from './migration-runner.core.js';
import { PORTFOLIO_MIGRATIONS } from './migration-registry.js';
import { withScriptPgClient } from './pg-script-client.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const migrations = PORTFOLIO_MIGRATIONS.map(({ id, file }) => ({
  id,
  sql: readFileSync(path.join(scriptsDir, file), 'utf8')
}));

await withScriptPgClient(async (client) => {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['hr-intercom-schema-migrations']);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id varchar(120) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await runOrderedMigrations(migrations, {
      async isApplied(id) {
        const result = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
        return result.rowCount > 0;
      },
      async apply(migration) {
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    });

    if (applied.length === 0) {
      console.log('Database schema is up to date.');
    } else {
      console.log(`Applied ${applied.length} database migration(s): ${applied.join(', ')}`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['hr-intercom-schema-migrations']);
  }
});
