import { jest } from '@jest/globals';
import type { Express } from 'express';
import request from 'supertest';

const session = {
  id: 7,
  receivingAddress: 'case-token@inbox.caseops.example',
  emailCount: 0,
  maxEmails: 8,
  caseSubmissionCount: 0,
  maxCaseSubmissions: 12,
  liveLlmCount: 0,
  maxLiveLlm: 3,
  expiresAt: new Date('2026-09-02T00:00:00.000Z'),
  revoked: false,
  active: true
};

const mockIncrement = jest.fn(async () => undefined);
const mockInsertFeedback = jest.fn(async () => ({
  id: 1,
  conversationId: 42,
  rating: 'accurate',
  comment: 'Looks correct'
}));
const mockProcessDemoCase = jest.fn(async () => ({
  conversationId: 42,
  status: 'ready',
  outcome: 'completed',
  snapshot: {
    processingMode: 'fixture',
    employeeMatches: [{ canonicalName: 'Jordan Hale', confidenceScore: 92 }],
    relatedCases: [{ subject: 'Prior attendance' }],
    caseType: 'attendance'
  },
  safeError: null
}));

await jest.unstable_mockModule('../../../src/modules/demo/demo-process.service.js', () => ({
  processDemoCase: mockProcessDemoCase,
  liveAiConfigured: () => false,
  processingModeLabel: (mode: 'live' | 'fixture') =>
    mode === 'live' ? 'Live AI' : 'Deterministic demo'
}));

await jest.unstable_mockModule('../../../src/modules/demo/demo-session.service.js', () => ({
  demoSessionService: {
    create: async () => ({
      token: 'demo-test-token',
      session,
      receivingAddress: session.receivingAddress
    }),
    requireActive: async () => session,
    publicView: (row: typeof session, token?: string) => ({
      token,
      receivingAddress: row.receivingAddress,
      expiresAt: row.expiresAt.toISOString(),
      remainingCases: 12,
      remainingEmails: 8,
      remainingLiveLlm: 3
    }),
    incrementCaseSubmission: mockIncrement
  }
}));

await jest.unstable_mockModule('../../../src/modules/ingestion/ingestion.service.js', () => ({
  ingestionService: {
    ingest: async () => ({
      duplicate: false,
      inboundEventId: 11,
      conversationId: 42,
      correlationId: '11111111-1111-1111-1111-111111111111',
      status: 'queued'
    })
  }
}));

await jest.unstable_mockModule('../../../src/modules/conversation/conversation.repository.js', () => ({
  conversationRepository: {
    listByDemoSessionId: async () => [
      {
        id: 42,
        source: 'demo',
        subject: 'Attendance — Jordan Hale',
        intelligenceStatus: 'ready',
        caseType: 'attendance',
        reporterStoreNumber: '1042',
        processingMode: 'fixture',
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
        intelligenceSnapshot: {
          employeeMatches: [{ canonicalName: 'Jordan Hale' }],
          relatedCases: [{ subject: 'Prior attendance' }],
          employeeMatchConfidence: 92
        }
      }
    ],
    findById: async () => ({
      id: 42,
      demoSessionId: 7,
      source: 'demo',
      subject: 'Attendance — Jordan Hale',
      intelligenceStatus: 'ready',
      processingMode: 'fixture',
      reporterEmail: '1042@northwind.co',
      reporterName: 'Store 1042 Manager',
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      updatedAt: new Date('2026-09-01T12:00:01.000Z'),
      correlationId: '11111111-1111-1111-1111-111111111111',
      intelligenceSnapshot: {
        processingMode: 'fixture',
        employeeMatches: [{ canonicalName: 'Jordan Hale', confidenceScore: 92 }],
        relatedCases: [{ subject: 'Prior attendance', matchedEmployeeNames: ['Jordan Hale'] }],
        ccRecipients: { recipients: [{ name: 'Sam Patel', email: 'sam.patel@northwind.co', role: 'DM' }] },
        processedAt: '2026-09-01T12:00:01.000Z',
        processingDurationMs: 40
      }
    }),
    findMessagesByConversationId: async () => [
      { messageBody: 'Jordan Hale has been late three times this week at store 1042.' }
    ]
  }
}));

await jest.unstable_mockModule('../../../src/modules/cases/case-review.repository.js', () => ({
  caseReviewRepository: {
    insertFeedback: mockInsertFeedback
  }
}));

const { app } = await import('../../../src/app.js');

describe('Demo sample-case HTTP flow', () => {
  test('starts a session, submits a sample, reads status, and stores feedback', async () => {
    const created = await request(app as Express).post('/api/demo/sessions').send({});
    expect(created.statusCode).toBe(201);
    const token = created.body.data.session.token as string;
    expect(token).toBe('demo-test-token');
    expect(created.body.data.warning).toMatch(/not submit personal/i);

    const submitted = await request(app as Express)
      .post('/api/demo/sample')
      .set('x-demo-session', token)
      .send({ scenarioId: 'confident-employee', processingMode: 'fixture' });

    expect(submitted.statusCode).toBe(202);
    expect(submitted.body.data.conversationId).toBe(42);
    expect(submitted.body.data.processingModeLabel).toBe('Deterministic demo');
    expect(submitted.body.data.warning).toMatch(/not a live model response/i);
    expect(mockIncrement).toHaveBeenCalled();

    const processed = await request(app as Express)
      .post('/api/demo/cases/42/process')
      .set('x-demo-session', token)
      .send({});
    expect(processed.statusCode).toBe(200);
    expect(processed.body.data.outcome).toBe('completed');
    expect(processed.body.data.snapshot.employeeMatches[0].canonicalName).toBe('Jordan Hale');

    const listed = await request(app as Express)
      .get('/api/demo/cases')
      .set('x-demo-session', token);
    expect(listed.statusCode).toBe(200);
    expect(listed.body.data.items[0].status).toBe('ready');

    const detail = await request(app as Express)
      .get('/api/demo/cases/42')
      .set('x-demo-session', token);
    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.snapshot.employeeMatches[0].canonicalName).toBe('Jordan Hale');

    const feedback = await request(app as Express)
      .post('/api/demo/cases/42/feedback')
      .set('x-demo-session', token)
      .send({ rating: 'accurate', comment: 'Looks correct' });
    expect(feedback.statusCode).toBe(201);
    expect(mockInsertFeedback).toHaveBeenCalledWith({
      conversationId: 42,
      rating: 'accurate',
      comment: 'Looks correct'
    });
  });

  test('rejects sample submission without a session token', async () => {
    const res = await request(app as Express)
      .post('/api/demo/sample')
      .send({ scenarioId: 'confident-employee' });
    expect(res.statusCode).toBe(401);
  });

  test('accepts an arbitrary custom case and processes it through the shared endpoint', async () => {
    const created = await request(app as Express).post('/api/demo/sessions').send({});
    const token = created.body.data.session.token as string;

    const submitted = await request(app as Express)
      .post('/api/demo/custom')
      .set('x-demo-session', token)
      .send({
        senderEmail: '1042@northwind.co',
        subject: 'Conduct — Alex Rivera',
        content: 'Alex Rivera raised a safety concern at store 1042 and asked for follow-up today.',
        processingMode: 'fixture'
      });

    expect(submitted.statusCode).toBe(202);
    expect(submitted.body.data.conversationId).toBe(42);
    expect(submitted.body.data.status).toBe('queued');

    const processed = await request(app as Express)
      .post('/api/demo/cases/42/process')
      .set('x-demo-session', token)
      .send({});
    expect(processed.statusCode).toBe(200);
    expect(processed.body.data.outcome).toBe('completed');
  });

  test('rejects live custom cases when live AI is not configured', async () => {
    const created = await request(app as Express).post('/api/demo/sessions').send({});
    const token = created.body.data.session.token as string;

    const submitted = await request(app as Express)
      .post('/api/demo/custom')
      .set('x-demo-session', token)
      .send({
        senderEmail: '1042@northwind.co',
        subject: 'Conduct — Alex Rivera',
        content: 'Alex Rivera raised a safety concern at store 1042 and asked for follow-up today.',
        processingMode: 'live'
      });

    expect(submitted.statusCode).toBe(400);
    expect(submitted.body.message).toMatch(/live ai is not configured/i);
  });
});
