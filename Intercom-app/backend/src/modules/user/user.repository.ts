import { eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { users } from '../../database/schema/users.js';
import type { CreateUserDto } from './user.dto.js';

export const userRepository = {
  async create(payload: CreateUserDto & { password: string }) {
    const [user] = await db.insert(users).values(payload).returning();
    return user;
  },

  async findByEmail(email: string) {
    return db.query.users.findFirst({ where: eq(users.email, email) });
  },

  async findAll() {
    return db.select().from(users);
  },

  async findById(id: number) {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  },

  async updateById(id: number, payload: Partial<CreateUserDto>) {
    const [user] = await db.update(users).set(payload).where(eq(users.id, id)).returning();
    return user;
  },

  async deleteById(id: number) {
    const [user] = await db.delete(users).where(eq(users.id, id)).returning();
    return user;
  }
};
