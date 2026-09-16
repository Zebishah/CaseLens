import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const add = jest.fn(async () => ({ id: 'job-1' }));
const Queue = jest.fn().mockImplementation(() => ({
  add,
  on: jest.fn()
}));
const mockDispatch = jest.fn(() => false);
const mockProcessCaseIntelligence = jest.fn(async () => undefined);
const mockApifyDispatch = jest.fn(async () => ({ runId: 'actor-run-1', duplicate: false }));

await jest.unstable_mockModule('bullmq', () => ({ Queue }));

await jest.unstable_mockModule('../../../src/config/job-processing.js', () => ({
  shouldDispatchQueueJobs: mockDispatch
}));
await jest.unstable_mockModule('../../../src/integrations/apify/apify-dispatch.service.js', () => ({
  dispatchApifyIntelligenceJob: mockApifyDispatch
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
const { env } = await import('../../../src/config/env.config.js');
const initialMode = env.JOB_PROCESSING_MODE;
const initialNodeEnv = env.NODE_ENV;

describe('enqueueIntercomIntelligence', () => {
  beforeEach(() => {
    add.mockClear();
    Queue.mockClear();
    mockDispatch.mockReset();
    mockProcessCaseIntelligence.mockClear();
    mockApifyDispatch.mockClear();
    env.JOB_PROCESSING_MODE = initialMode;
    env.NODE_ENV = initialNodeEnv;
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

  test('inline mode starts the existing inline processor without Apify or Redis', async () => {
    env.JOB_PROCESSING_MODE = 'inline';
    env.NODE_ENV = 'production';
    mockDispatch.mockReturnValue(false);
    await enqueueIntercomIntelligence({ conversationId: 10, intercomId: 'ic-10' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockProcessCaseIntelligence).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      source: 'inline'
    }));
    expect(mockApifyDispatch).not.toHaveBeenCalled();
    expect(Queue).not.toHaveBeenCalled();
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
    expect(mockApifyDispatch).not.toHaveBeenCalled();
  });

  test('Apify mode dispatches asynchronously without initializing BullMQ or running the handler locally', async () => {
    env.JOB_PROCESSING_MODE = 'apify';
    mockDispatch.mockReturnValue(false);
    await enqueueIntercomIntelligence({ conversationId: 11, intercomId: 'ic-11' });
    expect(mockApifyDispatch).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 11 }));
    expect(Queue).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(mockProcessCaseIntelligence).not.toHaveBeenCalled();
  });
});
