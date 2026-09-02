import request from 'supertest';
import { app } from '../../../src/app.js';

describe('User integration tests', () => {
  test('GET /api/users/:id validates numeric id', async () => {
    const res = await request(app).get('/api/users/invalid-id');
    expect(res.statusCode).toBe(400);
  });
});
