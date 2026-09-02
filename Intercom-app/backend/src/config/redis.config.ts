import { Redis } from 'ioredis';
import { env } from './env.config.js';
import { createRedisClient } from './redis.connection.js';

let shared: Redis | null = null;

export const getSharedRedis = (): Redis | null => {
  if (env.JOB_PROCESSING_MODE !== 'bullmq' || !env.REDIS_URL) {
    return null;
  }

  if (!shared) {
    shared = createRedisClient('shared', env.REDIS_URL);
  }

  return shared;
};

/** @deprecated Prefer getSharedRedis() so inline mode never opens a Redis connection. */
export const redis = new Proxy({} as Redis, {
  get(_target, property, receiver) {
    const client = getSharedRedis();
    if (!client) {
      throw new Error('Redis is not configured (JOB_PROCESSING_MODE=inline)');
    }
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
