import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.config.js';

export type AppJwtPayload = {
  sub: number;
  email: string;
  role: string;
};

type TokenType = 'access' | 'refresh';

const sign = (
  payload: AppJwtPayload,
  tokenType: TokenType,
  secret: string,
  expiresIn: string,
  jwtId?: string
): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    audience: env.JWT_AUDIENCE,
    issuer: env.JWT_ISSUER,
    expiresIn: expiresIn as SignOptions['expiresIn'],
    ...(jwtId ? { jwtid: jwtId } : {})
  };
  return jwt.sign({ ...payload, tokenType }, secret, options);
};

const verify = (token: string, tokenType: TokenType, secret: string): AppJwtPayload => {
  const options: VerifyOptions = {
    algorithms: ['HS256'],
    audience: env.JWT_AUDIENCE,
    issuer: env.JWT_ISSUER
  };
  const payload = jwt.verify(token, secret, options);
  if (
    typeof payload === 'string' ||
    !('sub' in payload) ||
    !('email' in payload) ||
    !('role' in payload) ||
    payload.tokenType !== tokenType
  ) {
    throw new Error('Invalid token payload');
  }

  return {
    sub: Number(payload.sub),
    email: String(payload.email),
    role: String(payload.role)
  };
};

export const generateToken = (payload: AppJwtPayload): string =>
  sign(payload, 'access', env.JWT_SECRET, env.JWT_EXPIRES_IN);

export const generateTokenWithExpiry = (payload: AppJwtPayload, expiresIn: string): string =>
  sign(payload, 'access', env.JWT_SECRET, expiresIn);

export const generateRefreshToken = (payload: AppJwtPayload): string =>
  sign(payload, 'refresh', env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN, randomUUID());

export const verifyToken = (token: string): AppJwtPayload =>
  verify(token, 'access', env.JWT_SECRET);

export const verifyRefreshToken = (token: string): AppJwtPayload =>
  verify(token, 'refresh', env.JWT_REFRESH_SECRET);
