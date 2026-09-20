import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response.util.js';
import { AppError } from '../../utils/error.util.js';
import { conversationRepository } from '../conversation/conversation.repository.js';
import { db } from '../../database/connection.js';
import { caseCorrections, caseFeedback } from '../../database/schema/case_review.js';
import { eq } from 'drizzle-orm';
import { ingestionRepository } from '../ingestion/ingestion.repository.js';
import { buildIntercomConversationUrl } from '../canvas/canvas.url.util.js';
import { intercomConfig } from '../../config/intercom.config.js';
import { INTELLIGENCE_STATUS, type IntelligenceStatus } from '../../constants/intelligence.constants.js';
import { formatCaseTypeLabel } from '../conversation/case-type.util.js';
import {
  applyOperatorCorrectionToSnapshot,
  isOperatorCorrectionField
} from './operator-correction.util.js';
import { caseTrendsRepository, TREND_RANGES } from './case-trends.js';

const toCaseSummary = (row: Awaited<ReturnType<typeof conversationRepository.findById>>) => {
  if (!row) {
    return null;
  }

  const snapshot = row.intelligenceSnapshot;
  return {
    id: row.id,
    source: row.source ?? 'intercom',
    externalId: row.intercomId,
    subject: row.subject,
    status: row.intelligenceStatus,
    category: row.caseType,
    reporterName: row.reporterName,
    reporterEmail: row.reporterEmail,
    storeNumber: row.reporterStoreNumber,
    companyDomain: row.reporterCompanyDomain,
    relatedCaseCount:
      (snapshot?.relatedCases?.length ?? 0) + (snapshot?.fuzzyRelatedCases?.length ?? 0),
    confidence: snapshot?.employeeMatchConfidence ?? snapshot?.employeeMatches?.[0]?.confidenceScore ?? null,
    processingMode: snapshot?.processingMode ?? row.processingMode,
    requiresManualReview: snapshot?.requiresManualReview ?? false,
    receivedAt: row.createdAt,
    employee:
      snapshot?.employeeMatches?.[0]?.canonicalName ??
      snapshot?.unresolvedEmployeeMention ??
      null,
    mentionStatus: snapshot?.employeeMentionStatus ?? null,
    stakeholders: snapshot?.ccRecipients ?? null,
    intercomSyncStatus: row.intercomSyncStatus ?? null,
    openInIntercomUrl:
      (row.source ?? 'intercom') === 'intercom' && intercomConfig.enabled && intercomConfig.workspaceId
        ? buildIntercomConversationUrl(row.intercomId)
        : null
  };
};

export const casesController = {
  async trends(req: Request, res: Response): Promise<void> {
    const query = z.object({ range: z.enum(TREND_RANGES).default('30d') }).parse(req.query);
    sendSuccess(res, await caseTrendsRepository.get(query.range));
  },

  async list(req: Request, res: Response): Promise<void> {
    const query = z
      .object({
        q: z.string().optional(),
        status: z.string().optional(),
        source: z.string().optional(),
        category: z.string().optional(),
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(20)
      })
      .parse(req.query);

    const result = await conversationRepository.listCases({
      query: query.q,
      status: query.status,
      source: query.source,
      category: query.category,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });

    sendSuccess(res, {
      items: result.rows.map((row) => toCaseSummary(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total
    });
  },

  async get(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const row = await conversationRepository.findById(id);
    if (!row) {
      throw AppError.notFound('Case not found');
    }

    const messages = await conversationRepository.findMessagesByConversationId(id);
    const corrections = await db
      .select()
      .from(caseCorrections)
      .where(eq(caseCorrections.conversationId, id));
    const feedback = await db
      .select()
      .from(caseFeedback)
      .where(eq(caseFeedback.conversationId, id));

    const snapshot = row.intelligenceSnapshot
      ? {
          ...row.intelligenceSnapshot,
          relatedCases: (row.intelligenceSnapshot.relatedCases ?? []).map((related) => ({
            ...related,
            openInIntercomUrl:
              related.intercomId && intercomConfig.enabled && intercomConfig.workspaceId
                ? buildIntercomConversationUrl(related.intercomId)
                : null
          }))
        }
      : row.intelligenceSnapshot;

    sendSuccess(res, {
      case: toCaseSummary(row),
      conversation: {
        sender: row.reporterEmail,
        senderName: row.reporterName,
        subject: row.subject,
        source: row.source ?? 'intercom',
        recipients: (row.rawPayload as { recipients?: string[] } | null)?.recipients ?? [],
        body: messages[0]?.messageBody ?? null
      },
      snapshot,
      timeline: {
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        processedAt: row.intelligenceSnapshot?.processedAt ?? null,
        processingDurationMs: row.intelligenceSnapshot?.processingDurationMs ?? null,
        correlationId: row.correlationId
      },
      corrections,
      feedback
    });
  },

  async correct(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const body = z
      .object({
        fieldName: z
          .string()
          .min(1)
          .max(64)
          .refine(isOperatorCorrectionField, 'Unsupported correction field'),
        correctedValue: z.string().max(500)
      })
      .parse(req.body);
    const row = await conversationRepository.findById(id);
    if (!row) {
      throw AppError.notFound('Case not found');
    }

    const original =
      body.fieldName === 'caseType'
        ? row.caseType
        : body.fieldName === 'employee'
          ? row.intelligenceSnapshot?.employeeMatches?.[0]?.canonicalName ?? null
          : body.fieldName === 'storeNumber' || body.fieldName === 'store'
            ? row.reporterStoreNumber
            : body.fieldName === 'stakeholders'
              ? (row.intelligenceSnapshot?.ccRecipients?.recipients ?? [])
                  .map((recipient) => recipient.email)
                  .join(', ')
              : body.fieldName === 'manualReview' || body.fieldName === 'requiresManualReview'
                ? String(row.intelligenceSnapshot?.requiresManualReview ?? false)
                : null;

    const [saved] = await db
      .insert(caseCorrections)
      .values({
        conversationId: id,
        fieldName: body.fieldName,
        originalValue: original,
        correctedValue: body.correctedValue,
        actorRole: req.user?.role ?? 'demo'
      })
      .returning();

    const canonical =
      body.fieldName === 'store'
        ? 'storeNumber'
        : body.fieldName === 'requiresManualReview'
          ? 'manualReview'
          : body.fieldName;

    if (canonical === 'caseType') {
      await conversationRepository.updateCaseType(id, body.correctedValue.trim());
    }
    if (canonical === 'storeNumber') {
      await conversationRepository.updateReporterStoreNumber(id, body.correctedValue.trim());
    }

    const nextSnapshot = applyOperatorCorrectionToSnapshot(
      row.intelligenceSnapshot,
      body.fieldName,
      body.correctedValue
    );
    const status = (
      Object.values(INTELLIGENCE_STATUS) as string[]
    ).includes(row.intelligenceStatus)
      ? (row.intelligenceStatus as IntelligenceStatus)
      : INTELLIGENCE_STATUS.READY;
    await conversationRepository.updateIntelligence(id, {
      status,
      snapshot: nextSnapshot,
      error: row.intelligenceError
    });

    sendSuccess(res, saved, 201);
  },

  async feedback(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const body = z
      .object({
        rating: z.enum(['accurate', 'needs_review', 'incorrect']),
        comment: z.string().max(1000).optional()
      })
      .parse(req.body);

    const row = await conversationRepository.findById(id);
    if (!row) {
      throw AppError.notFound('Case not found');
    }

    const [saved] = await db
      .insert(caseFeedback)
      .values({
        conversationId: id,
        rating: body.rating,
        comment: body.comment ?? null
      })
      .returning();

    sendSuccess(res, saved, 201);
  },

  async overview(_req: Request, res: Response): Promise<void> {
    const [
      counts,
      bySource,
      byCategory,
      mentionStatus,
      duplicates,
      lastIntercomEvent,
      manualReview,
      matchedEmployees,
      casesWithRelated,
      directoryCount,
      averageConfidence,
      recentResult
    ] = await Promise.all([
      conversationRepository.countByIntelligenceStatus(),
      conversationRepository.countBySource(),
      conversationRepository.countByCaseType(),
      conversationRepository.countByMentionStatus(),
      ingestionRepository.countDuplicatesPrevented(),
      ingestionRepository.latestBySource('intercom'),
      conversationRepository.countRequiresManualReview(),
      conversationRepository.countMatchedEmployeeCases(),
      conversationRepository.countCasesWithRelated(),
      conversationRepository.countEmployeeIdentities(),
      conversationRepository.averageMatchConfidence(),
      conversationRepository.listCases({ limit: 8, offset: 0 })
    ]);
    const completed = counts.ready ?? 0;
    const failed = counts.failed ?? 0;
    const processing = counts.processing ?? 0;
    const casesProcessed = Object.values(counts).reduce((sum, value) => sum + value, 0);

    sendSuccess(res, {
      casesProcessed,
      completed,
      failed,
      processing,
      pending: counts.pending ?? 0,
      pendingManualReview: manualReview,
      duplicateEventsPrevented: duplicates,
      casesBySource: bySource,
      casesByCategory: Object.fromEntries(
        Object.entries(byCategory).map(([slug, count]) => [formatCaseTypeLabel(slug), count])
      ),
      mentionStatus,
      matchedEmployeeCases: matchedEmployees,
      casesWithRelated,
      employeeDirectoryCount: directoryCount,
      averageMatchConfidence: averageConfidence,
      lastIntercomWebhookAt: lastIntercomEvent?.receivedAt ?? null,
      recentCases: recentResult.rows.map((row) => toCaseSummary(row))
    });
  }
};
