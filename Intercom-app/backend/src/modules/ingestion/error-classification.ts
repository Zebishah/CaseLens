export const PROCESSING_ERROR_CLASSES = [
  'validation_permanent',
  'auth_configuration',
  'rate_limited',
  'network_transient',
  'provider_failure',
  'model_output_failure',
  'internal_consistency'
] as const;

export type ProcessingErrorClass = (typeof PROCESSING_ERROR_CLASSES)[number];

export type ClassifiedError = {
  errorClass: ProcessingErrorClass;
  retryable: boolean;
  code: string;
  safeMessage: string;
};

const includesAny = (value: string, fragments: string[]): boolean =>
  fragments.some((fragment) => value.includes(fragment));

export const classifyProcessingError = (error: unknown): ClassifiedError => {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.toLowerCase();

  if (includesAny(message, ['validation', 'invalid payload', 'unprocessable', 'zod'])) {
    return {
      errorClass: 'validation_permanent',
      retryable: false,
      code: 'VALIDATION_ERROR',
      safeMessage: 'The event failed validation and will not be retried.'
    };
  }

  if (includesAny(message, ['unauthorized', 'forbidden', 'invalid signature', 'api key', 'not configured'])) {
    return {
      errorClass: 'auth_configuration',
      retryable: false,
      code: 'AUTH_CONFIGURATION',
      safeMessage: 'A provider credential or signature check failed.'
    };
  }

  if (includesAny(message, ['429', 'rate limit', 'quota', 'resource_exhausted'])) {
    return {
      errorClass: 'rate_limited',
      retryable: true,
      code: 'RATE_LIMITED',
      safeMessage: 'A provider rate limit was hit. The job can be retried with backoff.'
    };
  }

  if (includesAny(message, ['econnreset', 'etimedout', 'enotfound', 'fetch failed', 'socket', 'timeout'])) {
    return {
      errorClass: 'network_transient',
      retryable: true,
      code: 'NETWORK_TRANSIENT',
      safeMessage: 'A transient network error occurred.'
    };
  }

  if (includesAny(message, ['gemini', 'resend', 'intercom', 'box', 'provider'])) {
    return {
      errorClass: 'provider_failure',
      retryable: true,
      code: 'PROVIDER_FAILURE',
      safeMessage: 'An upstream provider returned an error.'
    };
  }

  if (includesAny(message, ['malformed model', 'json.parse', 'unexpected model', 'empty model'])) {
    return {
      errorClass: 'model_output_failure',
      retryable: true,
      code: 'MODEL_OUTPUT_FAILURE',
      safeMessage: 'The model returned unusable output.'
    };
  }

  return {
    errorClass: 'internal_consistency',
    retryable: true,
    code: 'INTERNAL_ERROR',
    safeMessage: 'An internal processing error occurred.'
  };
};

export const boundedBackoffMs = (attempt: number): number => {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(60_000, 1_000 * 2 ** exponent);
};
