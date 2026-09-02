import request from 'supertest';
import { app } from '../../../src/app.js';

describe('Auth integration tests', () => {
  test('POST /api/auth/login - invalid body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, message: 'Validation error' })
    );
  });

  test('POST /api/auth/refresh-token', async () => {
    const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: 'dummy' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
