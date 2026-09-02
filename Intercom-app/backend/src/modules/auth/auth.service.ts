import bcrypt from 'bcrypt';
import { createAccessToken } from '../../utils/token.util.js';
import { AppError } from '../../utils/error.util.js';
import { userService } from '../user/user.service.js';
import { authRepository } from './auth.repository.js';
import { AUTH_CONSTANTS } from './auth.constants.js';

export const authService = {
  async register(payload: { email: string; password: string; name: string }) {
    const hashedPassword = await bcrypt.hash(payload.password, AUTH_CONSTANTS.SALT_ROUNDS);
    const user = await userService.createUser({ ...payload, password: hashedPassword });

    return {
      token: createAccessToken({ sub: user.id, email: user.email, role: user.role }),
      user
    };
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

    return {
      token: createAccessToken({ sub: user.id, email: user.email, role: user.role }),
      user
    };
  },

  async refreshToken(refreshToken: string) {
    return { token: refreshToken };
  }
};
