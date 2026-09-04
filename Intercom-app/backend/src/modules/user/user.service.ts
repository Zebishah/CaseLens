import bcrypt from 'bcrypt';
import { AppError } from '../../utils/error.util.js';
import { AUTH_CONSTANTS } from '../auth/auth.constants.js';
import type { CreateUserDto } from './user.dto.js';
import { userRepository } from './user.repository.js';

export const userService = {
  async getAllUsers() {
    return userRepository.findAll();
  },

  async createUser(payload: CreateUserDto & { password: string }) {
    const email = payload.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict('Email already exists');
    }
    const password = await bcrypt.hash(payload.password, AUTH_CONSTANTS.SALT_ROUNDS);
    return userRepository.create({ ...payload, email, password });
  },

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  },

  async updateUser(id: number, payload: Partial<CreateUserDto>) {
    const normalized = {
      ...payload,
      ...(payload.email ? { email: payload.email.trim().toLowerCase() } : {}),
      ...(payload.password
        ? { password: await bcrypt.hash(payload.password, AUTH_CONSTANTS.SALT_ROUNDS) }
        : {})
    };
    const user = await userRepository.updateById(id, normalized);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  },

  async deleteUser(id: number) {
    const user = await userRepository.deleteById(id);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  }
};
