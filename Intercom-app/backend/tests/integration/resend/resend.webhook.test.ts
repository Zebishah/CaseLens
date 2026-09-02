import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('Resend webhook', () => {
  test('POST /webhooks/resend rejects an unverified body', async () => {
    const res = await request(app)
      .post('/webhooks/resend')
      .set('Content-Type', 'application/json')
      .send({ type: 'email.received', data: { email_id: 'x' } });

    expect([400, 401, 503]).toContain(res.statusCode);
  });
});
