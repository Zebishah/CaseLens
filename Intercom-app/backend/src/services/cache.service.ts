import { getSharedRedis } from '../config/redis.config.js';
import { logger } from '../config/logger.config.js';

const CACHE_NAMESPACE = 'hr-intelligence:';
const REDIS_TIMEOUT_MS = 250;

const withTimeout = async <T>(operation: Promise<T>): Promise<T> =>
  Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis cache operation timed out')), REDIS_TIMEOUT_MS)
    )
  ]);

const namespaced = (key: string): string => `${CACHE_NAMESPACE}${key}`;

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const client = getSharedRedis();
    if (!client) {
      return null;
    }
    try {
      const value = await withTimeout(client.get(namespaced(key)));
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      logger.warn('[cache] Read failed; continuing without cache', { key, error });
      return null;
    }
  },
  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const client = getSharedRedis();
    if (!client) {
      return;
    }
    try {
      await withTimeout(client.set(namespaced(key), JSON.stringify(value), 'EX', Math.max(1, ttlSeconds)));
    } catch (error) {
      logger.warn('[cache] Write failed; continuing without cache', { key, error });
    }
  },
  async del(key: string): Promise<void> {
    const client = getSharedRedis();
    if (!client) return;
    try {
      await withTimeout(client.del(namespaced(key)));
    } catch (error) {
      logger.warn('[cache] Delete failed; continuing without cache', { key, error });
    }
  },
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }
};
