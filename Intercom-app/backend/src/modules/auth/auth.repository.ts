import { userRepository } from '../user/user.repository.js';

export const authRepository = {
  findUserByEmail: userRepository.findByEmail,
  findUserById: userRepository.findById
};
