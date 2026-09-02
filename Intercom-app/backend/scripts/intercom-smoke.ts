/**
 * Live Intercom connectivity check. Never prints the access token or client secret.
 *
 *   npm run intercom:smoke
 *
 * Optional write probe (creates no notes/tags; fetches one conversation if provided):
 *   INTERCOM_SMOKE_CONVERSATION_ID=123 npm run intercom:smoke -- --read-conversation
 */
import { env } from '../src/config/env.config.js';
import { intercomConfig } from '../src/config/intercom.config.js';
import { intercomClient } from '../src/modules/intercom/intercom.client.js';

const secretLike = /token|secret|authorization|bearer/i;

const printSafe = (label: string, value: string | boolean | null): void => {
  const text = value == null ? '—' : String(value);
  if (secretLike.test(label) || secretLike.test(text)) {
    console.log(`${label}: [redacted]`);
    return;
  }
  console.log(`${label}: ${text}`);
};

if (!env.INTERCOM_ENABLED) {
  console.error('INTERCOM_ENABLED is false. Enable Intercom in backend .env to run this smoke check.');
  process.exit(1);
}

const readConversation = process.argv.includes('--read-conversation');
const conversationId = process.env.INTERCOM_SMOKE_CONVERSATION_ID?.trim();

try {
  const me = await intercomClient.getMe();
  const adminMatches = Boolean(me.adminId) && me.adminId === intercomConfig.adminId;
  const workspaceMatches = Boolean(me.appId) && me.appId === intercomConfig.workspaceId;

  printSafe('tokenValid', true);
  printSafe('adminId', me.adminId || null);
  printSafe('configuredAdminIdMatches', adminMatches);
  printSafe('appId', me.appId);
  printSafe('configuredWorkspaceIdMatches', workspaceMatches);
  printSafe('appName', me.appName);
  printSafe('apiVersion', me.apiVersion);
  printSafe('apiBaseUrl', me.regionHint);

  if (readConversation) {
    if (!conversationId) {
      console.error('Pass INTERCOM_SMOKE_CONVERSATION_ID to use --read-conversation.');
      process.exit(1);
    }
    const conversation = await intercomClient.getConversation(conversationId);
    printSafe('conversationId', String(conversation.id));
    printSafe('conversationState', conversation.state ?? null);
  }

  if (!adminMatches) {
    console.error('Configured INTERCOM_ADMIN_ID does not match GET /me id.');
    process.exit(2);
  }
  if (me.appId && !workspaceMatches) {
    console.error('Configured INTERCOM_WORKSPACE_ID does not match GET /me app id.');
    process.exit(2);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (secretLike.test(message)) {
    console.error('Intercom smoke failed (details redacted).');
  } else {
    console.error('Intercom smoke failed:', message);
  }
  process.exit(1);
}
