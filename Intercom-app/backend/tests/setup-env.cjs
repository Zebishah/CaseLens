process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/db_name';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-value';
process.env.JWT_EXPIRES_IN = '1d';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.LOG_LEVEL = 'error';
process.env.INTERCOM_ENABLED = process.env.INTERCOM_ENABLED || 'true';
process.env.INTERCOM_ACCESS_TOKEN =
  process.env.INTERCOM_ACCESS_TOKEN || 'test-intercom-access-token';
process.env.INTERCOM_CLIENT_SECRET =
  process.env.INTERCOM_CLIENT_SECRET || 'test-intercom-client-secret';
process.env.INTERCOM_WORKSPACE_ID = process.env.INTERCOM_WORKSPACE_ID || 'test-workspace-id';
process.env.INTERCOM_ADMIN_ID = process.env.INTERCOM_ADMIN_ID || process.env.INTERCOM_BOT_ADMIN_ID || 'test-bot-admin-id';
process.env.INTERCOM_BOT_ADMIN_ID = process.env.INTERCOM_BOT_ADMIN_ID || process.env.INTERCOM_ADMIN_ID || 'test-bot-admin-id';
process.env.LLM_MODE = process.env.LLM_MODE || 'live';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-api-key';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
process.env.RUN_API = process.env.RUN_API || 'true';
process.env.RUN_WORKERS = process.env.RUN_WORKERS || 'false';
process.env.JOB_PROCESSING_MODE = process.env.JOB_PROCESSING_MODE || 'bullmq';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3001';
process.env.PUBLIC_APP_URL = 'http://localhost:3001';

process.env.RESEND_AUTH_EMAIL_ENABLED = 'false';
process.env.RESEND_ENABLED = 'false';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM_EMAIL = 'access@example.com';
