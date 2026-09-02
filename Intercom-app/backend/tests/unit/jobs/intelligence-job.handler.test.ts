import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockProcess = jest.fn(async () => undefined);
const mockPeer = jest.fn(async () => ({ peerRefreshMs: 1 }));

await jest.unstable_mockModule('../../../src/modules/intelligence/process-case-intelligence.js', () => ({
  processCaseIntelligence: mockProcess
}));

await jest.unstable_mockModule(
  '../../../src/modules/intelligence/intelligence-sibling-reprocess.service.js',
  () => ({
    runDeferredPeerSnapshotRefresh: mockPeer
  })
);

const { handleIntelligenceJob } = await import('../../../src/jobs/intelligence-job.handler.js');

describe('handleIntelligenceJob', () => {
  beforeEach(() => {
    mockProcess.mockClear();
    mockPeer.mockClear();
  });

  test('propagates processing failures so BullMQ can retry them', async () => {
    mockProcess.mockRejectedValueOnce(new Error('temporary model timeout'));

    await expect(
      handleIntelligenceJob({
        conversationId: 3,
        intercomId: 'abc'
      })
    ).rejects.toThrow('temporary model timeout');
  });

  test('BullMQ worker handler calls the shared intelligence processor', async () => {
    await handleIntelligenceJob({
      conversationId: 3,
      intercomId: 'abc',
      forceReprocess: true,
      skipPeerRefresh: false
    });

    expect(mockProcess).toHaveBeenCalledWith({
      conversationId: 3,
      forceReprocess: true,
      skipPeerRefresh: false,
      source: 'worker'
    });
  });
});
