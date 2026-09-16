import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

if (!process.env.INTERCOM_CLIENT_SECRET && process.env.INTERCOM_WEBHOOK_SECRET) {
  process.env.INTERCOM_CLIENT_SECRET = process.env.INTERCOM_WEBHOOK_SECRET;
}

if (!process.env.INTERCOM_ADMIN_ID && process.env.INTERCOM_BOT_ADMIN_ID) {
  process.env.INTERCOM_ADMIN_ID = process.env.INTERCOM_BOT_ADMIN_ID;
}

if (!process.env.INTERCOM_BOT_ADMIN_ID && process.env.INTERCOM_ADMIN_ID) {
  process.env.INTERCOM_BOT_ADMIN_ID = process.env.INTERCOM_ADMIN_ID;
}

if (!process.env.JWT_SECRET && process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_SECRET = process.env.JWT_ACCESS_SECRET;
}

if (!process.env.JWT_EXPIRES_IN && process.env.JWT_ACCESS_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN;
}

const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));

const trustProxyValue = z
  .union([z.enum(['true', 'false']), z.coerce.number().int().min(0).max(2)])
  .optional()
  .transform((value) => {
    if (value === undefined || value === 'true') return 1;
    if (value === 'false') return 0;
    return value;
  });

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const isLocalAppHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3002),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .default('info'),

    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    REDIS_URL: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().url().optional()
    ),

    JWT_SECRET: z.string().min(12),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(12),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    AUTH_COOKIE_NAME: z.string().default('caseops_session'),
    CSRF_COOKIE_NAME: z.string().default('caseops_csrf'),
    COOKIE_SECURE: booleanFlag(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    CORS_ORIGINS: z.string().optional(),
    TRUST_PROXY: trustProxyValue,
    JWT_ISSUER: z.string().min(3).default('hr-intelligence-api'),
    JWT_AUDIENCE: z.string().min(3).default('hr-intelligence-web'),

    RUN_API: booleanFlag(true),
    RUN_WORKERS: booleanFlag(true),
    JOB_PROCESSING_MODE: z.enum(['inline', 'bullmq', 'apify']).default('inline'),

    APIFY_API_TOKEN: optionalSecret,
    APIFY_ACTOR_ID: z.string().trim().min(1).optional(),
    APIFY_API_BASE_URL: z.string().url().default('https://api.apify.com/v2'),
    APIFY_DEFAULT_MEMORY_MBYTES: z.coerce.number().int().min(128).max(32768).default(512),
    APIFY_RUN_TIMEOUT_SECONDS: z.coerce.number().int().positive().max(86400).default(180),
    APIFY_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(10000),
    APIFY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),

    REDIS_ENQUEUE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    INTELLIGENCE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(3),
    QUEUE_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    QUEUE_BACKOFF_MS: z.coerce.number().int().min(100).max(60_000).default(1000),

    LLM_MODE: z.enum(['live', 'fixture']).default('fixture'),
    GEMINI_API_KEY: optionalSecret,
    GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
    AI_PROMPT_VERSION: z.string().default('extraction-v5'),
    EMPLOYEE_MATCH_MIN_CONFIDENCE: z.coerce.number().min(0).max(100).default(75),
    MANUAL_REVIEW_CONFIDENCE: z.coerce.number().min(0).max(100).default(60),

    INTERCOM_ENABLED: booleanFlag(false),
    INTERCOM_ACCESS_TOKEN: optionalSecret,
    INTERCOM_CLIENT_SECRET: optionalSecret,
    INTERCOM_WORKSPACE_ID: optionalSecret,
    INTERCOM_ADMIN_ID: optionalSecret,
    INTERCOM_BOT_ADMIN_ID: optionalSecret,
    INTERCOM_API_BASE_URL: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().url().optional()
    ),
    INTERCOM_API_VERSION: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    INTERCOM_WRITEBACK_TAGS_ENABLED: booleanFlag(true),

    BOX_SYNC_ENABLED: booleanFlag(false),
    BOX_CLIENT_ID: optionalSecret,
    BOX_CLIENT_SECRET: optionalSecret,
    BOX_ENTERPRISE_ID: optionalSecret,
    BOX_FILE_ID: optionalSecret,
    STORE_DIRECTORY_SYNC_CRON: z.string().default('0 0 * * *'),
    SEED_STORE_DIRECTORY_TEST: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),

    RESEND_ENABLED: booleanFlag(false),
    RESEND_API_KEY: optionalSecret,
    RESEND_WEBHOOK_SECRET: optionalSecret,
    RESEND_RECEIVING_DOMAIN: optionalSecret,

    BREVO_ENABLED: booleanFlag(false),
    BREVO_API_KEY: optionalSecret,
    BREVO_SENDER_EMAIL: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().email().optional()
    ),
    BREVO_SENDER_NAME: z.string().trim().min(1).max(120).default('HR Intelligence'),
    PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
    INVITE_TTL_HOURS: z.coerce.number().int().positive().max(168).default(48),

    DEMO_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
    DEMO_AUTH_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
    DEMO_MAX_EMAILS: z.coerce.number().int().positive().default(8),
    DEMO_MAX_SAMPLE_CASES: z.coerce.number().int().positive().default(12),
    DEMO_MAX_LIVE_LLM: z.coerce.number().int().nonnegative().default(3),
    DEMO_RETENTION_HOURS: z.coerce.number().int().positive().default(48),

    S3_ENABLED: booleanFlag(false),
    S3_BUCKET: optionalSecret,
    S3_REGION: optionalSecret,
    S3_ACCESS_KEY_ID: optionalSecret,
    S3_SECRET_ACCESS_KEY: optionalSecret,

    MONITORING_ENABLED: booleanFlag(false),
    SENTRY_DSN: optionalSecret
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production') {
      if (value.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET must contain at least 32 characters in production'
        });
      }
      if (value.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_REFRESH_SECRET must contain at least 32 characters in production'
        });
      }
      if (value.JWT_SECRET === value.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT refresh and access secrets must be different'
        });
      }
    }

    if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true when COOKIE_SAME_SITE=none'
      });
    }

    if (value.INTERCOM_ENABLED) {
      for (const key of [
        'INTERCOM_ACCESS_TOKEN',
        'INTERCOM_CLIENT_SECRET',
        'INTERCOM_WORKSPACE_ID',
        'INTERCOM_ADMIN_ID'
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when INTERCOM_ENABLED=true`
          });
        }
      }
    }

    if (value.LLM_MODE === 'live' && !value.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when LLM_MODE=live'
      });
    }

    if (value.RESEND_ENABLED) {
      for (const key of ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'RESEND_RECEIVING_DOMAIN'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when RESEND_ENABLED=true`
          });
        }
      }
    }

    if (value.BREVO_ENABLED) {
      for (const key of ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when BREVO_ENABLED=true`
          });
        }
      }

      if (value.NODE_ENV === 'production') {
        let publicAppUrl: URL | undefined;
        try {
          publicAppUrl = new URL(value.PUBLIC_APP_URL);
        } catch {
          // PUBLIC_APP_URL is validated as a URL above; keep this guard defensive.
        }

        if (
          !publicAppUrl ||
          publicAppUrl.protocol !== 'https:' ||
          isLocalAppHost(publicAppUrl.hostname)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['PUBLIC_APP_URL'],
            message: 'PUBLIC_APP_URL must be a public HTTPS URL when BREVO_ENABLED=true in production'
          });
        }
      }
    }

    if (value.BOX_SYNC_ENABLED) {
      for (const key of ['BOX_CLIENT_ID', 'BOX_CLIENT_SECRET', 'BOX_ENTERPRISE_ID', 'BOX_FILE_ID'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when BOX_SYNC_ENABLED=true`
          });
        }
      }
    }

    if (value.S3_ENABLED) {
      for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when S3_ENABLED=true`
          });
        }
      }
    }

    if (value.JOB_PROCESSING_MODE === 'bullmq' && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when JOB_PROCESSING_MODE=bullmq'
      });
    }

    if (value.JOB_PROCESSING_MODE === 'apify') {
      for (const key of ['APIFY_API_TOKEN', 'APIFY_ACTOR_ID'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when JOB_PROCESSING_MODE=apify`
          });
        }
      }
    }
  });

export const parseAppEnv = (input: NodeJS.ProcessEnv) => envSchema.parse(input);

export const env = parseAppEnv(process.env);

const PORTFOLIO_BROWSER_ORIGINS = [
  'https://nagumo-hr-intelligence.vercel.app',
  'https://hr-intercom.onrender.com'
];

export const corsAllowlist = (): string[] => {
  const configured = env.CORS_ORIGINS?.trim()
    ? env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    : env.NODE_ENV === 'production' ? [] : ['http://localhost:3001'];

  // Render exposes the service's public origin at runtime. Allowing that exact
  // origin keeps same-service deployments functional without opening CORS.
  const renderOrigin = process.env.RENDER_EXTERNAL_URL?.trim();
  if (renderOrigin && !configured.includes(renderOrigin)) {
    configured.push(renderOrigin);
  }
  for (const origin of PORTFOLIO_BROWSER_ORIGINS) {
    if (!configured.includes(origin)) configured.push(origin);
  }

  return configured;
};
