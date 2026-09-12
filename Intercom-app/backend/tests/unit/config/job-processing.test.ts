import { describe, expect, test } from '@jest/globals';
import { parseAppEnv } from '../../../src/config/env.config.js';
import { shouldDispatchQueueJobs, shouldStartQueueWorkers } from '../../../src/config/job-processing.js';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db_name',
  JWT_SECRET: 'test-access-secret-value',
  JWT_REFRESH_SECRET: 'test-refresh-secret-value',
  INTERCOM_ENABLED: 'false',
  LLM_MODE: 'fixture',
  RUN_API: 'true',
  RUN_WORKERS: 'false'
} as NodeJS.ProcessEnv;

describe('JOB_PROCESSING_MODE', () => {
  test('inline mode does not require Redis', () => {
    const parsed = parseAppEnv({
      ...base,
      JOB_PROCESSING_MODE: 'inline'
    });
    expect(parsed.JOB_PROCESSING_MODE).toBe('inline');
    expect(parsed.REDIS_URL).toBeUndefined();
  });

  test('bullmq mode requires Redis', () => {
    expect(() =>
      parseAppEnv({
        ...base,
        JOB_PROCESSING_MODE: 'bullmq'
      })
    ).toThrow(/REDIS_URL/);
  });

  test('production Brevo invites require a public HTTPS app URL', () => {
    expect(() =>
      parseAppEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        BREVO_ENABLED: 'true',
        BREVO_API_KEY: 'test-brevo-key',
        BREVO_SENDER_EMAIL: 'access@example.com',
        PUBLIC_APP_URL: 'http://localhost:3001'
      })
    ).toThrow(/PUBLIC_APP_URL/);
  });

  test('accepts a deployed HTTPS app URL for Brevo invites', () => {
    const parsed = parseAppEnv({
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      BREVO_ENABLED: 'true',
      BREVO_API_KEY: 'test-brevo-key',
      BREVO_SENDER_EMAIL: 'access@example.com',
      PUBLIC_APP_URL: 'https://nagumo-hr-intelligence.vercel.app'
    });

    expect(parsed.PUBLIC_APP_URL).toBe('https://nagumo-hr-intelligence.vercel.app');
  });

  test('does not start BullMQ workers in inline mode', () => {
    expect(shouldStartQueueWorkers('inline', true, 'production')).toBe(false);
    expect(shouldStartQueueWorkers('bullmq', true, 'production')).toBe(true);
    expect(shouldStartQueueWorkers('bullmq', true, 'test')).toBe(false);
  });

  test('does not dispatch queue jobs in inline mode', () => {
    expect(shouldDispatchQueueJobs('inline', 'production')).toBe(false);
    expect(shouldDispatchQueueJobs('bullmq', 'production')).toBe(true);
    expect(shouldDispatchQueueJobs('bullmq', 'test')).toBe(false);
  });
});
