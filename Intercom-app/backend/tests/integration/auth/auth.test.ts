import request from 'supertest';
import { app } from '../../../src/app.js';

describe('Auth integration tests', () => {
  test('replaces unsafe request identifiers instead of reflecting them', async () => {
    const unsafeId = 'x'.repeat(200);
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-request-id', unsafeId)
      .send({ email: 'bad' });

    expect(res.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.headers['x-request-id']).not.toBe(unsafeId);
  });

  test('POST /api/auth/login - invalid body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, message: 'Validation error' })
    );
  });

  test('POST /api/auth/register is invite-controlled', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new-user@example.com',
      password: 'not-a-shared-password',
      name: 'New User'
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain('invite-controlled');
  });

  test('POST /api/auth/refresh-token requires the signed HttpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/refresh-token').send({});
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  test('POST /api/auth/refresh-token ignores forged body tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: 'not-a-valid-session' });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/auth/logout clears the refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', ['caseops_session=expired']);
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']?.join(';')).toContain('caseops_session=');
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, data: { signedOut: true } })
    );
  });
});
