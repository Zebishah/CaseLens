import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';
import { env } from './env.config.js';
import { logger } from './logger.config.js';

const usesTls = (redisUrl: string): boolean =>
  redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

const decodeRedisCredential = (value: string): string => decodeURIComponent(value);

const parseRedisUrl = (redisUrl: string): Pick<RedisOptions, 'host' | 'port' | 'username' | 'password' | 'tls'> => {
  const normalized = redisUrl
    .replace(/^rediss:\/\//, 'https://')
    .replace(/^redis:\/\//, 'http://');
  const url = new URL(normalized);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeRedisCredential(url.username) } : {}),
    ...(url.password ? { password: decodeRedisCredential(url.password) } : {}),
    ...(usesTls(redisUrl) ? { tls: {} } : {})
  };
};

/** BullMQ needs an unlimited per-request retry setting and disables ready checks. */
export const parseRedisUrlToOptions = (redisUrl: string): RedisOptions => ({
  ...parseRedisUrl(redisUrl),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 5_000,
  retryStrategy: (times) => Math.min(times * 200, 2_000)
});

/** Bounded, lazy connection settings for API cache and rate-limit traffic. */
export const buildRedisClientOptions = (redisUrl: string): RedisOptions => ({
  ...parseRedisUrl(redisUrl),
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: true,
  connectTimeout: 3_000,
  commandTimeout: 3_000,
  retryStrategy: (times) => Math.min(250 * 2 ** Math.min(times - 1, 4), 5_000)
});

export const createRedisClient = (label: string, redisUrl: string): Redis => {
  const client = new Redis(buildRedisClientOptions(redisUrl));
  let connectedOnce = false;
  let lastErrorLoggedAt = 0;

  client.on('error', (error) => {
    if (Date.now() - lastErrorLoggedAt < 60_000) return;
    lastErrorLoggedAt = Date.now();
    logger.error(`[redis:${label}] Connection error`, {
      code: (error as NodeJS.ErrnoException).code
    });
  });

  client.on('connect', () => {
    if (connectedOnce) return;
    connectedOnce = true;
    logger.info(`[redis:${label}] Connected`);
  });

  return client;
};

export const getBullMqConnection = (): RedisOptions => {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required when JOB_PROCESSING_MODE=bullmq');
  }

  return parseRedisUrlToOptions(env.REDIS_URL);
};
