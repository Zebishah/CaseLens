/**
 * Fetch existing conversations from Intercom API and save to PostgreSQL.
 *
 * Usage:
 *   npm run intercom:sync -- 215474091120045
 *   npm run intercom:sync -- 215474091120045 123456789
 */
import 'dotenv/config';
import { conversationService } from '../src/modules/conversation/conversation.service.js';

const intercomIds = process.argv.slice(2);

if (intercomIds.length === 0) {
  console.error('Usage: npm run intercom:sync -- <intercom_conversation_id> [more_ids...]');
  console.error('Example: npm run intercom:sync -- 215474091120045');
  process.exit(1);
}

console.info(`Syncing ${intercomIds.length} conversation(s) from Intercom...\n`);

for (const intercomId of intercomIds) {
  try {
    const record = await conversationService.syncFromIntercomApi(intercomId);
    console.info(`✓ Saved conversation #${record.id} (intercom_id=${record.intercomId})`);
    console.info(`  subject: ${record.subject ?? '—'}`);
    console.info(`  reporter: ${record.reporterName ?? '—'} <${record.reporterEmail ?? '—'}>`);
    console.info(`  intelligence_status: ${record.intelligenceStatus}\n`);
  } catch (error) {
    console.error(
      `✗ Failed for intercom_id=${intercomId}:`,
      error instanceof Error ? error.message : error
    );
  }
}
