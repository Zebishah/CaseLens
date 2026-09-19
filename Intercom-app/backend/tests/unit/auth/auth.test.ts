import {
  generateRefreshToken,
  generateToken,
  verifyRefreshToken,
  verifyToken
} from '../../../src/services/jwt.service.js';

const payload = { sub: 1, email: 'test@example.com', role: 'user' };

describe('JWT service', () => {
  test('generates and verifies an access token', () => {
    const token = generateToken(payload);
    expect(verifyToken(token)).toEqual(payload);
  });

  test('generates and verifies a refresh token', () => {
    const token = generateRefreshToken(payload);
    expect(verifyRefreshToken(token)).toEqual(payload);
  });

  test('preserves the explicit recruiter demo marker', () => {
    const demoPayload = { ...payload, role: 'viewer', demo: true };
    const token = generateToken(demoPayload);

    expect(verifyToken(token)).toEqual(demoPayload);
  });

  test('does not accept a refresh token as an access token', () => {
    expect(() => verifyToken(generateRefreshToken(payload))).toThrow();
  });

  test('does not accept an access token as a refresh token', () => {
    expect(() => verifyRefreshToken(generateToken(payload))).toThrow();
  });
});
