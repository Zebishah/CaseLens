import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));

const loadEnv = (): void => {
  const candidates = [
    path.join(backendRoot, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env')
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const result = dotenv.config({ path: envPath });
    if (result.parsed?.DATABASE_URL || result.parsed?.DATABASE_MIGRATION_URL) {
      return;
    }
  }
};

loadEnv();

const databaseUrl = (
  process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
)?.trim();

if (!databaseUrl) {
  throw new Error(
    [
      'DATABASE_URL is missing or empty.',
      `Looked for .env in: ${backendRoot}`,
      'Ensure backend/.env contains: DATABASE_URL=postgresql://user:password@localhost:5432/db_name',
      'Run commands from the backend folder: cd backend && npm run db:push'
    ].join('\n')
  );
}

export default defineConfig({
  schema: './src/database/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl
  }
});
