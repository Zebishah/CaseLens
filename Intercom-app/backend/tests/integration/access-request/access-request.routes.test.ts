import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../src/middlewares/error.middleware.js';

const mockSubmit = jest.fn();
const mockList = jest.fn();
const mockReview = jest.fn();
const mockStatus = jest.fn();

await jest.unstable_mockModule(
  '../../../src/modules/access-request/access-request.service.js',
  () => ({
    accessRequestService: {
      submit: mockSubmit,
      list: mockList,
      review: mockReview,
      status: mockStatus
    }
  })
);

const { accessRequestRoutes } = await import(
  '../../../src/modules/access-request/access-request.routes.js'
);
const { generateToken } = await import('../../../src/services/jwt.service.js');

const { authRepository } = await import('../../../src/modules/auth/auth.repository.js');

const app = express();
app.set('trust proxy', false);
app.use(express.json());
app.use('/api/access-requests', accessRequestRoutes);
app.use(errorHandler);

describe('recruiter access request routes', () => {
  beforeEach(() => {
    jest.spyOn(authRepository, 'findUserById').mockImplementation(async (id) => ({
      id, email: id === 1 ? 'admin@example.com' : 'reviewer@example.com',
      name: 'Account', role: id === 1 ? 'admin' : 'viewer', authVersion: 0,
      emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date()
    }));
    mockSubmit.mockReset();
    mockList.mockReset();
    mockReview.mockReset();
    mockStatus.mockReset();
    mockSubmit.mockResolvedValue({ received: true });
  });

  afterEach(() => jest.restoreAllMocks());

  test('accepts a valid public invitation request', async () => {
    const response = await request(app).post('/api/access-requests').send({
      fullName: 'Amina Khan',
      workEmail: 'amina@example.com',
      organization: 'Example Labs',
      role: 'Technical Recruiter',
      purpose: 'I am reviewing this project for a full-stack engineering position.',
      consent: true,
      website: ''
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { received: true }
    });
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  test('rejects missing consent and short purpose text', async () => {
    const response = await request(app).post('/api/access-requests').send({
      fullName: 'Amina Khan',
      workEmail: 'amina@example.com',
      purpose: 'Review',
      consent: false
    });

    expect(response.statusCode).toBe(400);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test('does not expose the review queue without authentication', async () => {
    const response = await request(app).get('/api/access-requests');
    expect(response.statusCode).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  test('lists requests for an authenticated administrator without requiring a GET body', async () => {
    mockList.mockResolvedValue([]);
    const token = generateToken({
      sub: 1,
      email: 'admin@example.com',
      role: 'admin', authVersion: 0
    });

    const response = await request(app)
      .get('/api/access-requests?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, data: [] });
    expect(mockList).toHaveBeenCalledWith('pending');
  });

  test('rejects malformed workspace identifiers', async () => {
    const response = await request(app).post('/api/access-requests').send({
      fullName: 'Amina Khan',
      workEmail: 'amina@example.com',
      workspaceId: 'not safe',
      purpose: 'I am reviewing this project for a full-stack engineering position.',
      consent: true,
      website: ''
    });

    expect(response.statusCode).toBe(400);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test('returns self status only to an authenticated reviewer', async () => {
    mockStatus.mockResolvedValue({ status: 'pending', workspaceId: 'workspace_demo_123', connectedInboxUrl: null });
    const token = generateToken({ sub: 2, email: 'reviewer@example.com', role: 'viewer', authVersion: 0 });

    const response = await request(app).get('/api/access-requests/me').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual({ status: 'pending', workspaceId: 'workspace_demo_123', connectedInboxUrl: null });
    expect(response.body.data).not.toHaveProperty('accessToken');
    expect(response.body.data).not.toHaveProperty('clientSecret');
  });

  test('does not allow a reviewer to access the admin queue', async () => {
    const token = generateToken({ sub: 2, email: 'reviewer@example.com', role: 'viewer', authVersion: 0 });
    const response = await request(app).get('/api/access-requests').set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});
