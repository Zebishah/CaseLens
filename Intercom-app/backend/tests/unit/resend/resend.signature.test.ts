import { describe, expect, test } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { verifyResendSignature } from '../../../src/modules/resend/resend.signature.js';

const secret = `whsec_${Buffer.from('test-resend-secret').toString('base64')}`;
const payload = '{"type":"email.received","data":{"email_id":"abc"}}';

const sign = (id: string, timestamp: string): string => {
  const decoded = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const digest = createHmac('sha256', decoded).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return `v1,${digest}`;
};

describe('verifyResendSignature', () => {
  test('accepts a valid svix signature over the raw body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = 'msg_test_1';
    expect(
      verifyResendSignature({
        payload,
        id,
        timestamp,
        signatureHeader: sign(id, timestamp),
        secret
      })
    ).toBe(true);
  });

  test('rejects a tampered body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = 'msg_test_2';
    expect(
      verifyResendSignature({
        payload: `${payload} `,
        id,
        timestamp,
        signatureHeader: sign(id, timestamp),
        secret
      })
    ).toBe(false);
  });

  test('rejects stale timestamps', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 10_000);
    const id = 'msg_test_3';
    expect(
      verifyResendSignature({
        payload,
        id,
        timestamp,
        signatureHeader: sign(id, timestamp),
        secret
      })
    ).toBe(false);
  });
});
