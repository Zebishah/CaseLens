import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { AUTH_CONSTANTS } from '../src/modules/auth/auth.constants.js';
import { ROLES } from '../src/constants/roles.js';
import { db, pool } from '../src/database/connection.js';
import { users } from '../src/database/schema/users.js';

const DEFAULT_EMAIL = 'operator@northwind.co';
const DEFAULT_NAME = 'Sarah Chen';

const main = async (): Promise<void> => {
  const email = (process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_EMAIL).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim() || DEFAULT_NAME;

  if (!password || password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD is required and must be at least 12 characters');
  }

  const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        authVersion: sql`${users.authVersion} + 1`,
        name,
        role: ROLES.ADMIN,
        updatedAt: new Date()
      })
      .where(eq(users.id, existing[0].id));
    console.log(`Updated admin operator: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      role: ROLES.ADMIN
    });
    console.log(`Created admin operator: ${email}`);
  }

};

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
