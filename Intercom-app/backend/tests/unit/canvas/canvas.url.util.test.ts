import { intercomConfig } from '../../../src/config/intercom.config.js';
import { buildIntercomConversationUrl } from '../../../src/modules/canvas/canvas.url.util.js';

describe('canvas.url.util', () => {
  it('builds an inbox deep link for a conversation', () => {
    expect(buildIntercomConversationUrl('215474091120045')).toBe(
      `https://app.intercom.com/a/inbox/${intercomConfig.workspaceId}/inbox/conversation/215474091120045`
    );
  });
});
