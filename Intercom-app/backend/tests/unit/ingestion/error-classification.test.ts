import { describe, expect, test } from '@jest/globals';
import {
  boundedBackoffMs,
  classifyProcessingError
} from '../../../src/modules/ingestion/error-classification.js';

describe('classifyProcessingError', () => {
  test('does not retry permanent validation failures', () => {
    const classified = classifyProcessingError(new Error('Validation error: invalid payload'));
    expect(classified.retryable).toBe(false);
    expect(classified.errorClass).toBe('validation_permanent');
  });

  test('retries rate limits and network failures', () => {
    expect(classifyProcessingError(new Error('429 rate limit')).retryable).toBe(true);
    expect(classifyProcessingError(new Error('fetch failed: ETIMEDOUT')).retryable).toBe(true);
  });

  test('classifies configuration errors as non-retryable', () => {
    const classified = classifyProcessingError(new Error('Resend API key is not configured'));
    expect(classified.retryable).toBe(false);
    expect(classified.errorClass).toBe('auth_configuration');
  });

  test('uses bounded exponential backoff', () => {
    expect(boundedBackoffMs(1)).toBe(1000);
    expect(boundedBackoffMs(2)).toBe(2000);
    expect(boundedBackoffMs(3)).toBe(4000);
    expect(boundedBackoffMs(10)).toBe(60_000);
  });
});
