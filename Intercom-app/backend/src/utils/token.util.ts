import { generateToken, type AppJwtPayload } from '../services/jwt.service.js';

export const createAccessToken = (payload: AppJwtPayload): string => generateToken(payload);
