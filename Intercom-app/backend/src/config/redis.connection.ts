import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';
import { env } from './env.config.js';
import { logger } from './logger.config.js';

const usesTls = (redisUrl: string): boolean =>
  redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

const decodeRedisCredential = (value: string): string => decodeURIComponent(value);

export const parseRedisUrlToOptions = (redisUrl: string): RedisOptions => {
  const normalized = redisUrl
    .replace(/^rediss:\/\//, 'https://')
    .replace(/^redis:\/\//, 'http://');
  const url = new URL(normalized);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeRedisCredential(url.username) } : {}),
    ...(url.password ? { password: decodeRedisCredential(url.password) } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
    ...(usesTls(redisUrl) ? { tls: {} } : {})
  };
};

export const buildRedisOptions = (redisUrl: string): RedisOptions => parseRedisUrlToOptions(redisUrl);

export const createRedisClient = (label: string, redisUrl: string): Redis => {
  const client = new Redis(buildRedisOptions(redisUrl));

  client.on('error', (error) => {
    logger.error(`[redis:${label}] Connection error`, {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code
    });
  });

  client.on('connect', () => {
    logger.info(`[redis:${label}] Connected`);
  });

  return client;
};

export const getBullMqConnection = (): RedisOptions => {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required when JOB_PROCESSING_MODE=bullmq');
  }

  return buildRedisOptions(env.REDIS_URL);
};
