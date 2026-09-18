import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockPendingOutbox = jest.fn();
const mockActorSummary = jest.fn();

await jest.unstable_mockModule('../../../src/config/env.config.js', () => ({
  env: { JOB_PROCESSING_MODE: 'apify', DATABASE_URL: 'postgresql://localhost/test' }
}));
await jest.unstable_mockModule('../../../src/database/connection.js', () => ({ db: {}, pool: {} }));
await jest.unstable_mockModule('../../../src/modules/ingestion/ingestion.repository.js', () => ({
  ingestionRepository: { countPendingOutbox: mockPendingOutbox }
}));
await jest.unstable_mockModule('../../../src/modules/ingestion/intelligence-actor-run.repository.js', () => ({
  intelligenceActorRunRepository: { operationalSummary: mockActorSummary }
}));

const { operationsController } = await import('../../../src/modules/operations/operations.controller.js');

describe('reviewer operational summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingOutbox.mockResolvedValue(2);
    mockActorSummary.mockResolvedValue({
      queued: 3,
      running: 1,
      completed: 18,
      failed: 2,
      retryableFailures: 1,
      latestFailureCode: 'APIFY_NOT_FOUND',
      recentRunDurationMs: 4500,
      rawPayload: 'must never be returned'
    });
  });

  test('returns aggregate processing and recovery evidence without provider payloads', async () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await operationsController.reviewerSummary({} as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: {
        jobProcessingMode: 'apify',
        actorRuns: {
          queued: 3,
          running: 1,
          completed: 18,
          failed: 2,
          retryableFailures: 1,
          latestFailureCode: 'APIFY_NOT_FOUND',
          recentRunDurationMs: 4500
        },
        pendingOutbox: 2,
        recoveryStatus: 'pending'
      }
    });
    expect(mockActorSummary).toHaveBeenCalledTimes(1);
  });
});
