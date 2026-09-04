import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { AUTH_CONSTANTS } from '../src/modules/auth/auth.constants.js';
import { ROLES } from '../src/constants/roles.js';
import { db, pool } from '../src/database/connection.js';
import { users } from '../src/database/schema/users.js';

const main = async (): Promise<void> => {
  const email = process.env.SEED_VIEWER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_VIEWER_PASSWORD?.trim();
  const name = process.env.SEED_VIEWER_NAME?.trim() || 'Recruiter Review';

  if (!email || !password) {
    throw new Error('SEED_VIEWER_EMAIL and SEED_VIEWER_PASSWORD are required');
  }
  if (password.length < 12) {
    throw new Error('SEED_VIEWER_PASSWORD must be at least 12 characters');
  }

  const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        name,
        role: ROLES.VIEWER,
        updatedAt: new Date()
      })
      .where(eq(users.id, existing[0].id));
    console.log(`Updated read-only reviewer: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      role: ROLES.VIEWER
    });
    console.log(`Created read-only reviewer: ${email}`);
  }

};

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
