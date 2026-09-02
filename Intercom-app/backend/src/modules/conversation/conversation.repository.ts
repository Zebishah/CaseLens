import { and, desc, eq, gt, gte, inArray, ne, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  CONVERSATION_MESSAGE_SAVE_LIMIT,
  INTELLIGENCE_STATUS,
  RELATED_CASE_LIST_LIMIT,
  type IntelligenceStatus
} from '../../constants/intelligence.constants.js';
import { logger } from '../../config/logger.config.js';
import { db, type Database } from '../../database/connection.js';
import { conversationMessages } from '../../database/schema/conversation_messages.js';
import { conversations } from '../../database/schema/conversations.js';
import { employeeIdentities } from '../../database/schema/employee_identities.js';
import {
  addDismissedCategoryCaseIntercomId,
  addDismissedRelatedCaseIntercomId
} from '../canvas/related-case-dismiss.util.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import { getRelatedCaseCreatedAfterDate } from '../intelligence/related-case-window.util.js';
import {
  buildWholeWordRegexPattern,
  splitRelatedCaseSearchWords
} from '../intelligence/related-case-name-match.util.js';
import {
  buildRelatedCaseScopeSql,
  type RelatedCaseSearchScope
} from './related-case-scope.util.js';
import { expandCaseTypeSearchSlugs } from './case-type.util.js';
import type { MappedConversation, MappedConversationMessage } from './conversation.mapper.js';
import { laterTimestamp } from '../intelligence/intelligence-revision.util.js';

export type ConversationRecord = typeof conversations.$inferSelect;
export type ConversationMessageRecord = typeof conversationMessages.$inferSelect;
export type ConversationExecutor = Pick<Database, 'insert' | 'update' | 'delete' | 'query'>;

const conversationSelectColumns = sql`
  c.id,
  c.intercom_id AS "intercomId",
  c.subject,
  c.status,
  c.reporter_name AS "reporterName",
  c.reporter_email AS "reporterEmail",
  c.reporter_store_number AS "reporterStoreNumber",
  c.reporter_company_domain AS "reporterCompanyDomain",
  c.company_name AS "companyName",
  c.intercom_contact_id AS "intercomContactId",
  c.assigned_intercom_admin_id AS "assignedIntercomAdminId",
  c.employee_identity_id AS "employeeIdentityId",
  c.extracted_names AS "extractedNames",
  c.case_type AS "caseType",
  c.intelligence_status AS "intelligenceStatus",
  c.intelligence_snapshot AS "intelligenceSnapshot",
  c.intelligence_error AS "intelligenceError",
  c.raw_payload AS "rawPayload",
  c.created_at AS "createdAt",
  c.updated_at AS "updatedAt"
`;

const buildMentionedNameMatchCondition = (term: string): SQL => {
  const words = splitRelatedCaseSearchWords(term);
  if (words.length === 0) {
    return sql`FALSE`;
  }

  const subjectWordMatches = words.map((word) => {
    const pattern = buildWholeWordRegexPattern(word);
    return sql`(c.subject IS NOT NULL AND c.subject ~* ${pattern})`;
  });
  const subjectMatch =
    subjectWordMatches.length === 1
      ? subjectWordMatches[0]!
      : sql`(${sql.join(subjectWordMatches, sql` AND `)})`;

  const extractedWordMatches = words.map((word) => {
    const pattern = buildWholeWordRegexPattern(word);
    return sql`extracted_name ~* ${pattern}`;
  });
  const extractedMatch =
    extractedWordMatches.length === 1
      ? extractedWordMatches[0]!
      : sql`(${sql.join(extractedWordMatches, sql` AND `)})`;

  return sql`(
    ${subjectMatch}
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(c.extracted_names, '[]'::jsonb)) AS extracted_name
      WHERE ${extractedMatch}
    )
  )`;
};

export const conversationRepository = {
  async findById(id: number): Promise<ConversationRecord | undefined> {
    return db.query.conversations.findFirst({
      where: eq(conversations.id, id)
    });
  },

  async findByIntercomId(
    intercomId: string,
    executor: ConversationExecutor = db
  ): Promise<ConversationRecord | undefined> {
    return executor.query.conversations.findFirst({
      where: eq(conversations.intercomId, intercomId)
    });
  },

  async findByIntercomIds(intercomIds: string[]): Promise<ConversationRecord[]> {
    const uniqueIds = [...new Set(intercomIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    return db.query.conversations.findMany({
      where: inArray(conversations.intercomId, uniqueIds)
    });
  },

  async findMessagesByConversationId(conversationId: number): Promise<ConversationMessageRecord[]> {
    return db.query.conversationMessages.findMany({
      where: eq(conversationMessages.conversationId, conversationId),
      orderBy: conversationMessages.createdAt
    });
  },

  /**
   * First non-empty message body per conversation (oldest first), for related-case previews.
   */
  async findFirstMessageBodiesByConversationIds(
    conversationIds: number[]
  ): Promise<Map<number, string>> {
    const uniqueIds = [...new Set(conversationIds)].filter((id) => id > 0);
    const bodies = new Map<number, string>();
    if (uniqueIds.length === 0) {
      return bodies;
    }

    const idList = sql.join(
      uniqueIds.map((id) => sql`${id}`),
      sql`, `
    );

    const result = await db.execute(sql`
      SELECT DISTINCT ON (conversation_id)
        conversation_id AS "conversationId",
        message_body AS "messageBody"
      FROM conversation_messages
      WHERE conversation_id IN (${idList})
        AND message_body IS NOT NULL
        AND btrim(message_body) <> ''
      ORDER BY conversation_id, created_at ASC, id ASC
    `);

    for (const row of result.rows as Array<{ conversationId: number; messageBody: string }>) {
      if (row.messageBody?.trim()) {
        bodies.set(Number(row.conversationId), row.messageBody);
      }
    }

    return bodies;
  },

  async countMessagesByConversationId(conversationId: number): Promise<number> {
    const rows = await db.query.conversationMessages.findMany({
      where: eq(conversationMessages.conversationId, conversationId),
      columns: { id: true }
    });

    return rows.length;
  },

  async findRelatedByEmployeeIdentityIds(
    employeeIdentityIds: number[],
    excludeConversationId: number,
    limit = RELATED_CASE_LIST_LIMIT,
    options?: { scope?: RelatedCaseSearchScope | null }
  ): Promise<ConversationRecord[]> {
    const identityIds = [...new Set(employeeIdentityIds)].filter((id) => id > 0);
    if (identityIds.length === 0) {
      return [];
    }

    const createdAfter = getRelatedCaseCreatedAfterDate();
    const scopeCondition = buildRelatedCaseScopeSql(options?.scope);
    const identityIdList = sql.join(identityIds.map((id) => sql`${id}`), sql`, `);

    const result = await db.execute(sql`
      SELECT
        ${conversationSelectColumns}
      FROM conversations c
      WHERE c.id != ${excludeConversationId}
      AND c.created_at >= ${createdAfter}
      ${scopeCondition}
      AND (
        c.employee_identity_id IN (${identityIdList})
        OR EXISTS (
          SELECT 1
          FROM conversation_employees ce
          WHERE ce.conversation_id = c.id
          AND ce.employee_identity_id IN (${identityIdList})
        )
      )
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);

    const records = result.rows as ConversationRecord[];

    return records.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });
  },

  async findRelatedByEmployeeIdentity(
    employeeIdentityId: number,
    excludeConversationId: number,
    limit = RELATED_CASE_LIST_LIMIT
  ): Promise<ConversationRecord[]> {
    const createdAfter = getRelatedCaseCreatedAfterDate();

    return db.query.conversations.findMany({
      where: and(
        eq(conversations.employeeIdentityId, employeeIdentityId),
        ne(conversations.id, excludeConversationId),
        gte(conversations.createdAt, createdAfter)
      ),
      orderBy: desc(conversations.createdAt),
      limit
    });
  },

  /**
   * Find a recent non-general case type from a conversation with a similar subject.
   * Used to keep vague/near-identical subjects consistent across cases.
   */
  async findSimilarSubjectCaseType(
    subject: string | null | undefined,
    excludeConversationId: number,
    limit = 100
  ): Promise<string | null> {
    const { subjectsShareCaseTypeBucket } = await import('./case-type.util.js');
    const needle = subject?.trim();
    if (!needle) {
      return null;
    }

    const rows = await db
      .select({
        subject: conversations.subject,
        caseType: conversations.caseType
      })
      .from(conversations)
      .where(
        and(
          ne(conversations.id, excludeConversationId),
          sql`${conversations.caseType} IS NOT NULL`,
          sql`trim(${conversations.caseType}) <> ''`,
          sql`lower(trim(${conversations.caseType})) <> 'general'`,
          sql`${conversations.subject} IS NOT NULL`,
          sql`trim(${conversations.subject}) <> ''`
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    for (const row of rows) {
      if (
        row.caseType?.trim() &&
        row.subject?.trim() &&
        subjectsShareCaseTypeBucket(needle, row.subject)
      ) {
        return row.caseType.trim().toLowerCase();
      }
    }

    return null;
  },

  async findByCaseType(
    caseType: string,
    excludeConversationId: number,
    limit = RELATED_CASE_LIST_LIMIT,
    options?: { scope?: RelatedCaseSearchScope | null }
  ): Promise<ConversationRecord[]> {
    const caseTypeSlugs = expandCaseTypeSearchSlugs(caseType);
    if (caseTypeSlugs.length === 0) {
      return [];
    }

    const createdAfter = getRelatedCaseCreatedAfterDate();
    const scopeCondition = buildRelatedCaseScopeSql(options?.scope);
    const caseTypeList = sql.join(
      caseTypeSlugs.map((slug) => sql`${slug}`),
      sql`, `
    );

    const result = await db.execute(sql`
      SELECT
        ${conversationSelectColumns}
      FROM conversations c
      WHERE lower(trim(c.case_type)) IN (${caseTypeList})
      AND c.id != ${excludeConversationId}
      AND c.created_at >= ${createdAfter}
      ${scopeCondition}
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);

    return result.rows as ConversationRecord[];
  },

  async findRecentForRelatedScan(
    excludeConversationId: number,
    limit = RELATED_CASE_LIST_LIMIT,
    options?: { scope?: RelatedCaseSearchScope | null }
  ): Promise<ConversationRecord[]> {
    const createdAfter = getRelatedCaseCreatedAfterDate();
    const scopeCondition = buildRelatedCaseScopeSql(options?.scope);

    const result = await db.execute(sql`
      SELECT
        ${conversationSelectColumns}
      FROM conversations c
      WHERE c.id != ${excludeConversationId}
      AND c.created_at >= ${createdAfter}
      ${scopeCondition}
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);

    return result.rows as ConversationRecord[];
  },

  async countOtherConversationsAtStore(
    storeNumber: string,
    excludeConversationId: number
  ): Promise<number> {
    const normalized = storeNumber.trim();
    if (!normalized) {
      return 0;
    }

    const scopeCondition = buildRelatedCaseScopeSql({
      mode: 'store',
      storeNumber: normalized,
      domain: null
    });

    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM conversations c
      WHERE c.id != ${excludeConversationId}
      ${scopeCondition}
    `);

    const row = result.rows[0] as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  },

  async findRelatedByMentionedNames(
    searchTerms: string[],
    excludeConversationId: number,
    limit = RELATED_CASE_LIST_LIMIT,
    options?: { scope?: RelatedCaseSearchScope | null }
  ): Promise<ConversationRecord[]> {
    const terms = [...new Set(searchTerms.map((term) => term.trim()).filter((term) => term.length >= 3))];

    if (terms.length === 0) {
      return [];
    }

    const termConditions = terms.map((term) => buildMentionedNameMatchCondition(term));
    const createdAfter = getRelatedCaseCreatedAfterDate();
    const scopeCondition = buildRelatedCaseScopeSql(options?.scope);

    const result = await db.execute(sql`
      SELECT
        ${conversationSelectColumns}
      FROM conversations c
      WHERE c.id != ${excludeConversationId}
      AND c.created_at >= ${createdAfter}
      ${scopeCondition}
      AND (${sql.join(termConditions, sql` OR `)})
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);

    const records = result.rows as ConversationRecord[];

    return records.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });
  },

  async findMatchedEmployeeNamesInConversation(
    _conversationId: number,
    subject: string | null,
    employeeNames: string[],
    extractedNames?: string[] | null
  ): Promise<string[]> {
    const names = [...new Set(employeeNames.map((name) => name.trim()).filter((name) => name.length >= 3))];

    if (names.length === 0) {
      return [];
    }

    const texts = [subject?.trim() ?? '', ...(extractedNames ?? []).map((name) => name.trim())].filter(
      (text) => text.length > 0
    );

    if (texts.length === 0) {
      return [];
    }

    return names.filter((name) =>
      texts.some((text) => text.toLowerCase().includes(name.toLowerCase()))
    );
  },

  async updateIntelligence(
    conversationId: number,
    input: {
      status: IntelligenceStatus;
      snapshot?: IntelligenceSnapshot | null;
      error?: string | null;
      extractedNames?: string[] | null;
    }
  ): Promise<ConversationRecord | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({
        intelligenceStatus: input.status,
        intelligenceSnapshot: input.snapshot ?? null,
        intelligenceError: input.error ?? null,
        extractedNames: input.extractedNames ?? undefined,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return conversation;
  },

  async updateCaseType(conversationId: number, caseType: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        caseType,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId));
  },

  async updateEmployeeIdentity(
    conversationId: number,
    employeeIdentityId: number | null
  ): Promise<ConversationRecord | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({
        employeeIdentityId,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return conversation;
  },

  async updateReporterStoreNumber(
    conversationId: number,
    storeNumber: string
  ): Promise<ConversationRecord | undefined> {
    const normalized = storeNumber.trim();
    const [conversation] = await db
      .update(conversations)
      .set({
        reporterStoreNumber: normalized,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return conversation;
  },

  async upsertMessages(
    conversationId: number,
    messages: MappedConversationMessage[],
    executor: ConversationExecutor = db
  ): Promise<number> {
    const messagesToSave = messages.slice(0, CONVERSATION_MESSAGE_SAVE_LIMIT);
    const keptPartIds = messagesToSave
      .map((message) => message.intercomPartId)
      .filter((partId): partId is string => Boolean(partId));

    if (keptPartIds.length === 0) {
      await executor
        .delete(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId));
      return 0;
    }

    await executor
      .delete(conversationMessages)
      .where(
        and(
          eq(conversationMessages.conversationId, conversationId),
          notInArray(conversationMessages.intercomPartId, keptPartIds)
        )
      );

    const now = new Date();
    let upserted = 0;

    for (const message of messagesToSave) {
      await executor
        .insert(conversationMessages)
        .values({
          conversationId,
          intercomPartId: message.intercomPartId,
          senderType: message.senderType,
          senderId: message.senderId,
          messageBody: message.messageBody,
          createdAt: now
        })
        .onConflictDoUpdate({
          target: conversationMessages.intercomPartId,
          set: {
            senderType: message.senderType,
            senderId: message.senderId,
            messageBody: message.messageBody
          }
        });

      upserted += 1;
    }

    logger.info('[conversation] Messages upserted', {
      conversationId,
      messageCount: upserted,
      saveLimit: CONVERSATION_MESSAGE_SAVE_LIMIT
    });

    return upserted;
  },

  async upsertFromIntercom(
    mapped: MappedConversation,
    messages: MappedConversationMessage[],
    intelligenceStatus: string,
    options?: {
      preserveIntelligenceStatus?: boolean;
      executor?: ConversationExecutor;
    }
  ): Promise<ConversationRecord> {
    const executor = options?.executor ?? db;
    const now = new Date();
    const existing = await this.findByIntercomId(mapped.intercomId, executor);

    const preserveStatus = options?.preserveIntelligenceStatus === true && Boolean(existing);
    const statusToSet = preserveStatus ? existing!.intelligenceStatus : intelligenceStatus;
    // Keep a manually saved store when Intercom sync still has no store on the reporter.
    const reporterStoreNumber =
      mapped.reporterStoreNumber?.trim() || existing?.reporterStoreNumber?.trim() || null;
    const reporterCompanyDomain =
      mapped.reporterCompanyDomain?.trim() || existing?.reporterCompanyDomain?.trim() || null;
    const intercomSourceUpdatedAt = laterTimestamp(
      existing?.intercomSourceUpdatedAt ?? null,
      mapped.sourceUpdatedAt ?? null
    );

    const [conversation] = await executor
      .insert(conversations)
      .values({
        intercomId: mapped.intercomId,
        source: mapped.source ?? 'intercom',
        correlationId: mapped.correlationId ?? null,
        processingMode: mapped.processingMode ?? 'live',
        demoSessionId: mapped.demoSessionId ?? null,
        subject: mapped.subject,
        status: mapped.status,
        reporterName: mapped.reporterName,
        reporterEmail: mapped.reporterEmail,
        reporterStoreNumber,
        reporterCompanyDomain,
        companyName: mapped.companyName,
        intercomContactId: mapped.intercomContactId,
        assignedIntercomAdminId: mapped.assignedIntercomAdminId,
        intelligenceStatus: statusToSet,
        intelligenceError: null,
        rawPayload: mapped.rawPayload,
        intercomSourceUpdatedAt,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: conversations.intercomId,
        set: {
          subject: mapped.subject,
          status: mapped.status,
          reporterName: mapped.reporterName,
          reporterEmail: mapped.reporterEmail,
          reporterStoreNumber,
          reporterCompanyDomain,
          companyName: mapped.companyName,
          intercomContactId: mapped.intercomContactId,
          assignedIntercomAdminId: mapped.assignedIntercomAdminId,
          rawPayload: mapped.rawPayload,
          intercomSourceUpdatedAt,
          source: mapped.source ?? existing?.source ?? 'intercom',
          correlationId: mapped.correlationId ?? existing?.correlationId ?? null,
          processingMode: mapped.processingMode ?? existing?.processingMode ?? 'live',
          updatedAt: now,
          ...(preserveStatus
            ? {}
            : {
                intelligenceStatus: statusToSet,
                intelligenceError: null
              })
        }
      })
      .returning();

    await this.upsertMessages(conversation.id, messages, executor);

    logger.info('[conversation] Upsert complete', {
      conversationId: conversation.id,
      intercomId: conversation.intercomId,
      intelligenceStatus: conversation.intelligenceStatus,
      messageCount: messages.length
    });

    return conversation;
  },

  /** @deprecated Use upsertFromIntercom */
  async upsertFromWebhook(
    mapped: MappedConversation,
    message: MappedConversationMessage | null,
    intelligenceStatus: string
  ): Promise<ConversationRecord> {
    return this.upsertFromIntercom(
      mapped,
      message ? [message] : [],
      intelligenceStatus
    );
  },

  async dismissRelatedCase(
    conversationId: number,
    relatedIntercomId: string
  ): Promise<ConversationRecord | undefined> {
    const conversation = await this.findById(conversationId);
    if (!conversation?.intelligenceSnapshot) {
      return conversation;
    }

    const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot;
    const updatedSnapshot: IntelligenceSnapshot = {
      ...snapshot,
      dismissedRelatedCaseIntercomIds: addDismissedRelatedCaseIntercomId(
        snapshot.dismissedRelatedCaseIntercomIds,
        relatedIntercomId
      )
    };

    return this.updateIntelligence(conversationId, {
      status: conversation.intelligenceStatus as IntelligenceStatus,
      snapshot: updatedSnapshot,
      error: conversation.intelligenceError
    });
  },

  async dismissCategoryCase(
    conversationId: number,
    categoryIntercomId: string
  ): Promise<ConversationRecord | undefined> {
    const conversation = await this.findById(conversationId);
    if (!conversation?.intelligenceSnapshot) {
      return conversation;
    }

    const snapshot = conversation.intelligenceSnapshot as IntelligenceSnapshot;
    const updatedSnapshot: IntelligenceSnapshot = {
      ...snapshot,
      dismissedCategoryCaseIntercomIds: addDismissedCategoryCaseIntercomId(
        snapshot.dismissedCategoryCaseIntercomIds,
        categoryIntercomId
      )
    };

    return this.updateIntelligence(conversationId, {
      status: conversation.intelligenceStatus as IntelligenceStatus,
      snapshot: updatedSnapshot,
      error: conversation.intelligenceError
    });
  },

  async markIntelligencePending(conversationId: number): Promise<void> {
    await db
      .update(conversations)
      .set({
        intelligenceStatus: INTELLIGENCE_STATUS.PENDING,
        intelligenceError: null,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId));
  },

  async claimIntelligenceProcessing(conversationId: number): Promise<boolean> {
    const [row] = await db
      .update(conversations)
      .set({
        intelligenceStatus: INTELLIGENCE_STATUS.PROCESSING,
        intelligenceError: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          inArray(conversations.intelligenceStatus, [
            INTELLIGENCE_STATUS.PENDING,
            INTELLIGENCE_STATUS.FAILED
          ])
        )
      )
      .returning({ id: conversations.id });

    return Boolean(row);
  },

  async findReadyPeersForIntelligenceRefresh(input: {
    excludeConversationId: number;
    caseType: string;
    scope: RelatedCaseSearchScope | null;
    employeeIdentityIds: number[];
    limit?: number;
  }): Promise<ConversationRecord[]> {
    const caseTypeSlugs = expandCaseTypeSearchSlugs(input.caseType);
    if (caseTypeSlugs.length === 0) {
      return [];
    }

    const limit = input.limit ?? RELATED_CASE_LIST_LIMIT;
    const scopeCondition = buildRelatedCaseScopeSql(input.scope);
    const identityIds = [...new Set(input.employeeIdentityIds)].filter((id) => id > 0);
    const identityIdList =
      identityIds.length > 0 ? sql.join(identityIds.map((id) => sql`${id}`), sql`, `) : null;
    const caseTypeList = sql.join(
      caseTypeSlugs.map((slug) => sql`${slug}`),
      sql`, `
    );

    const employeeMatchCondition =
      identityIdList !== null
        ? sql`OR c.employee_identity_id IN (${identityIdList})
            OR EXISTS (
              SELECT 1
              FROM conversation_employees ce
              WHERE ce.conversation_id = c.id
              AND ce.employee_identity_id IN (${identityIdList})
            )`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        c.id,
        c.intercom_id AS "intercomId",
        c.subject,
        c.status,
        c.reporter_name AS "reporterName",
        c.reporter_email AS "reporterEmail",
        c.reporter_store_number AS "reporterStoreNumber",
        c.reporter_company_domain AS "reporterCompanyDomain",
        c.company_name AS "companyName",
        c.intercom_contact_id AS "intercomContactId",
        c.assigned_intercom_admin_id AS "assignedIntercomAdminId",
        c.employee_identity_id AS "employeeIdentityId",
        c.extracted_names AS "extractedNames",
        c.case_type AS "caseType",
        c.intelligence_status AS "intelligenceStatus",
        c.intelligence_snapshot AS "intelligenceSnapshot",
        c.intelligence_error AS "intelligenceError",
        c.raw_payload AS "rawPayload",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM conversations c
      WHERE c.intelligence_status = ${INTELLIGENCE_STATUS.READY}
      AND c.id != ${input.excludeConversationId}
      AND (
        (lower(trim(c.case_type)) IN (${caseTypeList}) ${scopeCondition})
        ${employeeMatchCondition}
      )
      ORDER BY c.created_at ASC
      LIMIT ${limit}
    `);

    return result.rows as ConversationRecord[];
  },

  async findReadyConversationsReferencingRelatedIntercomId(input: {
    relatedIntercomId: string;
    excludeConversationId?: number;
    limit?: number;
  }): Promise<ConversationRecord[]> {
    const relatedIntercomId = input.relatedIntercomId.trim();
    if (!relatedIntercomId) {
      return [];
    }

    const limit = input.limit ?? RELATED_CASE_LIST_LIMIT;
    const excludeConversationId = input.excludeConversationId ?? 0;

    const result = await db.execute(sql`
      SELECT
        c.id,
        c.intercom_id AS "intercomId",
        c.subject,
        c.status,
        c.reporter_name AS "reporterName",
        c.reporter_email AS "reporterEmail",
        c.reporter_store_number AS "reporterStoreNumber",
        c.reporter_company_domain AS "reporterCompanyDomain",
        c.company_name AS "companyName",
        c.intercom_contact_id AS "intercomContactId",
        c.assigned_intercom_admin_id AS "assignedIntercomAdminId",
        c.employee_identity_id AS "employeeIdentityId",
        c.extracted_names AS "extractedNames",
        c.case_type AS "caseType",
        c.intelligence_status AS "intelligenceStatus",
        c.intelligence_snapshot AS "intelligenceSnapshot",
        c.intelligence_error AS "intelligenceError",
        c.raw_payload AS "rawPayload",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM conversations c
      WHERE c.intelligence_status = ${INTELLIGENCE_STATUS.READY}
      AND c.id != ${excludeConversationId}
      AND c.intelligence_snapshot IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(c.intelligence_snapshot->'relatedCases') AS related_case
          WHERE related_case->>'intercomId' = ${relatedIntercomId}
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(c.intelligence_snapshot->'categoryCases') AS category_case
          WHERE category_case->>'intercomId' = ${relatedIntercomId}
        )
      )
      ORDER BY c.updated_at ASC
      LIMIT ${limit}
    `);

    return result.rows as ConversationRecord[];
  },

  async haveConversationsUpdatedSince(
    intercomIds: string[],
    processedAt: string
  ): Promise<boolean> {
    const uniqueIds = [...new Set(intercomIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return false;
    }

    const threshold = new Date(processedAt);
    if (Number.isNaN(threshold.getTime())) {
      return false;
    }

    const rows = await db.query.conversations.findMany({
      where: and(
        inArray(conversations.intercomId, uniqueIds),
        gt(conversations.updatedAt, threshold)
      ),
      columns: { id: true },
      limit: 1
    });

    return rows.length > 0;
  },

  async listByDemoSessionId(demoSessionId: number): Promise<ConversationRecord[]> {
    return db.query.conversations.findMany({
      where: eq(conversations.demoSessionId, demoSessionId),
      orderBy: desc(conversations.createdAt)
    });
  },

  async listCases(input: {
    query?: string;
    status?: string;
    source?: string;
    category?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: ConversationRecord[]; total: number }> {
    const conditions = [];
    if (input.status) {
      conditions.push(eq(conversations.intelligenceStatus, input.status));
    }
    if (input.source) {
      conditions.push(eq(conversations.source, input.source));
    }
    if (input.category) {
      conditions.push(eq(conversations.caseType, input.category));
    }
    if (input.query?.trim()) {
      const term = `%${input.query.trim()}%`;
      conditions.push(
        sql`(${conversations.subject} ilike ${term} or ${conversations.reporterEmail} ilike ${term} or ${conversations.reporterName} ilike ${term})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.query.conversations.findMany({
      where,
      orderBy: desc(conversations.createdAt),
      limit: input.limit,
      offset: input.offset
    });
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(where);
    return { rows, total: countRow?.count ?? 0 };
  },

  async countByIntelligenceStatus(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: conversations.intelligenceStatus,
        count: sql<number>`count(*)::int`
      })
      .from(conversations)
      .groupBy(conversations.intelligenceStatus);

    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  },

  async countRequiresManualReview(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(sql`coalesce(${conversations.intelligenceSnapshot}->>'requiresManualReview', 'false') = 'true'`);
    return row?.count ?? 0;
  },

  async countBySource(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        source: conversations.source,
        count: sql<number>`count(*)::int`
      })
      .from(conversations)
      .groupBy(conversations.source);

    return Object.fromEntries(rows.map((row) => [row.source, row.count]));
  },

  async countByCaseType(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        caseType: sql<string>`coalesce(nullif(trim(${conversations.caseType}), ''), 'general')`,
        count: sql<number>`count(*)::int`
      })
      .from(conversations)
      .groupBy(sql`coalesce(nullif(trim(${conversations.caseType}), ''), 'general')`);

    return Object.fromEntries(rows.map((row) => [row.caseType, row.count]));
  },

  async countByMentionStatus(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: sql<string>`coalesce(nullif(${conversations.intelligenceSnapshot}->>'employeeMentionStatus', ''), 'unknown')`,
        count: sql<number>`count(*)::int`
      })
      .from(conversations)
      .groupBy(
        sql`coalesce(nullif(${conversations.intelligenceSnapshot}->>'employeeMentionStatus', ''), 'unknown')`
      );

    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  },

  async countMatchedEmployeeCases(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(sql`${conversations.employeeIdentityId} is not null`);
    return row?.count ?? 0;
  },

  async countCasesWithRelated(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(sql`(
        jsonb_array_length(coalesce(${conversations.intelligenceSnapshot}->'relatedCases', '[]'::jsonb))
        + jsonb_array_length(coalesce(${conversations.intelligenceSnapshot}->'fuzzyRelatedCases', '[]'::jsonb))
      ) > 0`);
    return row?.count ?? 0;
  },

  async countEmployeeIdentities(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeIdentities);
    return row?.count ?? 0;
  },

  async averageMatchConfidence(): Promise<number | null> {
    const [row] = await db
      .select({
        avg: sql<number | null>`avg((${conversations.intelligenceSnapshot}->'employeeMatches'->0->>'confidenceScore')::numeric)`
      })
      .from(conversations)
      .where(
        sql`${conversations.intelligenceSnapshot}->'employeeMatches'->0->>'confidenceScore' is not null`
      );
    if (row?.avg == null) {
      return null;
    }
    return Math.round(Number(row.avg));
  },

  async intercomSyncSummary(): Promise<{
    lastSyncedAt: Date | null;
    failed: number;
    synced: number;
  }> {
    const [last] = await db
      .select({ lastSyncedAt: conversations.intercomLastSyncedAt })
      .from(conversations)
      .where(sql`${conversations.intercomLastSyncedAt} is not null`)
      .orderBy(desc(conversations.intercomLastSyncedAt))
      .limit(1);
    const [failed] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.intercomSyncStatus, 'failed'));
    const [synced] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.intercomSyncStatus, 'synced'));

    return {
      lastSyncedAt: last?.lastSyncedAt ?? null,
      failed: failed?.count ?? 0,
      synced: synced?.count ?? 0
    };
  },

  async updateIntercomSync(
    conversationId: number,
    input: {
      status: string;
      error?: string | null;
      noteId?: string | null;
      fingerprint?: string | null;
      tags?: string[] | null;
      lastSyncedAt?: Date | null;
    }
  ): Promise<ConversationRecord | undefined> {
    const patch: Partial<ConversationRecord> = {
      intercomSyncStatus: input.status,
      updatedAt: new Date()
    };
    if (input.error !== undefined) {
      patch.intercomSyncError = input.error;
    }
    if (input.noteId !== undefined) {
      patch.intercomIntelligenceNoteId = input.noteId;
    }
    if (input.fingerprint !== undefined) {
      patch.intercomSyncFingerprint = input.fingerprint;
    }
    if (input.tags !== undefined) {
      patch.intercomSyncTags = input.tags;
    }
    if (input.lastSyncedAt !== undefined) {
      patch.intercomLastSyncedAt = input.lastSyncedAt;
    }

    const [conversation] = await db
      .update(conversations)
      .set(patch)
      .where(eq(conversations.id, conversationId))
      .returning();

    return conversation;
  }
};
