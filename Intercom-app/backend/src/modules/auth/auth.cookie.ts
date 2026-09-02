import type { Request, Response } from 'express';
import { env } from '../../config/env.config.js';

const durationMs = (value: string): number => {
  const match = /^([1-9]\d*)(s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return amount * multipliers[match[2].toLowerCase()];
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/auth'
}) as const;

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: durationMs(env.JWT_REFRESH_EXPIRES_IN)
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(env.AUTH_COOKIE_NAME, cookieOptions());
};

export const readRefreshCookie = (req: Request): string | null => {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === env.AUTH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
};
