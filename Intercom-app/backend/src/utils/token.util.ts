import {
  generateRefreshToken,
  generateToken,
  type AppJwtPayload
} from '../services/jwt.service.js';

export const createAccessToken = (payload: AppJwtPayload): string => generateToken(payload);
export const createRefreshToken = (payload: AppJwtPayload): string =>
  generateRefreshToken(payload);
