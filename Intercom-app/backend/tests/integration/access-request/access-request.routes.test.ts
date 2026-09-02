import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../src/middlewares/error.middleware.js';

const mockSubmit = jest.fn();
const mockList = jest.fn();
const mockReview = jest.fn();

await jest.unstable_mockModule(
  '../../../src/modules/access-request/access-request.service.js',
  () => ({
    accessRequestService: {
      submit: mockSubmit,
      list: mockList,
      review: mockReview
    }
  })
);

const { accessRequestRoutes } = await import(
  '../../../src/modules/access-request/access-request.routes.js'
);

const app = express();
app.set('trust proxy', false);
app.use(express.json());
app.use('/api/access-requests', accessRequestRoutes);
app.use(errorHandler);

describe('recruiter access request routes', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockList.mockReset();
    mockReview.mockReset();
    mockSubmit.mockResolvedValue({ received: true });
  });

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
});
