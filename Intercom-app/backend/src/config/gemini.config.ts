import { env } from './env.config.js';

export const geminiConfig = {
  apiKey: env.GEMINI_API_KEY ?? '',
  model: env.GEMINI_MODEL
};
