import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.config.js';
import { sendSuccess } from '../../utils/response.util.js';
import { AppError } from '../../utils/error.util.js';
import { buildCorrelationId } from '../ingestion/ingestion.normalize.js';
import { ingestionService } from '../ingestion/ingestion.service.js';
import { demoSessionService } from './demo-session.service.js';
import { getSampleScenario, SAMPLE_SCENARIOS } from './sample-scenarios.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { caseReviewRepository } from '../cases/case-review.repository.js';
import { liveAiConfigured, processDemoCase, processingModeLabel } from './demo-process.service.js';

const sessionHeader = (req: Request): string => {
  const header = req.header('x-demo-session');
  if (header?.trim()) {
    return header.trim();
  }

  const bearer = req.header('authorization');
  if (bearer?.startsWith('Demo ')) {
    return bearer.slice(5).trim();
  }

  throw AppError.unauthorized('Demo session token is required');
};

export const demoController = {
  async createSession(_req: Request, res: Response): Promise<void> {
    const created = await demoSessionService.create();
    sendSuccess(
      res,
      {
        warning:
          'Do not submit personal or confidential information. This demonstration retains data only until the session expires.',
        session: demoSessionService.publicView(created.session, created.token),
        scenarios: SAMPLE_SCENARIOS.map((scenario) => ({
          id: scenario.id,
          title: scenario.title,
          summary: scenario.summary
        })),
        llmModeDefault: env.LLM_MODE,
        jobProcessingMode: env.JOB_PROCESSING_MODE,
        liveAiConfigured: liveAiConfigured()
      },
      201
    );
  },

  async getSession(req: Request, res: Response): Promise<void> {
    const session = await demoSessionService.requireActive(sessionHeader(req));
    sendSuccess(res, demoSessionService.publicView(session));
  },

  async submitSample(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        scenarioId: z.string().min(1),
        processingMode: z.enum(['live', 'fixture']).optional()
      })
      .parse(req.body);

    const scenario = getSampleScenario(body.scenarioId);
    if (!scenario) {
      throw AppError.badRequest('Unknown sample scenario');
    }

    const session = await demoSessionService.requireActive(sessionHeader(req));
    const processingMode = 'fixture';
    if (session.caseSubmissionCount >= session.maxCaseSubmissions) {
      throw AppError.badRequest('This demo session has reached its case submission limit');
    }

    const result = await ingestionService.ingest({
      source: 'demo',
      externalEventId: `demo-${session.id}-${body.scenarioId}`,
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      recipients: scenario.recipients,
      subject: scenario.subject,
      plainTextContent: scenario.body,
      receivedAt: new Date(),
      attachments: [],
      providerMetadata: { scenarioId: scenario.id, demo: true },
      correlationId: buildCorrelationId(),
      demoSessionId: String(session.id),
      processingMode
    });

    if (!result.duplicate) {
      await demoSessionService.incrementCaseSubmission(session, false);
    }

    sendSuccess(
      res,
      {
        ...result,
        status: 'queued',
        processingMode,
        processingModeLabel: processingModeLabel(processingMode),
        warning: 'Deterministic demo. This is not a live model response.'
      },
      202
    );
  },

  async submitCustom(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        senderEmail: z.string().email().max(320),
        senderName: z.string().max(255).optional(),
        subject: z.string().min(3).max(200),
        content: z.string().min(20).max(8_000),
        processingMode: z.enum(['live', 'fixture']).optional()
      })
      .parse(req.body);

    const session = await demoSessionService.requireActive(sessionHeader(req));
    const processingMode =
      body.processingMode ?? (env.LLM_MODE === 'live' ? 'live' : 'fixture');
    if (processingMode === 'live' && !liveAiConfigured()) {
      throw AppError.badRequest(
        'Live AI is not configured for this demonstration. Submit a deterministic sample scenario instead.'
      );
    }
    if (processingMode === 'live' && session.liveLlmCount >= session.maxLiveLlm) {
      throw AppError.badRequest(
        'This demonstration has reached its live AI limit. Use a deterministic sample scenario, or start a new session.'
      );
    }
    if (session.caseSubmissionCount >= session.maxCaseSubmissions) {
      throw AppError.badRequest('This demo session has reached its case submission limit');
    }

    const result = await ingestionService.ingest({
      source: 'demo',
      externalEventId: `demo-custom-${session.id}-${Date.now()}`,
      senderEmail: body.senderEmail,
      senderName: body.senderName ?? null,
      recipients: [session.receivingAddress],
      subject: body.subject,
      plainTextContent: body.content,
      receivedAt: new Date(),
      attachments: [],
      providerMetadata: { demo: true, custom: true },
      correlationId: buildCorrelationId(),
      demoSessionId: String(session.id),
      processingMode
    });

    if (!result.duplicate) {
      await demoSessionService.incrementCaseSubmission(session, processingMode === 'live');
    }

    sendSuccess(res, {
      ...result,
      status: 'queued',
      processingMode,
      processingModeLabel: processingModeLabel(processingMode),
      warning:
        processingMode === 'live'
          ? 'Live AI. This uses the configured server-side model.'
          : 'Deterministic demo. This is not a live model response.'
    }, 202);
  },

  async listSessionCases(req: Request, res: Response): Promise<void> {
    const session = await demoSessionService.requireActive(sessionHeader(req));
    const cases = await conversationRepository.listByDemoSessionId(session.id);
    sendSuccess(res, {
      items: (cases ?? []).map((row) => ({
        id: row.id,
        source: row.source ?? 'demo',
        subject: row.subject,
        status: row.intelligenceStatus,
        category: row.caseType,
        employee: row.intelligenceSnapshot?.employeeMatches?.[0]?.canonicalName ?? null,
        storeNumber: row.reporterStoreNumber,
        relatedCaseCount: row.intelligenceSnapshot?.relatedCases?.length ?? 0,
        confidence: row.intelligenceSnapshot?.employeeMatchConfidence ?? null,
        receivedAt: row.createdAt,
        processingMode: row.processingMode
      }))
    });
  },

  async getSessionCase(req: Request, res: Response): Promise<void> {
    const session = await demoSessionService.requireActive(sessionHeader(req));
    const id = Number(req.params.id);
    const row = await conversationRepository.findById(id);
    if (!row || row.demoSessionId !== session.id) {
      throw AppError.notFound('Case not found');
    }

    const messages = await conversationRepository.findMessagesByConversationId(id);
    sendSuccess(res, {
      case: {
        id: row.id,
        status: row.intelligenceStatus,
        source: row.source,
        processingMode: row.processingMode,
        subject: row.subject
      },
      conversation: {
        sender: row.reporterEmail,
        senderName: row.reporterName,
        subject: row.subject,
        source: row.source ?? 'demo',
        body: messages[0]?.messageBody ?? null
      },
      snapshot: row.intelligenceSnapshot,
      timeline: {
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        processedAt: row.intelligenceSnapshot?.processedAt ?? null,
        processingDurationMs: row.intelligenceSnapshot?.processingDurationMs ?? null,
        correlationId: row.correlationId
      }
    });
  },

  async feedback(req: Request, res: Response): Promise<void> {
    const session = await demoSessionService.requireActive(sessionHeader(req));
    const id = Number(req.params.id);
    const row = await conversationRepository.findById(id);
    if (!row || row.demoSessionId !== session.id) {
      throw AppError.notFound('Case not found');
    }

    const body = z
      .object({
        rating: z.enum(['accurate', 'needs_review', 'incorrect']),
        comment: z.string().max(1000).optional()
      })
      .parse(req.body);

    const saved = await caseReviewRepository.insertFeedback({
      conversationId: id,
      rating: body.rating,
      comment: body.comment ?? null
    });

    sendSuccess(res, saved, 201);
  },

  async processCase(req: Request, res: Response): Promise<void> {
    const session = await demoSessionService.requireActive(sessionHeader(req));
    const conversationId = Number(req.params.id);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw AppError.badRequest('Invalid case id');
    }

    const force = req.body?.force === true;
    const result = await processDemoCase({
      sessionId: session.id,
      conversationId,
      force
    });

    sendSuccess(res, result, result.outcome === 'queued' ? 202 : 200);
  }
};
