import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { createAccessToken, createRefreshToken, createShortLivedAccessToken } from '../../utils/token.util.js';
import { AppError } from '../../utils/error.util.js';
import { verifyRefreshToken } from '../../services/jwt.service.js';
import { userService } from '../user/user.service.js';
import { authRepository } from './auth.repository.js';
import { demoSessionService } from '../demo/demo-session.service.js';
import { env } from '../../config/env.config.js';
import { AUTH_CONSTANTS } from './auth.constants.js';
import { workspaceInviteRepository } from './workspace-invite.repository.js';
import { sendVerificationEmail } from './account-email.service.js';
import { sendWorkspaceInviteEmail } from './invite-email.service.js';
import { accessRequestRepository } from '../access-request/access-request.repository.js';
import { refreshSessionRepository } from './refresh-session.repository.js';

type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  authVersion: number;
};

const publicUser = (user: AuthUser) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role
});

const hashInviteToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const refreshDurationMs = (value: string): number => {
  const match = /^([1-9]\d*)(s|m|h|d)$/i.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return Number(match[1]) * unitMs[match[2].toLowerCase()];
};

const buildSession = (user: AuthUser) => {
  const payload = { sub: user.id, email: user.email, role: user.role, authVersion: user.authVersion };
  return {
    token: createAccessToken(payload),
    refreshToken: createRefreshToken(payload),
    user: publicUser(user)
  };
};

const createSession = async (user: AuthUser) => {
  const session = buildSession(user);
  await refreshSessionRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(session.refreshToken),
    expiresAt: new Date(Date.now() + refreshDurationMs(env.JWT_REFRESH_EXPIRES_IN))
  });
  return session;
};

export const authService = {
  async register(payload: { email: string; password: string; name: string }) {
    void payload;
    throw AppError.forbidden('Public registration is disabled; access is invite-controlled');
  },

  async login(payload: { email: string; password: string }) {
    const user = await authRepository.findUserByEmail(payload.email);

    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const isValid = await bcrypt.compare(payload.password, user.password);
    if (!isValid) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new AppError(403, 'Verify your email address before signing in', { code: 'EMAIL_VERIFICATION_REQUIRED' });
    }
    return createSession(user);
  },

  async resendVerification(payload: { email: string; password: string }) {
    const user = await authRepository.findUserByEmail(payload.email);
    if (!user || !(await bcrypt.compare(payload.password, user.password))) {
      throw AppError.unauthorized('Invalid credentials');
    }
    if (user.emailVerifiedAt) return { message: 'Your email is already verified. You can sign in.' };
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60_000);
    const created = await authRepository.createVerification({ userId: user.id, email: user.email, tokenHash, expiresAt });
    if (created) {
      try {
        await sendVerificationEmail({ email: user.email, name: user.name, expiresAt,
          verificationUrl: `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}` });
      } catch (error) {
        await authRepository.discardVerification(tokenHash);
        throw error;
      }
    }
    return { message: 'Check your inbox for a verification link. Please wait at least a minute before requesting another.' };
  },

  async verifyEmail(token: string) {
    if (!(await authRepository.verifyEmail(hashInviteToken(token)))) {
      throw AppError.badRequest('This verification link is invalid, expired, or already used. Request another from sign in.');
    }
    return { verified: true };
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const account = await authRepository.findUserById(userId);
    if (!account || account.role !== 'admin') throw AppError.forbidden('Only administrators can change passwords');
    const user = await authRepository.findUserByEmail(account.email);
    if (!user || user.id !== userId || !(await bcrypt.compare(currentPassword, user.password))) {
      throw AppError.badRequest('The current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw AppError.badRequest('Choose a different new password');
    }
    const passwordHash = await bcrypt.hash(newPassword, AUTH_CONSTANTS.SALT_ROUNDS);
    const updated = await authRepository.changeAdminPassword(userId, user.password, passwordHash);
    if (!updated) throw AppError.conflict('Your account changed. Sign in again and retry.');
    return { changed: true };
  },

  async enterDemo() {
    const created = await demoSessionService.create();
    const expiresAt = new Date(Date.now() + env.DEMO_AUTH_TTL_MINUTES * 60 * 1000);
    const user = {
      id: created.session.id,
      email: 'demo-reviewer@hr-intelligence.local',
      name: 'Recruiter Demo',
      role: 'viewer'
    };
    return {
      token: createShortLivedAccessToken(
        { sub: user.id, email: user.email, role: user.role, demo: true },
        `${env.DEMO_AUTH_TTL_MINUTES}m`
      ),
      user,
      expiresAt: expiresAt.toISOString(),
      access: 'read-only demo'
    };
  },

  async refreshToken(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Session expired');
    }

    const user = await authRepository.findUserById(payload.sub);
    if (!user || !user.emailVerifiedAt || payload.authVersion !== user.authVersion || payload.demo === true) {
      throw AppError.unauthorized('Session expired');
    }

    const session = buildSession(user);
    const rotated = await refreshSessionRepository.rotate({
      userId: user.id,
      currentTokenHash: hashRefreshToken(refreshToken),
      tokenHash: hashRefreshToken(session.refreshToken),
      expiresAt: new Date(Date.now() + refreshDurationMs(env.JWT_REFRESH_EXPIRES_IN))
    });
    if (!rotated) {
      throw AppError.unauthorized('Session expired');
    }
    return session;
  },

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken?.split('.').length === 3) {
      await refreshSessionRepository.revoke(hashRefreshToken(refreshToken));
    }
  },

  async revokeAllSessions(userId: number): Promise<void> {
    await refreshSessionRepository.revokeAllForUser(userId);
  },

  async issueWorkspaceInvite(input: { accessRequestId: number; email: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await authRepository.findUserByEmail(email);
    if (existing?.role === 'admin') {
      throw AppError.conflict('An administrator already uses this email address');
    }

    let user: AuthUser;
    if (!existing) {
      user = await userService.createUser({
        email,
        name: input.name.trim(),
        password: randomBytes(32).toString('hex'),
        role: 'viewer'
      });
    } else if (existing.role !== 'viewer') {
      throw AppError.conflict('Reviewer invitations are only available for reviewer accounts');
    } else {
      user = existing;
    }

    await workspaceInviteRepository.revokeActiveForRequest(input.accessRequestId);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + env.INVITE_TTL_HOURS * 60 * 60 * 1000);
    await workspaceInviteRepository.create({
      accessRequestId: input.accessRequestId,
      userId: user.id,
      email,
      name: input.name.trim(),
      tokenHash: hashInviteToken(token),
      expiresAt
    });

    const setupUrl = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/set-password?token=${encodeURIComponent(token)}`;
    const delivery = await sendWorkspaceInviteEmail({ email, name: input.name.trim(), setupUrl, expiresAt });
    return { sent: delivery.sent, expiresAt: expiresAt.toISOString() };
  },

  async inspectWorkspaceInvite(token: string) {
    const invite = await workspaceInviteRepository.findUsableByHash(hashInviteToken(token));
    if (!invite) {
      throw AppError.badRequest('This setup link is invalid or has expired');
    }
    return { email: invite.email, name: invite.name, expiresAt: invite.expiresAt.toISOString() };
  },

  async acceptWorkspaceInvite(token: string, password: string) {
    const invite = await workspaceInviteRepository.findUsableByHash(hashInviteToken(token));
    if (!invite) {
      throw AppError.badRequest('This setup link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS);
    const accepted = await authRepository.acceptInvite(hashInviteToken(token), passwordHash);
    if (!accepted) throw AppError.badRequest('This setup link is invalid or has already been used');
    await accessRequestRepository.updateStatus(accepted.accessRequestId, 'invited');
    return createSession(accepted.user);
  }
};
