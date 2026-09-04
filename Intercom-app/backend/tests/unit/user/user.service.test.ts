import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindByEmail = jest.fn();
const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockUpdateById = jest.fn();
const mockDeleteById = jest.fn();

await jest.unstable_mockModule('../../../src/modules/user/user.repository.js', () => ({
  userRepository: {
    findByEmail: mockFindByEmail,
    create: mockCreate,
    findAll: mockFindAll,
    findById: mockFindById,
    updateById: mockUpdateById,
    deleteById: mockDeleteById
  }
}));

const { userService } = await import('../../../src/modules/user/user.service.js');

describe('userService credential handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes email and hashes a password before creating a user', async () => {
    mockFindByEmail.mockResolvedValue(undefined);
    mockCreate.mockImplementation(async (payload) => ({
      id: 1,
      email: payload.email,
      name: payload.name,
      role: 'viewer'
    }));

    const created = await userService.createUser({
      email: ' Recruiter@Example.com ',
      password: 'StrongPassword123!',
      name: 'Recruiter',
      role: 'viewer'
    });

    expect(mockFindByEmail).toHaveBeenCalledWith('recruiter@example.com');
    const persisted = mockCreate.mock.calls[0]?.[0] as { email: string; password: string };
    expect(persisted.email).toBe('recruiter@example.com');
    expect(persisted.password).not.toBe('StrongPassword123!');
    await expect(bcrypt.compare('StrongPassword123!', persisted.password)).resolves.toBe(true);
    expect(created).not.toHaveProperty('password');
  });

  test('hashes a replacement password before updating a user', async () => {
    mockUpdateById.mockImplementation(async (_id, payload) => ({
      id: 1,
      email: 'recruiter@example.com',
      name: 'Recruiter',
      role: 'viewer',
      ...payload,
      password: undefined
    }));

    await userService.updateUser(1, { password: 'ReplacementPassword123!' });

    const persisted = mockUpdateById.mock.calls[0]?.[1] as { password: string };
    expect(persisted.password).not.toBe('ReplacementPassword123!');
    await expect(bcrypt.compare('ReplacementPassword123!', persisted.password)).resolves.toBe(true);
  });
});
