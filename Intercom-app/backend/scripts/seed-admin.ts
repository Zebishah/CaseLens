import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { AUTH_CONSTANTS } from '../src/modules/auth/auth.constants.js';
import { ROLES } from '../src/constants/roles.js';
import { db } from '../src/database/connection.js';
import { users } from '../src/database/schema/users.js';

const DEFAULT_EMAIL = 'operator@northwind.co';
const DEFAULT_PASSWORD = 'CaseOps-Northwind-2026';
const DEFAULT_NAME = 'Sarah Chen';

const main = async (): Promise<void> => {
  const email = (process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_EMAIL).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || DEFAULT_NAME;

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
  }

  const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        password: hashedPassword,
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

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
