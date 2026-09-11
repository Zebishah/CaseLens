import {
  generateRefreshToken,
  generateToken,
  generateTokenWithExpiry,
  type AppJwtPayload
} from '../services/jwt.service.js';

export const createAccessToken = (payload: AppJwtPayload): string => generateToken(payload);
export const createShortLivedAccessToken = (payload: AppJwtPayload, expiresIn: string): string =>
  generateTokenWithExpiry(payload, expiresIn);
export const createRefreshToken = (payload: AppJwtPayload): string =>
  generateRefreshToken(payload);
