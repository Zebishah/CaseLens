import {
  shouldRefreshSiblingConversations,
  type ProcessIntelligenceInput
} from '../../../src/modules/intelligence/intelligence.processor.js';

describe('shouldRefreshSiblingConversations', () => {
  const base: ProcessIntelligenceInput = {
    conversationId: 1,
    intercomId: 'abc'
  };

  it('refreshes peers after normal processing', () => {
    expect(shouldRefreshSiblingConversations(base)).toBe(true);
  });

  it('does not cascade refresh from force reprocess', () => {
    expect(
      shouldRefreshSiblingConversations({
        ...base,
        forceReprocess: true
      })
    ).toBe(false);
  });
});
