import { AppError } from '../../utils/error.util.js';
import type { CreateUserDto } from './user.dto.js';
import { userRepository } from './user.repository.js';

export const userService = {
  async getAllUsers() {
    return userRepository.findAll();
  },

  async createUser(payload: CreateUserDto & { password: string }) {
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw AppError.conflict('Email already exists');
    }
    return userRepository.create(payload);
  },

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  },

  async updateUser(id: number, payload: Partial<CreateUserDto>) {
    const user = await userRepository.updateById(id, payload);
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
