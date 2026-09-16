import { afterAll, beforeEach, describe, expect, test, jest } from '@jest/globals';

const mockListPending = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
const mockMarkDispatched = jest.fn(async () => undefined);
const mockEnqueueIntelligence = jest.fn(async () => undefined);
const mockWithLock = jest.fn(async (_namespace: number, _id: number, operation: () => Promise<number>) => operation());

await jest.unstable_mockModule('../../../src/database/connection.js', () => ({ db: {} }));
await jest.unstable_mockModule('../../../src/modules/ingestion/ingestion.repository.js', () => ({
  ingestionRepository: {
    listPendingOutbox: mockListPending,
    markDispatched: mockMarkDispatched
  }
}));
await jest.unstable_mockModule('../../../src/queues/intercom-intelligence.queue.js', () => ({
  enqueueIntercomIntelligence: mockEnqueueIntelligence
}));
await jest.unstable_mockModule('../../../src/database/postgres-advisory-lock.js', () => ({
  ADVISORY_LOCK_NAMESPACE: { outboxRecovery: 42 },
  withPostgresAdvisoryLock: mockWithLock
}));

const { ingestionService } = await import('../../../src/modules/ingestion/ingestion.service.js');
const { env } = await import('../../../src/config/env.config.js');
const initialMode = env.JOB_PROCESSING_MODE;

const row = (id: number, payload: Record<string, unknown> = {}) => ({
  id,
  jobName: 'process-intelligence',
  jobId: `intelligence-${id}`,
  payload: { conversationId: id, intercomId: `ic-${id}`, sourceRevision: `${id}-0`, ...payload },
  status: 'pending',
  correlationId: `correlation-${id}`
});

describe('Apify outbox recovery', () => {
  beforeEach(() => {
    env.JOB_PROCESSING_MODE = 'apify';
    mockListPending.mockReset();
    mockMarkDispatched.mockReset();
    mockEnqueueIntelligence.mockReset();
    mockEnqueueIntelligence.mockResolvedValue(undefined);
    mockWithLock.mockClear();
  });

  afterAll(() => {
    env.JOB_PROCESSING_MODE = initialMode;
  });

  test('marks outbox dispatched only after the Actor dispatcher succeeds', async () => {
    const pending = row(7);
    mockListPending.mockResolvedValue([pending]);
    mockEnqueueIntelligence.mockRejectedValueOnce(new Error('Apify unavailable'));
    expect(await ingestionService.recoverPendingOutbox(20)).toBe(0);
    expect(mockMarkDispatched).not.toHaveBeenCalled();

    mockEnqueueIntelligence.mockResolvedValueOnce(undefined);
    expect(await ingestionService.recoverPendingOutbox(20)).toBe(1);
    expect(mockMarkDispatched).toHaveBeenCalledWith(7);
    expect(mockEnqueueIntelligence).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationId: 7, sourceRevision: '7-0' }),
      { jobId: 'intelligence-7' }
    );
  });

  test('caps recovery batches and takes a global advisory lock in Apify mode', async () => {
    mockListPending.mockResolvedValue([]);
    await ingestionService.recoverPendingOutbox(200);
    expect(mockListPending).toHaveBeenCalledWith(20);
    expect(mockWithLock).toHaveBeenCalledTimes(1);
  });

  test('preserves BullMQ recovery defaults and avoids the Apify advisory lock', async () => {
    env.JOB_PROCESSING_MODE = 'bullmq';
    mockListPending.mockResolvedValue([]);
    await ingestionService.recoverPendingOutbox();
    expect(mockListPending).toHaveBeenCalledWith(50);
    expect(mockWithLock).not.toHaveBeenCalled();
  });

  test('does not recursively dispatch a recovery job or mark unsupported Resend work dispatched', async () => {
    mockListPending.mockResolvedValue([
      { ...row(1), jobName: 'recover-pending-outbox' },
      { ...row(2), jobName: 'fetch-resend-email', payload: { emailId: 'email-2', inboundEventId: 2 } }
    ]);
    await ingestionService.recoverPendingOutbox(20);
    expect(mockEnqueueIntelligence).not.toHaveBeenCalled();
    expect(mockMarkDispatched).not.toHaveBeenCalled();
  });
});
