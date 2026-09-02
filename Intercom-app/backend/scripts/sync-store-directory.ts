/**
 * Manual / one-off Box → Postgres store-directory sync.
 *
 * Usage: npm run sync:store-directory
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendRoot, '..', '.env') });

const { syncStoreDirectoryFromBox } = await import(
  '../src/modules/store-directory/store-directory.sync.service.js'
);

const result = await syncStoreDirectoryFromBox('cli');
if (!result.ok) {
  console.error('Store-directory sync failed:', result.errorMessage);
  process.exit(1);
}

if (result.skipped) {
  console.info('Sync skipped — Box env vars not configured.');
  process.exit(0);
}

console.info('Store-directory sync succeeded.', {
  storesUpserted: result.storesUpserted,
  sheetStats: result.sheetStats,
  missingSheets: result.missingSheets
});
process.exit(0);
