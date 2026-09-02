/**
 * Dev/test store rows so Intercom conversations like 10206@demoops.co and
 * dd1976@demoops.co can exercise the CC sidebar without client store emails.
 *
 * Re-run after Box sync (sync deletes + reloads Excel, then re-applies these).
 * Usage: npm run db:seed-store-directory-test
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendRoot, '..', '.env') });

const { seedDevStoreDirectoryTestStores } = await import(
  '../src/modules/store-directory/store-directory.test-seed.js'
);

const result = await seedDevStoreDirectoryTestStores();
console.info('Dev store-directory test seed applied.', result);
process.exit(0);
