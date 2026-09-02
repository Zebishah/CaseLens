import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn(async () => undefined);
const mockGetSharedRedis = jest.fn();
const mockIsBullmq = jest.fn(() => false);

await jest.unstable_mockModule('../../../src/database/connection.js', () => ({
  pool: { query: mockQuery },
  db: {}
}));

await jest.unstable_mockModule('../../../src/config/redis.config.js', () => ({
  getSharedRedis: mockGetSharedRedis
}));

await jest.unstable_mockModule('../../../src/config/job-processing.js', () => ({
  isBullmqJobProcessing: mockIsBullmq
}));

const { healthService } = await import('../../../src/modules/health/health.service.js');

describe('healthService readiness', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue(undefined);
    mockGetSharedRedis.mockReset();
    mockIsBullmq.mockReset();
    mockIsBullmq.mockReturnValue(false);
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
});
