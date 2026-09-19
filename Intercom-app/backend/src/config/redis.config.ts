import { Redis } from 'ioredis';
import { env } from './env.config.js';
import { createRedisClient } from './redis.connection.js';

let shared: Redis | null = null;

export const getSharedRedis = (): Redis | null => {
  if (env.NODE_ENV === 'test' || !env.REDIS_URL) {
    return null;
  }

  if (!shared) {
    shared = createRedisClient('shared', env.REDIS_URL);
  }

  return shared;
};

/** Close only an already-created client so shutdown never opens a new connection. */
export const closeSharedRedis = async (): Promise<void> => {
  if (!shared) return;
  const client = shared;
  shared = null;

  if (client.status === 'ready') {
    await client.quit().catch(() => client.disconnect());
  } else {
    client.disconnect();
  }
};

/** @deprecated Prefer getSharedRedis() so inline mode never opens a Redis connection. */
export const redis = new Proxy({} as Redis, {
  get(_target, property, receiver) {
    const client = getSharedRedis();
    if (!client) {
      throw new Error('Redis is not configured (REDIS_URL is unset)');
    }
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
