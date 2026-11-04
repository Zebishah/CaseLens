import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindUserById = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockRotate = jest.fn();
const mockCreate = jest.fn();
const mockRevoke = jest.fn();
const mockRevokeAllForUser = jest.fn();
const mockCreateUser = jest.fn();

await jest.unstable_mockModule('../../../src/modules/auth/auth.repository.js', () => ({
  authRepository: { findUserById: mockFindUserById, findUserByEmail: mockFindUserByEmail }
}));
await jest.unstable_mockModule('../../../src/modules/auth/refresh-session.repository.js', () => ({
  refreshSessionRepository: {
    create: mockCreate,
    rotate: mockRotate,
    revoke: mockRevoke,
    revokeAllForUser: mockRevokeAllForUser
  }
}));
await jest.unstable_mockModule('../../../src/modules/user/user.service.js', () => ({
  userService: { createUser: mockCreateUser }
}));
await jest.unstable_mockModule('../../../src/modules/demo/demo-session.service.js', () => ({
  demoSessionService: { create: jest.fn() }
}));
await jest.unstable_mockModule('../../../src/modules/auth/workspace-invite.repository.js', () => ({
  workspaceInviteRepository: {}
}));
await jest.unstable_mockModule('../../../src/modules/auth/invite-email.service.js', () => ({
  sendWorkspaceInviteEmail: jest.fn()
}));
await jest.unstable_mockModule('../../../src/modules/user/user.repository.js', () => ({
  userRepository: {}
}));
await jest.unstable_mockModule('../../../src/modules/access-request/access-request.repository.js', () => ({
  accessRequestRepository: {}
}));

const { authService, hashRefreshToken } = await import('../../../src/modules/auth/auth.service.js');
const { generateRefreshToken, verifyRefreshToken } = await import('../../../src/services/jwt.service.js');

const user = { id: 7, email: 'reviewer@example.test', name: 'Reviewer', role: 'viewer', authVersion: 0, emailVerifiedAt: new Date() };

describe('persistent refresh sessions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockFindUserById.mockResolvedValue(user);
    mockFindUserByEmail.mockResolvedValue({ ...user, password: await bcrypt.hash('test-password-123', 4) });
    mockRotate.mockResolvedValue(true);
    mockCreate.mockResolvedValue(undefined);
  });

  test('stores only a hash when creating a session', async () => {
    const session = await authService.login({ email: user.email, password: 'test-password-123' });

    const stored = mockCreate.mock.calls[0]?.[0] as { tokenHash: string; expiresAt: Date };
    expect(stored.tokenHash).toBe(hashRefreshToken(session.refreshToken));
    expect(stored.tokenHash).not.toBe(session.refreshToken);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.expiresAt).toBeInstanceOf(Date);
  });

  test('atomically rotates a valid refresh token and persists only hashes', async () => {
    const oldToken = generateRefreshToken({ sub: user.id, email: user.email, role: user.role, authVersion: user.authVersion });

    const rotated = await authService.refreshToken(oldToken);

    expect(mockRotate).toHaveBeenCalledTimes(1);
    const stored = mockRotate.mock.calls[0]?.[0] as {
      currentTokenHash: string;
      tokenHash: string;
      expiresAt: Date;
    };
    expect(stored.currentTokenHash).toBe(hashRefreshToken(oldToken));
    expect(stored.tokenHash).toBe(hashRefreshToken(rotated.refreshToken));
    expect(stored.currentTokenHash).not.toBe(stored.tokenHash);
    expect(stored.expiresAt).toBeInstanceOf(Date);
    expect(verifyRefreshToken(rotated.refreshToken).sub).toBe(user.id);
  });

  test('rejects a replay when the repository reports that the token was already consumed', async () => {
    mockRotate.mockResolvedValueOnce(false);
    const oldToken = generateRefreshToken({ sub: user.id, email: user.email, role: user.role, authVersion: user.authVersion });

    await expect(authService.refreshToken(oldToken)).rejects.toThrow('Session expired');
  });

  test('revokes the current refresh session on logout and supports user-wide revocation', async () => {
    const refreshToken = generateRefreshToken({ sub: user.id, email: user.email, role: user.role, authVersion: user.authVersion });
    await authService.logout(refreshToken);
    await authService.revokeAllSessions(user.id);

    expect(mockRevoke).toHaveBeenCalledWith(hashRefreshToken(refreshToken));
    expect(mockRevokeAllForUser).toHaveBeenCalledWith(user.id);
  });
});
