import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/app.js';
import { generateToken } from '../../../src/services/jwt.service.js';

describe('Authorization', () => {
  test('GET /api/users requires authentication', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/operations/queues requires authentication', async () => {
    const res = await request(app).get('/api/operations/queues');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/evaluation is limited to admins and the marked recruiter demo', async () => {
    const viewerToken = generateToken({ sub: 2, email: 'viewer@example.com', role: 'viewer' });
    const demoToken = generateToken({ sub: 3, email: 'demo@example.com', role: 'viewer', demo: true });

    const viewer = await request(app).get('/api/evaluation').set('Authorization', `Bearer ${viewerToken}`);
    expect(viewer.statusCode).toBe(403);

    const demo = await request(app).get('/api/evaluation').set('Authorization', `Bearer ${demoToken}`);
    expect(demo.statusCode).toBe(200);
    expect(demo.body.data).toEqual(expect.objectContaining({ method: 'subject-heuristic' }));
  });

  test('the recruiter demo cannot reach admin mutation routes', async () => {
    const demoToken = generateToken({ sub: 3, email: 'demo@example.com', role: 'viewer', demo: true });
    const authorization = { Authorization: `Bearer ${demoToken}` };

    const recovery = await request(app).post('/api/operations/outbox/recover').set(authorization).send({});
    const directoryImport = await request(app).post('/api/directory/import').set(authorization).send({ csv: 'store_number,store_name\n1042,Harbor Street' });
    const accessQueue = await request(app).get('/api/access-requests').set(authorization);

    expect(recovery.statusCode).toBe(403);
    expect(directoryImport.statusCode).toBe(403);
    expect(accessQueue.statusCode).toBe(403);
  });
});
