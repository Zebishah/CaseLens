import { eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { users } from '../../database/schema/users.js';
import type { CreateUserDto } from './user.dto.js';

const publicUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

export const userRepository = {
  async create(payload: CreateUserDto & { password: string }) {
    const [user] = await db.insert(users).values(payload).returning(publicUserColumns);
    return user;
  },

  async findByEmail(email: string) {
    return db.query.users.findFirst({ where: eq(users.email, email) });
  },

  async findAll() {
    return db.select(publicUserColumns).from(users);
  },

  async findById(id: number) {
    const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, id)).limit(1);
    return user;
  },

  async updateById(id: number, payload: Partial<CreateUserDto>) {
    const [user] = await db
      .update(users)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(publicUserColumns);
    return user;
  },

  async updatePasswordHash(id: number, password: string) {
    const [user] = await db
      .update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role
      });
    return user;
  },

  async deleteById(id: number) {
    const [user] = await db.delete(users).where(eq(users.id, id)).returning(publicUserColumns);
    return user;
  }
};
