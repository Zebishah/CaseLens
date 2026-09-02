import { generateToken, verifyToken } from '../../../src/services/jwt.service.js';

describe('JWT service', () => {
  test('generate and verify token', () => {
    const token = generateToken({ sub: 1, email: 'test@example.com', role: 'user' });
    const payload = verifyToken(token);
    expect(payload.email).toBe('test@example.com');
  });
});
