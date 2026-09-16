import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const add = jest.fn(async () => ({ id: 'email-job-1' }));
const Queue = jest.fn().mockImplementation(() => ({ add, on: jest.fn() }));
const shouldDispatch = jest.fn(() => true);

await jest.unstable_mockModule('bullmq', () => ({ Queue }));
await jest.unstable_mockModule('../../../src/config/job-processing.js', () => ({
  shouldDispatchQueueJobs: shouldDispatch
}));
await jest.unstable_mockModule('../../../src/config/redis.connection.js', () => ({
  getBullMqConnection: () => ({ host: 'localhost', port: 6379 })
}));

const { enqueueResendEmailFetch } = await import('../../../src/modules/resend/resend.queue.js');
const { env } = await import('../../../src/config/env.config.js');
const initialMode = env.JOB_PROCESSING_MODE;

describe('Resend BullMQ queue retention', () => {
  beforeEach(() => {
    Queue.mockClear();
    add.mockClear();
    shouldDispatch.mockReset();
    shouldDispatch.mockReturnValue(true);
    env.JOB_PROCESSING_MODE = initialMode;
  });

  test('retains the existing BullMQ job and retry configuration', async () => {
    env.JOB_PROCESSING_MODE = 'bullmq';
    await enqueueResendEmailFetch({
      emailId: 'email-1',
      inboundEventId: 9,
      correlationId: 'corr-9',
      webhookId: 'hook-9'
    });
    expect(Queue).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('fetch-resend-email', expect.objectContaining({ emailId: 'email-1' }), expect.objectContaining({
      jobId: 'hook-9',
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 }
    }));
  });

  test('leaves Resend work recoverable instead of falsely dispatching it in Apify mode', async () => {
    env.JOB_PROCESSING_MODE = 'apify';
    await expect(enqueueResendEmailFetch({
      emailId: 'email-2',
      inboundEventId: 10,
      correlationId: 'corr-10',
      webhookId: 'hook-10'
    })).rejects.toThrow(/only in BullMQ mode/);
    expect(Queue).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
