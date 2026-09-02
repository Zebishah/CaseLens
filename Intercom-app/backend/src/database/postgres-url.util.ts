/**
 * Neon dashboard URLs often include `channel_binding=require`.
 * node-pg does not complete that handshake on a cold pooler connection and
 * fails with ETIMEDOUT in under a second, so inbound Intercom webhooks 500
 * before the case is saved.
 */
export const normalizePostgresUrl = (databaseUrl: string): string =>
  databaseUrl
    .replace(/[&?]channel_binding=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
