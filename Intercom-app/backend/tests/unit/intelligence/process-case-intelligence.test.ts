import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockRunOnce = jest.fn(async () => undefined);
const mockFindById = jest.fn();

await jest.unstable_mockModule('../../../src/modules/intelligence/intelligence-processing.lock.js', () => ({
  runIntelligenceOnce: mockRunOnce
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    findById: mockFindById
  }
}));

const { processCaseIntelligence } = await import(
  '../../../src/modules/intelligence/process-case-intelligence.js'
);

describe('processCaseIntelligence', () => {
  beforeEach(() => {
    mockRunOnce.mockClear();
    mockFindById.mockReset();
  });

  test('delegates to the shared intelligence lock/processor', async () => {
    mockFindById.mockResolvedValue({
      id: 9,
      intercomId: 'demo:evt',
      source: 'demo',
      processingMode: 'fixture'
    });

    await processCaseIntelligence({ conversationId: 9, source: 'inline' });

    expect(mockRunOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 9,
        intercomId: 'demo:evt',
        skipSync: true,
        skipPeerRefresh: true,
        source: 'worker'
      })
    );
  });

  test('Intercom-originated cases refresh from Intercom when the adapter is enabled', async () => {
    mockFindById.mockResolvedValue({
      id: 12,
      intercomId: '123456',
      source: 'intercom',
      processingMode: 'live'
    });

    await processCaseIntelligence({ conversationId: 12, source: 'worker' });

    expect(mockRunOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 12,
        intercomId: '123456',
        skipSync: false,
        source: 'worker'
      })
    );
  });
});
