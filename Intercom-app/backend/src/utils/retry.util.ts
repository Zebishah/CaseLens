const TRANSIENT_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN'
]);

const TRANSIENT_ERROR_PATTERN =
  /getaddrinfo|ECONNREFUSED|ETIMEDOUT|connection terminated|Connection terminated unexpectedly/i;

const isTransientNetworkErrorMessage = (message: string): boolean =>
  TRANSIENT_ERROR_PATTERN.test(message) || message.toLowerCase() === 'fetch failed';

export const isTransientNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  if (isTransientNetworkErrorMessage(error.message)) {
    return true;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return isTransientNetworkError(cause);
  }

  return false;
};

type RetryOptions = {
  attempts?: number;
  delaysMs?: number[];
  onRetry?: (error: Error, attempt: number) => void;
};

export const retryAsync = async <T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> => {
  const attempts = options?.attempts ?? 3;
  const delaysMs = options?.delaysMs ?? [500, 1500];
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt === attempts;

      if (isLastAttempt || !isTransientNetworkError(lastError)) {
        throw lastError;
      }

      options?.onRetry?.(lastError, attempt);

      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Retry failed');
};
