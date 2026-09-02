/**
 * Fetch one conversation from Intercom API (SM3 client).
 * Usage: npm run intercom:fetch -- <intercom_conversation_id>
 * Example: npm run intercom:fetch -- 123456789
 */
import { intercomClient } from '../src/modules/intercom/intercom.client.js';

const intercomId = process.argv[2];

if (!intercomId) {
  console.error('Usage: npm run intercom:fetch -- <intercom_conversation_id>');
  process.exit(1);
}

try {
  const conversation = await intercomClient.getConversation(intercomId);
  console.log('\n--- Intercom conversation ---');
  console.log(JSON.stringify(conversation, null, 2));
} catch (error) {
  console.error('Failed to fetch conversation:', error instanceof Error ? error.message : error);
  process.exit(1);
}
