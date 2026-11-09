import { z } from 'zod';

export const newPasswordSchema = z.string().min(12).max(72).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Password must be at most 72 UTF-8 bytes'
);

export const changePasswordSchema = z.object({
  body: z.object({ currentPassword: z.string().min(1).max(200), newPassword: newPasswordSchema }).strict(),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const verifyEmailCodeSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z.string().regex(/^\d{6}$/)
  }).strict(),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const passwordResetRequestSchema = z.object({
  body: z.object({ email: z.string().trim().toLowerCase().email() }).strict(),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const passwordResetConfirmSchema = z.object({
  body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: newPasswordSchema }).strict(),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    name: z.string().trim().min(1).max(255)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(200)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const refreshTokenSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const inspectInviteSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({ token: z.string().min(32).max(200) })
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(32).max(200),
    password: newPasswordSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
