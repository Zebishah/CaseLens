import { intercomConfig } from '../../../src/config/intercom.config.js';
import {
  buildHrIntelligenceCaseUrl,
  buildIntercomConversationUrl
} from '../../../src/modules/canvas/canvas.url.util.js';

describe('canvas.url.util', () => {
  it('builds an inbox deep link for a conversation', () => {
    expect(buildIntercomConversationUrl('215474091120045')).toBe(
      `https://app.intercom.com/a/inbox/${intercomConfig.workspaceId}/inbox/conversation/215474091120045`
    );
  });

  it('builds a dashboard deep link for the exact persisted case', () => {
    expect(buildHrIntelligenceCaseUrl(42, 'https://portfolio.example.com')).toBe(
      'https://portfolio.example.com/cases/42'
    );
  });
});
