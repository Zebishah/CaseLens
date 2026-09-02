import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.config.js';

export type AppJwtPayload = {
  sub: number;
  email: string;
  role: string;
};

export const generateToken = (payload: AppJwtPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = (token: string): AppJwtPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || !('sub' in payload) || !('email' in payload) || !('role' in payload)) {
    throw new Error('Invalid token payload');
  }

  return {
    sub: Number(payload.sub),
    email: String(payload.email),
    role: String(payload.role)
  };
};
