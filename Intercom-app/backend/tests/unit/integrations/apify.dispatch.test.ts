import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const records = new Map<string, Record<string, unknown>>();
let nextId = 1;
const mockStartActorRun = jest.fn(async () => ({ id: 'run-1', status: 'READY' }));
const mockCreateOrGet = jest.fn(async (values: Record<string, unknown>) => {
  const key = `${values.conversationId}:${values.jobType}:${values.dedupeKey}`;
  const existing = records.get(key);
  if (existing) return { row: existing, created: false };
  const row = { id: nextId++, ...values };
  records.set(key, row);
  return { row, created: true };
});
const mockAttach = jest.fn(async (id: number, apifyRunId: string) => {
  for (const row of records.values()) if (row.id === id) row.apifyRunId = apifyRunId;
});
const mockMarkFailed = jest.fn(async () => undefined);
const mockListRetryable = jest.fn(async () => [] as Array<Record<string, unknown>>);
const mockClaimRetry = jest.fn(async () => undefined as Record<string, unknown> | undefined);

await jest.unstable_mockModule('../../../src/modules/ingestion/intelligence-actor-run.repository.js', () => ({
  intelligenceActorRunRepository: {
    createOrGet: mockCreateOrGet,
    attachApifyRun: mockAttach,
    markFailed: mockMarkFailed,
    listRetryable: mockListRetryable,
    claimRetry: mockClaimRetry
  }
}));
await jest.unstable_mockModule('../../../src/integrations/apify/apify.client.js', () => ({
  apifyClient: () => ({ startActorRun: mockStartActorRun }),
  ApifyClientError: class ApifyClientError extends Error {
    constructor(public code: string, message: string, public status?: number) { super(message); }
  }
}));

const { dispatchApifyIntelligenceJob } = await import('../../../src/integrations/apify/apify-dispatch.service.js');

const job = (sourceRevision: string, forceReprocess = false) => ({
  conversationId: 17,
  intercomId: 'intercom-17',
  sourceRevision,
  skipSync: true,
  forceReprocess
});

describe('Apify intelligence dispatch deduplication', () => {
  beforeEach(() => {
    records.clear();
    nextId = 1;
    mockStartActorRun.mockReset();
    mockStartActorRun.mockResolvedValue({ id: 'run-1', status: 'READY' });
    mockCreateOrGet.mockClear();
    mockAttach.mockClear();
    mockMarkFailed.mockClear();
    mockListRetryable.mockReset();
    mockClaimRetry.mockReset();
  });

  test('coalesces repeated work for the same conversation revision', async () => {
    const first = await dispatchApifyIntelligenceJob(job('messages-5-updated-10'));
    const duplicate = await dispatchApifyIntelligenceJob(job('messages-5-updated-10'));
    expect(first.duplicate).toBe(false);
    expect(duplicate).toMatchObject({ runId: 'run-1', duplicate: true });
    expect(mockStartActorRun).toHaveBeenCalledTimes(1);
  });

  test('dispatches newer revisions as separate Actor executions', async () => {
    mockStartActorRun
      .mockResolvedValueOnce({ id: 'run-old', status: 'READY' })
      .mockResolvedValueOnce({ id: 'run-new', status: 'READY' });
    await dispatchApifyIntelligenceJob(job('messages-5-updated-10'));
    await dispatchApifyIntelligenceJob(job('messages-6-updated-11'));
    expect(mockStartActorRun).toHaveBeenCalledTimes(2);
  });

  test('force reprocess creates a new durable execution each time', async () => {
    await dispatchApifyIntelligenceJob(job('messages-5-updated-10', true));
    await dispatchApifyIntelligenceJob(job('messages-5-updated-10', true));
    const keys = [...records.values()].map((row) => row.dedupeKey);
    expect(new Set(keys).size).toBe(2);
    expect(mockStartActorRun).toHaveBeenCalledTimes(2);
  });

  test('retries failed Actor work with a bounded attempt number', async () => {
    const row = {
      id: 44,
      conversationId: 17,
      intercomId: 'intercom-17',
      sourceRevision: 'messages-5-updated-10',
      jobType: 'intelligence',
      attemptCount: 2,
      input: {
        type: 'intelligence',
        conversationId: 17,
        intercomId: 'intercom-17',
        sourceRevision: 'messages-5-updated-10',
        skipSync: true,
        forceReprocess: false,
        skipPeerRefresh: false
      }
    };
    mockListRetryable.mockResolvedValue([row]);
    mockClaimRetry.mockResolvedValue({ ...row, attemptCount: 3 });
    mockStartActorRun.mockResolvedValue({ id: 'retry-run', status: 'READY' });
    const { retryFailedActorRuns } = await import('../../../src/integrations/apify/apify-dispatch.service.js');
    await expect(retryFailedActorRuns(20)).resolves.toEqual({ dispatched: 1, failed: 0 });
    expect(mockStartActorRun).toHaveBeenCalledWith(expect.objectContaining({ executionId: 44, attempt: 3 }));
    expect(mockAttach).toHaveBeenCalledWith(44, 'retry-run');
  });

  test('does not start retry work when the bounded retry query returns none', async () => {
    mockListRetryable.mockResolvedValue([]);
    const { retryFailedActorRuns } = await import('../../../src/integrations/apify/apify-dispatch.service.js');
    await expect(retryFailedActorRuns(20)).resolves.toEqual({ dispatched: 0, failed: 0 });
    expect(mockStartActorRun).not.toHaveBeenCalled();
  });
});
