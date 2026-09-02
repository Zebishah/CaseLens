import { getSharedRedis } from '../config/redis.config.js';

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const client = getSharedRedis();
    if (!client) {
      return null;
    }
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  },
  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const client = getSharedRedis();
    if (!client) {
      return;
    }
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },
  async del(key: string): Promise<void> {
    await getSharedRedis()?.del(key);
  }
};
