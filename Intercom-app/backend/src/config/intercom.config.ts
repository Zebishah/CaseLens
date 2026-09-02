import { env } from './env.config.js';
import { INTERCOM_API } from '../constants/intercom.constants.js';

const adminId = env.INTERCOM_ADMIN_ID ?? env.INTERCOM_BOT_ADMIN_ID ?? '';

export const intercomConfig = {
  enabled: env.INTERCOM_ENABLED,
  accessToken: env.INTERCOM_ACCESS_TOKEN ?? '',
  clientSecret: env.INTERCOM_CLIENT_SECRET ?? '',
  workspaceId: env.INTERCOM_WORKSPACE_ID ?? '',
  adminId,
  /** @deprecated Use adminId. Kept so existing note/tag callers keep working. */
  botAdminId: adminId,
  apiBaseUrl: env.INTERCOM_API_BASE_URL ?? INTERCOM_API.BASE_URL,
  apiVersion: env.INTERCOM_API_VERSION ?? INTERCOM_API.API_VERSION,
  writebackTagsEnabled: env.INTERCOM_WRITEBACK_TAGS_ENABLED
} as const;
