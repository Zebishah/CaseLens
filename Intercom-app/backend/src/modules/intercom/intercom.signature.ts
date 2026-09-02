import { createHmac, timingSafeEqual } from 'node:crypto';
import { intercomConfig } from '../../config/intercom.config.js';

const WEBHOOK_PREFIX = 'sha1=';

const digestToBuffer = (hex: string): Buffer | null => {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  return Buffer.from(hex, 'hex');
};

const safeEqualHex = (expectedHex: string, providedHex: string): boolean => {
  const expected = digestToBuffer(expectedHex);
  const provided = digestToBuffer(providedHex);

  if (!expected || !provided || expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
};

export const computeWebhookSignature = (rawBody: Buffer, secret = intercomConfig.clientSecret): string => {
  const digest = createHmac('sha1', secret).update(rawBody).digest('hex');
  return `${WEBHOOK_PREFIX}${digest}`;
};

export const verifyWebhookSignature = (
  signatureHeader: string | string[] | undefined,
  rawBody: Buffer,
  secret = intercomConfig.clientSecret
): boolean => {
  if (!signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  if (!signatureHeader.startsWith(WEBHOOK_PREFIX)) {
    return false;
  }

  const provided = signatureHeader.slice(WEBHOOK_PREFIX.length);
  const expected = createHmac('sha1', secret).update(rawBody).digest('hex');

  return safeEqualHex(expected, provided);
};

const canvasPayloadBytes = (body: unknown): Buffer =>
  Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8');

export const computeCanvasSignature = (
  body: unknown,
  secret = intercomConfig.clientSecret
): string =>
  createHmac('sha256', secret).update(canvasPayloadBytes(body)).digest('hex');

export const verifyCanvasSignature = (
  signatureHeader: string | string[] | undefined,
  body: unknown,
  secret = intercomConfig.clientSecret
): boolean => {
  if (!signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  const expected = computeCanvasSignature(body, secret);
  return safeEqualHex(expected, signatureHeader);
};
