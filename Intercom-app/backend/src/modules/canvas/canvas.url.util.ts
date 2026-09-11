import { intercomConfig } from '../../config/intercom.config.js';
import { env } from '../../config/env.config.js';

/** Deep link to open a conversation in the Intercom inbox for the configured workspace. */
export const buildIntercomConversationUrl = (intercomConversationId: string): string =>
  `https://app.intercom.com/a/inbox/${intercomConfig.workspaceId}/inbox/conversation/${intercomConversationId}`;

/** Deep link from the Intercom Canvas to the protected persisted case view. */
export const buildHrIntelligenceCaseUrl = (
  caseId: number,
  baseUrl: string = env.PUBLIC_APP_URL
): string => new URL(`/cases/${caseId}`, baseUrl).toString();
