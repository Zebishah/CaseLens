import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockPendingOutbox = jest.fn();
const mockReadiness = jest.fn();

await jest.unstable_mockModule('../../../src/config/env.config.js', () => ({
  env: { JOB_PROCESSING_MODE: 'apify', LLM_MODE: 'fixture', DATABASE_URL: 'postgresql://localhost/test' }
}));
await jest.unstable_mockModule('../../../src/database/connection.js', () => ({ db: {}, pool: {} }));
await jest.unstable_mockModule('../../../src/modules/ingestion/ingestion.repository.js', () => ({
  ingestionRepository: { countPendingOutbox: mockPendingOutbox }
}));
await jest.unstable_mockModule('../../../src/modules/health/health.service.js', () => ({
  healthService: { readiness: mockReadiness }
}));

const { operationsController } = await import('../../../src/modules/operations/operations.controller.js');

describe('operational metrics endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingOutbox.mockResolvedValue(0);
    mockReadiness.mockResolvedValue({ status: 'ready', postgres: 'up', redisConfigured: true, redisReachable: true });
  });

  test('returns aggregate health and counters without credentials or payloads', async () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await operationsController.metrics({} as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    const body = response.json.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ status: 'healthy', database: { reachable: true }, redis: { configured: true, reachable: true }, ai: { mode: 'fixture' } });
    expect(JSON.stringify(body)).not.toMatch(/password|secret|token|postgresql:\/\//i);
  });
});
