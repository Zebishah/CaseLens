import { intercomConfig } from '../../config/intercom.config.js';

/** Deep link to open a conversation in the Intercom inbox for the configured workspace. */
export const buildIntercomConversationUrl = (intercomConversationId: string): string =>
  `https://app.intercom.com/a/inbox/${intercomConfig.workspaceId}/inbox/conversation/${intercomConversationId}`;
