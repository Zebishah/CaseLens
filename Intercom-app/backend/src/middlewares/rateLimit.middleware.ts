import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config.js';
import { createRateLimitStore } from './redis-rate-limit.store.js';
import { operationalMetrics } from '../observability/metrics.js';

const redisConfigured = Boolean(env.REDIS_URL);
const reject = (message = 'Too many requests, please try again later.') => (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
  operationalMetrics.rateLimitRejected();
  res.status(429).json({ success: false, message });
};

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: createRateLimitStore('api', redisConfigured),
  handler: reject(),
  standardHeaders: true,
  legacyHeaders: false
});

export const authLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: createRateLimitStore('login', redisConfigured),
  handler: reject('Too many failed sign-in attempts. Please wait before trying again.'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many failed sign-in attempts. Please wait before trying again.'
  }
});

export const publicDemoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  store: createRateLimitStore('demo', redisConfigured),
  handler: reject(),
  standardHeaders: true,
  legacyHeaders: false
});

export const assistantRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  store: createRateLimitStore('assistant', redisConfigured),
  handler: reject('Too many assistant questions. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many assistant questions. Please try again later.'
  }
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  store: createRateLimitStore('webhook', redisConfigured),
  handler: reject(),
  standardHeaders: true,
  legacyHeaders: false
});

export const accessRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  store: createRateLimitStore('access-request', redisConfigured),
  handler: reject('Too many access requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many access requests. Please try again later.'
  }
});
