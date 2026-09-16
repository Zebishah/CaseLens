import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn(async () => undefined);
const mockGetSharedRedis = jest.fn();
const mockIsBullmq = jest.fn(() => false);
const mockIsApify = jest.fn(() => false);
const mockShouldStartWorkers = jest.fn(() => false);

await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
  pool: { query: mockQuery },
  db: {}
}));

await jest.unstable_mockModule('../../../src/config/redis.config.js', () => ({
  getSharedRedis: mockGetSharedRedis
}));

await jest.unstable_mockModule('../../../src/config/job-processing.js', () => ({
  isBullmqJobProcessing: mockIsBullmq,
  isApifyJobProcessing: mockIsApify,
  shouldStartQueueWorkers: mockShouldStartWorkers
}));

const { healthService } = await import('../../../src/modules/health/health.service.js');
const { env } = await import('../../../src/config/env.config.js');

describe('healthService readiness', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue(undefined);
    mockGetSharedRedis.mockReset();
    mockIsBullmq.mockReset();
    mockIsApify.mockReset();
    mockShouldStartWorkers.mockReset();
    mockIsBullmq.mockReturnValue(false);
    mockIsApify.mockReturnValue(false);
    mockShouldStartWorkers.mockReturnValue(false);
  });

  test('inline mode is ready with Postgres and does not touch Redis', async () => {
    mockIsBullmq.mockReturnValue(false);

    const result = await healthService.readiness();

    expect(result).toEqual({
      status: 'ready',
      postgres: 'up',
      redis: 'disabled'
    });
    expect(mockGetSharedRedis).not.toHaveBeenCalled();
  });

  test('bullmq mode requires a Redis ping', async () => {
    mockIsBullmq.mockReturnValue(true);
    mockGetSharedRedis.mockReturnValue({
      ping: async () => 'PONG'
    });

    const result = await healthService.readiness();

    expect(result).toEqual({
      status: 'ready',
      postgres: 'up',
      redis: 'up'
    });
    expect(mockGetSharedRedis).toHaveBeenCalled();
  });

  test('apify mode treats Redis as disabled and exposes only safe flags', async () => {
    mockIsApify.mockReturnValue(true);
    env.APIFY_API_TOKEN = 'unit-test-token';
    env.APIFY_ACTOR_ID = 'owner~hr-intelligence-worker';
    const result = await healthService.readiness();
    expect(result).toEqual({ status: 'ready', postgres: 'up', redis: 'disabled' });
    expect(mockGetSharedRedis).not.toHaveBeenCalled();
    expect(healthService.processFlags()).toMatchObject({
      jobProcessingMode: expect.any(String),
      apifyConfigured: true,
      workersEnabled: false
    });
    expect(JSON.stringify(healthService.processFlags())).not.toContain('token');
  });
});
