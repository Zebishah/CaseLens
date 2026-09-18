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
import { sendWorkspaceInviteEmail } from './invite-email.service.js';
import { userRepository } from '../user/user.repository.js';
import { accessRequestRepository } from '../access-request/access-request.repository.js';
import { refreshSessionRepository } from './refresh-session.repository.js';

type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: string;
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
  const payload = { sub: user.id, email: user.email, role: user.role };
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
    const user = await userService.createUser(payload);
    return createSession(user);
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

    return createSession(user);
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
        { sub: user.id, email: user.email, role: user.role },
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
    if (!user) {
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
      user = (await userRepository.updateById(existing.id, { role: 'viewer' })) ?? {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: 'viewer'
      };
    } else {
      user = {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role
      };
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

    const consumed = await workspaceInviteRepository.consume(invite.id);
    if (!consumed) {
      throw AppError.badRequest('This setup link is invalid or has already been used');
    }

    const passwordHash = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS);
    const user = await userRepository.updatePasswordHash(invite.userId, passwordHash);
    if (!user) {
      throw AppError.badRequest('The invited account is no longer available');
    }
    await accessRequestRepository.updateStatus(invite.accessRequestId, 'invited');
    return createSession(user);
  }
};
