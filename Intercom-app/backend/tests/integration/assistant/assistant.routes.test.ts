import request from 'supertest';
import type { Express } from 'express';

const { app } = await import('../../../src/app.js');

describe('HR Intelligence assistant routes', () => {
  test('answers a public product question', async () => {
    const response = await request(app as Express).post('/api/assistant/ask').send({
      message: 'Why does the product integrate with Intercom?',
      route: '/'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.readOnly).toBe(true);
    expect(response.body.data.answer).toContain('existing workflow');
  });

  test('rejects an invalid supplied bearer token instead of downgrading to public access', async () => {
    const response = await request(app as Express)
      .post('/api/assistant/ask')
      .set('Authorization', 'Bearer definitely-not-a-token')
      .send({ message: 'What problem does HR Intelligence solve?', route: '/' });

    expect(response.statusCode).toBe(401);
  });

  test('validates bounded input', async () => {
    const response = await request(app as Express).post('/api/assistant/ask').send({ message: '' });
    expect(response.statusCode).toBe(400);
  });
});
