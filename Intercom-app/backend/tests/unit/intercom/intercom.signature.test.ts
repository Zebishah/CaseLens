import { createHmac } from 'node:crypto';
import {
  computeCanvasSignature,
  computeWebhookSignature,
  verifyCanvasSignature,
  verifyWebhookSignature
} from '../../../src/modules/intercom/intercom.signature.js';

const TEST_SECRET = 'test-intercom-client-secret';

describe('intercom.signature', () => {
  describe('webhook', () => {
    it('verifies valid sha1 signature on raw body', () => {
      const rawBody = Buffer.from(
        JSON.stringify({ topic: 'conversation.created', data: { item: { id: '1' } } })
      );
      const signature = computeWebhookSignature(rawBody, TEST_SECRET);

      expect(verifyWebhookSignature(signature, rawBody, TEST_SECRET)).toBe(true);
    });

    it('rejects tampered body', () => {
      const rawBody = Buffer.from('{"topic":"conversation.created"}');
      const signature = computeWebhookSignature(rawBody, TEST_SECRET);
      const tampered = Buffer.from('{"topic":"conversation.updated"}');

      expect(verifyWebhookSignature(signature, tampered, TEST_SECRET)).toBe(false);
    });

    it('rejects missing or malformed signature header', () => {
      const rawBody = Buffer.from('{}');
      const digest = createHmac('sha1', TEST_SECRET).update(rawBody).digest('hex');

      expect(verifyWebhookSignature(undefined, rawBody, TEST_SECRET)).toBe(false);
      expect(verifyWebhookSignature(digest, rawBody, TEST_SECRET)).toBe(false);
      expect(verifyWebhookSignature(`sha256=${digest}`, rawBody, TEST_SECRET)).toBe(false);
    });
  });

  describe('canvas', () => {
    it('verifies valid sha256 signature on json body', () => {
      const body = { conversation_id: '999', admin_id: '1' };
      const signature = computeCanvasSignature(body, TEST_SECRET);

      expect(verifyCanvasSignature(signature, body, TEST_SECRET)).toBe(true);
    });

    it('rejects modified canvas body', () => {
      const body = { conversation_id: '999' };
      const signature = computeCanvasSignature(body, TEST_SECRET);

      expect(verifyCanvasSignature(signature, { conversation_id: '1000' }, TEST_SECRET)).toBe(
        false
      );
    });

    it('verifies signature on raw body bytes (Intercom production path)', () => {
      const rawBody = Buffer.from(
        JSON.stringify({ conversation_id: '215474091120045', admin_id: '1' })
      );
      const signature = computeCanvasSignature(rawBody, TEST_SECRET);

      expect(verifyCanvasSignature(signature, rawBody, TEST_SECRET)).toBe(true);
    });
  });
});
