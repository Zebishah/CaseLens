import { isTransientNetworkError, retryAsync } from '../../../src/utils/retry.util.js';

describe('retry.util', () => {
  test('isTransientNetworkError detects DNS failures', () => {
    const error = new Error('getaddrinfo ENOTFOUND acela.proxy.rlwy.net');
    (error as NodeJS.ErrnoException).code = 'ENOTFOUND';

    expect(isTransientNetworkError(error)).toBe(true);
  });

  test('isTransientNetworkError ignores validation errors', () => {
    expect(isTransientNetworkError(new Error('Invalid conversation id'))).toBe(false);
  });

  test('retryAsync retries transient errors then succeeds', async () => {
    let attempts = 0;

    const result = await retryAsync(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          const error = new Error('getaddrinfo ENOTFOUND example.proxy.rlwy.net');
          (error as NodeJS.ErrnoException).code = 'ENOTFOUND';
          throw error;
        }

        return 'ok';
      },
      { delaysMs: [0] }
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  test('retryAsync does not retry non-transient errors', async () => {
    let attempts = 0;

    await expect(
      retryAsync(async () => {
        attempts += 1;
        throw new Error('bad input');
      })
    ).rejects.toThrow('bad input');

    expect(attempts).toBe(1);
  });
});
