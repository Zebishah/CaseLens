import { describe, expect, test } from '@jest/globals';
import { parseAppEnv } from '../../../src/config/env.config.js';
import { shouldDispatchQueueJobs, shouldStartQueueWorkers } from '../../../src/config/job-processing.js';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db_name',
  JWT_SECRET: 'test-secret-value',
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
