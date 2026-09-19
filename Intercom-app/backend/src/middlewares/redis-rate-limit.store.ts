import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger.config.js';
import { getSharedRedis } from '../config/redis.config.js';

type RateLimitOptions = NonNullable<Parameters<typeof rateLimit>[0]>;
type RateLimitStore = {
  localKeys?: boolean;
  prefix?: string;
  init?: (options: RateLimitOptions) => void;
  increment: (key: string) => Promise<{ totalHits: number; resetTime: Date }>;
  decrement: (key: string) => Promise<void> | void;
  resetKey: (key: string) => Promise<void> | void;
  shutdown?: () => Promise<void> | void;
};

const INCREMENT_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { total, redis.call('PTTL', KEYS[1]) }
`;

const DECREMENT_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) > 0 then redis.call('DECR', KEYS[1]) end
return 1
`;

const RESET_SCRIPT = `return redis.call('DEL', KEYS[1])`;
const logCooldown = new Map<string, number>();

const logStoreFailure = (namespace: string, operation: string): void => {
  const identity = `${namespace}:${operation}`;
  const now = Date.now();
  if ((logCooldown.get(identity) ?? 0) > now) return;
  logCooldown.set(identity, now + 60_000);
  logger.warn('[redis] Rate-limit store unavailable; using this instance local counter', {
    namespace,
    operation
  });
};

const createMemoryStore = (): RateLimitStore => {
  let windowMs = 60_000;
  let cleanupTimer: NodeJS.Timeout | undefined;
  const clients = new Map<string, { totalHits: number; resetTime: Date }>();

  const getClient = (key: string) => {
    const current = clients.get(key);
    if (current && current.resetTime.getTime() > Date.now()) return current;
    const next = { totalHits: 0, resetTime: new Date(Date.now() + windowMs) };
    clients.set(key, next);
    return next;
  };

  return {
    localKeys: true,
    init(options) {
      windowMs = options.windowMs ?? windowMs;
      cleanupTimer ??= setInterval(() => {
        const now = Date.now();
        for (const [key, value] of clients) {
          if (value.resetTime.getTime() <= now) clients.delete(key);
        }
      }, Math.max(windowMs, 1_000));
      cleanupTimer.unref();
    },
    async increment(key) {
      const client = getClient(key);
      client.totalHits += 1;
      return { totalHits: client.totalHits, resetTime: client.resetTime };
    },
    async decrement(key) {
      const client = clients.get(key);
      if (client && client.resetTime.getTime() > Date.now()) {
        client.totalHits = Math.max(0, client.totalHits - 1);
      }
    },
    async resetKey(key) {
      clients.delete(key);
    },
    shutdown() {
      if (cleanupTimer) clearInterval(cleanupTimer);
      cleanupTimer = undefined;
      clients.clear();
    }
  };
};

const digestIdentity = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * Redis counters use an atomic Lua increment with a first-hit TTL. On a Redis
 * outage this instance falls back to its bounded in-memory window store so the
 * API remains available and still applies a local limit.
 */
export const createRedisRateLimitStore = (
  namespace: string,
  getRedis: () => Redis | null = getSharedRedis
): RateLimitStore => {
  const fallback = createMemoryStore();
  let windowMs = 60_000;
  const keyFor = (key: string) => `hr:ratelimit:${namespace}:${digestIdentity(key)}`;

  const useFallback = async <T>(operation: string, local: () => Promise<T>): Promise<T> => {
    logStoreFailure(namespace, operation);
    return local();
  };

  return {
    localKeys: false,
    prefix: `hr:ratelimit:${namespace}:`,
    init(options) {
      windowMs = options.windowMs ?? windowMs;
      fallback.init?.(options);
    },
    async increment(key) {
      try {
        const redis = getRedis();
        if (!redis) return useFallback('increment', () => fallback.increment(key));
        const result = (await redis.eval(
          INCREMENT_SCRIPT,
          1,
          keyFor(key),
          String(windowMs)
        )) as [number | string, number | string];
        const totalHits = Number(result[0]);
        const ttlMs = Number(result[1]);
        if (!Number.isFinite(totalHits) || !Number.isFinite(ttlMs)) {
          throw new Error('Unexpected Redis rate-limit response');
        }
        return {
          totalHits,
          resetTime: new Date(Date.now() + Math.max(ttlMs, 0))
        };
      } catch {
        return useFallback('increment', () => fallback.increment(key));
      }
    },
    async decrement(key) {
      try {
        const redis = getRedis();
        if (!redis) return useFallback('decrement', async () => fallback.decrement(key));
        await redis.eval(DECREMENT_SCRIPT, 1, keyFor(key));
      } catch {
        return useFallback('decrement', async () => fallback.decrement(key));
      }
    },
    async resetKey(key) {
      try {
        const redis = getRedis();
        if (!redis) return useFallback('reset', async () => fallback.resetKey(key));
        await redis.eval(RESET_SCRIPT, 1, keyFor(key));
      } catch {
        return useFallback('reset', async () => fallback.resetKey(key));
      }
    },
    shutdown() {
      fallback.shutdown?.();
    }
  };
};

export const createRateLimitStore = (
  namespace: string,
  redisConfigured: boolean,
  getRedis: () => Redis | null = getSharedRedis
): RateLimitStore =>
  redisConfigured ? createRedisRateLimitStore(namespace, getRedis) : createMemoryStore();
