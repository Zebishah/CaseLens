import { z } from 'zod';

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
    password: z.string().min(1)
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
    password: z.string().min(12).max(200)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
