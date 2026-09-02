import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const add = jest.fn(async () => ({ id: 'job-1' }));
const Queue = jest.fn().mockImplementation(() => ({
  add,
  on: jest.fn()
}));
const mockDispatch = jest.fn(() => false);
const mockProcessCaseIntelligence = jest.fn(async () => undefined);

await jest.unstable_mockModule('bullmq', () => ({ Queue }));

await jest.unstable_mockModule('../../../src/config/job-processing.js', () => ({
  shouldDispatchQueueJobs: mockDispatch
}));

await jest.unstable_mockModule(
  '../../../src/modules/intelligence/process-case-intelligence.js',
  () => ({
    processCaseIntelligence: mockProcessCaseIntelligence
  })
);

await jest.unstable_mockModule('../../../src/config/redis.connection.js', () => ({
  getBullMqConnection: () => ({ host: 'localhost', port: 6379 })
}));

const { enqueueIntercomIntelligence, startInlineIntelligenceJob } = await import(
  '../../../src/queues/intercom-intelligence.queue.js'
);

describe('enqueueIntercomIntelligence', () => {
  beforeEach(() => {
    add.mockClear();
    Queue.mockClear();
    mockDispatch.mockReset();
    mockProcessCaseIntelligence.mockClear();
  });

  test('does not instantiate a BullMQ Queue when dispatch is disabled', async () => {
    mockDispatch.mockReturnValue(false);

    await enqueueIntercomIntelligence({ conversationId: 9, intercomId: 'demo:9' });

    expect(Queue).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  test('inline helper runs processCaseIntelligence without BullMQ', async () => {
    await startInlineIntelligenceJob({
      conversationId: 53,
      intercomId: '215475752218048',
      forceReprocess: true,
      skipPeerRefresh: true
    });

    expect(Queue).not.toHaveBeenCalled();
    expect(mockProcessCaseIntelligence).toHaveBeenCalledWith({
      conversationId: 53,
      forceReprocess: true,
      skipPeerRefresh: true,
      source: 'inline'
    });
  });

  test('BullMQ mode enqueues through the shared intelligence queue', async () => {
    mockDispatch.mockReturnValue(true);

    await enqueueIntercomIntelligence(
      { conversationId: 9, intercomId: 'abc', skipSync: true },
      { jobId: 'intelligence-9' }
    );

    expect(Queue).toHaveBeenCalledWith(
      'intercom-intelligence-queue',
      expect.objectContaining({ connection: expect.any(Object) })
    );
    expect(add).toHaveBeenCalledWith(
      'process-intelligence',
      expect.objectContaining({ conversationId: 9, intercomId: 'abc' }),
      expect.objectContaining({ jobId: 'intelligence-9', attempts: 5 })
    );
  });
});
