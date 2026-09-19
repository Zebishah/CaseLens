import { jest } from '@jest/globals';
import type { Redis } from 'ioredis';
import { createRateLimitStore, createRedisRateLimitStore } from '../../../src/middlewares/redis-rate-limit.store.js';

describe('Redis-backed rate-limit store', () => {
  it('selects a Redis store when configured and hashes identity under a limiter namespace', async () => {
    const evalMock = jest.fn(async () => [1, 15_000]);
    const client = { eval: evalMock } as unknown as Redis;
    const store = createRateLimitStore('api', true, () => client);

    expect(store.localKeys).toBe(false);
    const result = await store.increment('198.51.100.7');

    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
    const key = evalMock.mock.calls[0]![2] as string;
    expect(key).toMatch(/^hr:ratelimit:api:[a-f0-9]{64}$/);
    expect(key).not.toContain('198.51.100.7');
  });

  it('uses independent namespaces for different limiters', async () => {
    const evalMock = jest.fn(async () => [1, 60_000]);
    const client = { eval: evalMock } as unknown as Redis;
    const apiStore = createRedisRateLimitStore('api', () => client);
    const loginStore = createRedisRateLimitStore('login', () => client);

    await apiStore.increment('same-client');
    await loginStore.increment('same-client');

    expect(evalMock.mock.calls[0]![2]).toMatch(/^hr:ratelimit:api:/);
    expect(evalMock.mock.calls[1]![2]).toMatch(/^hr:ratelimit:login:/);
  });

  it('keeps a per-instance memory limit when Redis is not configured', async () => {
    const store = createRateLimitStore('api', false, () => {
      throw new Error('must not access Redis');
    });

    expect(store.localKeys).toBe(true);
    expect((await store.increment('client')).totalHits).toBe(1);
    expect((await store.increment('client')).totalHits).toBe(2);
    await store.decrement('client');
    expect((await store.increment('client')).totalHits).toBe(2);
    store.shutdown?.();
  });

  it('falls back to a local counter when a Redis operation fails', async () => {
    const client = {
      eval: async () => {
        throw new Error('connection unavailable');
      }
    } as unknown as Redis;
    const store = createRedisRateLimitStore('assistant', () => client);

    expect((await store.increment('client')).totalHits).toBe(1);
    expect((await store.increment('client')).totalHits).toBe(2);
    await store.decrement('client');
    expect((await store.increment('client')).totalHits).toBe(2);
    store.shutdown?.();
  });
});
