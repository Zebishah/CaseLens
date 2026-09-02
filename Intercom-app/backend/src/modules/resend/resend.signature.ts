import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SECONDS = 5 * 60;

const decodeSecret = (secret: string): Buffer => {
  const trimmed = secret.trim();
  if (trimmed.startsWith('whsec_')) {
    return Buffer.from(trimmed.slice('whsec_'.length), 'base64');
  }

  return Buffer.from(trimmed, 'base64');
};

export const verifyResendSignature = (input: {
  payload: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  secret: string;
  nowSeconds?: number;
}): boolean => {
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || !input.id || !input.signatureHeader || !input.secret) {
    return false;
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_AGE_SECONDS) {
    return false;
  }

  const signed = `${input.id}.${input.timestamp}.${input.payload}`;
  const expected = createHmac('sha256', decodeSecret(input.secret)).update(signed).digest('base64');
  const candidates = input.signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));

  const expectedBuffer = Buffer.from(expected);
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  });
};
