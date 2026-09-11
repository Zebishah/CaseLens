import bcrypt from 'bcrypt';
import { createAccessToken, createRefreshToken, createShortLivedAccessToken } from '../../utils/token.util.js';
import { AppError } from '../../utils/error.util.js';
import { verifyRefreshToken } from '../../services/jwt.service.js';
import { userService } from '../user/user.service.js';
import { authRepository } from './auth.repository.js';
import { demoSessionService } from '../demo/demo-session.service.js';
import { env } from '../../config/env.config.js';

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

const createSession = (user: AuthUser) => {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    token: createAccessToken(payload),
    refreshToken: createRefreshToken(payload),
    user: publicUser(user)
  };
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

    return createSession(user);
  }
};
