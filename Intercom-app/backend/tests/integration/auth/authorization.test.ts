import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('Authorization', () => {
  test('GET /api/users requires authentication', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/operations/queues requires authentication', async () => {
    const res = await request(app).get('/api/operations/queues');
    expect(res.statusCode).toBe(401);
  });
});
