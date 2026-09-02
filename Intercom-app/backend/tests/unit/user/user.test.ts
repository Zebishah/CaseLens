import { createAccessToken } from '../../../src/utils/token.util.js';

describe('User related utilities', () => {
  test('createAccessToken returns token', () => {
    const token = createAccessToken({ sub: 1, email: 'user@example.com', role: 'user' });
    expect(typeof token).toBe('string');
  });
});
