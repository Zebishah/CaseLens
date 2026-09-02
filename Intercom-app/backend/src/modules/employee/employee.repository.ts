import { and, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { EmployeeMatchMethod } from '../../constants/intelligence.constants.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { db } from '../../database/connection.js';
import { conversationEmployees } from '../../database/schema/conversation_employees.js';
import { conversations } from '../../database/schema/conversations.js';
import { employeeAliases } from '../../database/schema/employee_aliases.js';
import { employeeIdentities } from '../../database/schema/employee_identities.js';
import {
  collectReporterEmailHistoryFromEmails,
  type IdentityReporterEmailHistory
} from './employee.email-domain.util.js';
import { normalizeForMatch } from './employee.name.util.js';
import { buildRelatedCaseScopeSql, buildCompanyDomainConversationSql, buildConversationIsStoreScopedSql } from '../conversation/related-case-scope.util.js';

export type EmployeeIdentityRow = typeof employeeIdentities.$inferSelect;

export type FuzzyIdentityMatch = {
  id: number;
  canonicalName: string;
  email: string | null;
  similarity: number;
};

export type FuzzyAliasMatch = {
  employeeIdentityId: number;
  canonicalName: string;
  email: string | null;
  alias: string;
  similarity: number;
};

export const employeeRepository = {
  async findByIntercomContactId(intercomContactId: string): Promise<EmployeeIdentityRow | undefined> {
    return db.query.employeeIdentities.findFirst({
      where: eq(employeeIdentities.intercomContactId, intercomContactId)
    });
  },

  async findByEmail(email: string): Promise<EmployeeIdentityRow | undefined> {
    return db.query.employeeIdentities.findFirst({
      where: ilike(employeeIdentities.email, email)
    });
  },

  async findByCanonicalName(name: string): Promise<EmployeeIdentityRow | undefined> {
    return db.query.employeeIdentities.findFirst({
      where: ilike(employeeIdentities.canonicalName, name)
    });
  },

  async findAllByCanonicalName(name: string): Promise<EmployeeIdentityRow[]> {
    return db.query.employeeIdentities.findMany({
      where: ilike(employeeIdentities.canonicalName, name)
    });
  },

  async findByStoreNumber(storeNumber: string): Promise<EmployeeIdentityRow[]> {
    const normalized = storeNumber.trim();
    if (!normalized) {
      return [];
    }

    return db.query.employeeIdentities.findMany({
      where: eq(employeeIdentities.storeNumber, normalized)
    });
  },

  /** Employees already linked on other tickets at the same store inbox. */
  async findIdentitiesLinkedAtStoreConversations(
    storeNumber: string,
    excludeConversationId: number
  ): Promise<EmployeeIdentityRow[]> {
    const normalized = storeNumber.trim();
    if (!normalized) {
      return [];
    }

    const scopeCondition = buildRelatedCaseScopeSql({
      mode: 'store',
      storeNumber: normalized,
      domain: null
    });

    const result = await db.execute(sql`
      SELECT DISTINCT ON (ei.id)
        ei.id,
        ei.canonical_name AS "canonicalName",
        ei.email,
        ei.phone,
        ei.store_number AS "storeNumber",
        ei.company_domain AS "companyDomain",
        ei.intercom_contact_id AS "intercomContactId",
        ei.created_at AS "createdAt"
      FROM employee_identities ei
      INNER JOIN conversation_employees ce ON ce.employee_identity_id = ei.id
      INNER JOIN conversations c ON c.id = ce.conversation_id
      WHERE c.id != ${excludeConversationId}
      ${scopeCondition}
    `);

    return result.rows as EmployeeIdentityRow[];
  },

  /** Employees linked on tickets anywhere at a company domain (all store + HR inboxes). */
  async findIdentitiesLinkedAtCompanyDomainConversations(
    domain: string,
    excludeConversationId: number,
    options?: { excludeStoreScopedConversations?: boolean }
  ): Promise<EmployeeIdentityRow[]> {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const storeExclusion =
      options?.excludeStoreScopedConversations === true
        ? sql`AND NOT ${buildConversationIsStoreScopedSql()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT DISTINCT ON (ei.id)
        ei.id,
        ei.canonical_name AS "canonicalName",
        ei.email,
        ei.phone,
        ei.store_number AS "storeNumber",
        ei.company_domain AS "companyDomain",
        ei.intercom_contact_id AS "intercomContactId",
        ei.created_at AS "createdAt"
      FROM employee_identities ei
      INNER JOIN conversation_employees ce ON ce.employee_identity_id = ei.id
      INNER JOIN conversations c ON c.id = ce.conversation_id
      WHERE c.id != ${excludeConversationId}
      AND ${buildCompanyDomainConversationSql(normalized)}
      ${storeExclusion}
    `);

    return result.rows as EmployeeIdentityRow[];
  },

  async findByCompanyDomain(
    domain: string,
    options?: { excludeStoreScoped?: boolean }
  ): Promise<EmployeeIdentityRow[]> {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const domainCondition = ilike(employeeIdentities.companyDomain, normalized);
    const where =
      options?.excludeStoreScoped === true
        ? and(
            domainCondition,
            or(
              isNull(employeeIdentities.storeNumber),
              eq(employeeIdentities.storeNumber, '')
            )
          )
        : domainCondition;

    return db.query.employeeIdentities.findMany({
      where
    });
  },

  async findUnscoped(): Promise<EmployeeIdentityRow[]> {
    return db.query.employeeIdentities.findMany({
      where: and(
        or(isNull(employeeIdentities.storeNumber), eq(employeeIdentities.storeNumber, '')),
        or(isNull(employeeIdentities.companyDomain), eq(employeeIdentities.companyDomain, ''))
      )
    });
  },

  async findByIds(ids: number[]): Promise<EmployeeIdentityRow[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return [];
    }

    return db.query.employeeIdentities.findMany({
      where: inArray(employeeIdentities.id, uniqueIds)
    });
  },

  async findReporterEmailHistoryByIdentityIds(
    identityIds: number[]
  ): Promise<Map<number, IdentityReporterEmailHistory>> {
    const uniqueIds = [...new Set(identityIds)];
    const historyByIdentity = new Map<
      number,
      { businessDomains: Set<string>; publicEmails: Set<string> }
    >();

    for (const id of uniqueIds) {
      historyByIdentity.set(id, { businessDomains: new Set(), publicEmails: new Set() });
    }

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const identities = await db.query.employeeIdentities.findMany({
      where: inArray(employeeIdentities.id, uniqueIds),
      columns: { id: true, email: true }
    });

    for (const identity of identities) {
      const history = historyByIdentity.get(identity.id);
      if (!history) {
        continue;
      }

      const identityHistory = collectReporterEmailHistoryFromEmails([identity.email]);
      for (const domain of identityHistory.businessDomains) {
        history.businessDomains.add(domain);
      }
      for (const email of identityHistory.publicEmails) {
        history.publicEmails.add(email);
      }
    }

    const rows = await db
      .select({
        employeeIdentityId: conversationEmployees.employeeIdentityId,
        reporterEmail: conversations.reporterEmail
      })
      .from(conversationEmployees)
      .innerJoin(conversations, eq(conversationEmployees.conversationId, conversations.id))
      .where(inArray(conversationEmployees.employeeIdentityId, uniqueIds));

    for (const row of rows) {
      const history = historyByIdentity.get(row.employeeIdentityId);
      if (!history) {
        continue;
      }

      const rowHistory = collectReporterEmailHistoryFromEmails([row.reporterEmail]);
      for (const domain of rowHistory.businessDomains) {
        history.businessDomains.add(domain);
      }
      for (const email of rowHistory.publicEmails) {
        history.publicEmails.add(email);
      }
    }

    return new Map(
      [...historyByIdentity.entries()].map(([id, history]) => [
        id,
        {
          businessDomains: [...history.businessDomains],
          publicEmails: [...history.publicEmails]
        }
      ])
    );
  },

  async findAliasOwner(alias: string): Promise<{
    identity: EmployeeIdentityRow;
    aliasRow: typeof employeeAliases.$inferSelect;
  } | undefined> {
    const rows = await db
      .select({
        identity: employeeIdentities,
        aliasRow: employeeAliases
      })
      .from(employeeAliases)
      .innerJoin(employeeIdentities, eq(employeeAliases.employeeIdentityId, employeeIdentities.id))
      .where(ilike(employeeAliases.alias, alias))
      .limit(1);

    const row = rows[0];
    return row ? { identity: row.identity, aliasRow: row.aliasRow } : undefined;
  },

  async findAll(): Promise<EmployeeIdentityRow[]> {
    return db.query.employeeIdentities.findMany();
  },

  async findAllExcept(excludeEmployeeIdentityId: number): Promise<EmployeeIdentityRow[]> {
    return db.query.employeeIdentities.findMany({
      where: ne(employeeIdentities.id, excludeEmployeeIdentityId)
    });
  },

  async findFuzzyByCanonicalName(
    name: string,
    threshold: number = INTERCOM_MATCH.FUZZY_SIMILARITY_THRESHOLD
  ): Promise<FuzzyIdentityMatch[]> {
    const result = await db.execute(sql`
      SELECT
        id,
        canonical_name AS "canonicalName",
        email,
        similarity(canonical_name, ${name})::float8 AS similarity
      FROM employee_identities
      WHERE similarity(canonical_name, ${name}) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT 10
    `);

    return result.rows as FuzzyIdentityMatch[];
  },

  async findFuzzyByAlias(
    name: string,
    threshold: number = INTERCOM_MATCH.FUZZY_SIMILARITY_THRESHOLD
  ): Promise<FuzzyAliasMatch[]> {
    const result = await db.execute(sql`
      SELECT
        ei.id AS "employeeIdentityId",
        ei.canonical_name AS "canonicalName",
        ei.email,
        ea.alias,
        similarity(ea.alias, ${name})::float8 AS similarity
      FROM employee_aliases ea
      INNER JOIN employee_identities ei ON ei.id = ea.employee_identity_id
      WHERE similarity(ea.alias, ${name}) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT 10
    `);

    return result.rows as FuzzyAliasMatch[];
  },

  async createIdentity(input: {
    canonicalName: string;
    email?: string | null;
    intercomContactId?: string | null;
    storeNumber?: string | null;
    companyDomain?: string | null;
  }): Promise<EmployeeIdentityRow> {
    const [identity] = await db
      .insert(employeeIdentities)
      .values({
        canonicalName: input.canonicalName,
        email: input.email ?? null,
        intercomContactId: input.intercomContactId ?? null,
        storeNumber: input.storeNumber?.trim() || null,
        companyDomain: input.companyDomain?.trim().toLowerCase() || null
      })
      .returning();

    return identity;
  },

  async updateIdentityScopeIfEmpty(
    employeeIdentityId: number,
    input: {
      storeNumber?: string | null;
      companyDomain?: string | null;
    }
  ): Promise<void> {
    const identity = await db.query.employeeIdentities.findFirst({
      where: eq(employeeIdentities.id, employeeIdentityId)
    });

    if (!identity) {
      return;
    }

    const storeNumber = input.storeNumber?.trim() || null;
    const companyDomain = input.companyDomain?.trim().toLowerCase() || null;
    const updates: Partial<typeof employeeIdentities.$inferInsert> = {};

    if (!identity.storeNumber && storeNumber) {
      updates.storeNumber = storeNumber;
    }

    if (!identity.companyDomain && companyDomain) {
      updates.companyDomain = companyDomain;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    await db
      .update(employeeIdentities)
      .set(updates)
      .where(eq(employeeIdentities.id, employeeIdentityId));
  },

  async hasAliasForIdentity(employeeIdentityId: number, alias: string): Promise<boolean> {
    const identity = await db.query.employeeIdentities.findFirst({
      where: eq(employeeIdentities.id, employeeIdentityId)
    });

    if (!identity) {
      return false;
    }

    if (normalizeForMatch(identity.canonicalName) === normalizeForMatch(alias)) {
      return true;
    }

    const aliasRow = await db.query.employeeAliases.findFirst({
      where: and(
        eq(employeeAliases.employeeIdentityId, employeeIdentityId),
        ilike(employeeAliases.alias, alias)
      )
    });

    return Boolean(aliasRow);
  },

  async findAliasesByEmployeeIdentityIds(
    employeeIdentityIds: number[]
  ): Promise<Array<typeof employeeAliases.$inferSelect>> {
    if (employeeIdentityIds.length === 0) {
      return [];
    }

    return db.query.employeeAliases.findMany({
      where: inArray(employeeAliases.employeeIdentityId, employeeIdentityIds)
    });
  },

  async createAlias(input: {
    employeeIdentityId: number;
    alias: string;
    confidenceScore: number;
    matchMethod: EmployeeMatchMethod;
  }): Promise<typeof employeeAliases.$inferSelect | undefined> {
    const exists = await this.hasAliasForIdentity(input.employeeIdentityId, input.alias);
    if (exists) {
      return undefined;
    }

    const [aliasRow] = await db
      .insert(employeeAliases)
      .values({
        employeeIdentityId: input.employeeIdentityId,
        alias: input.alias.trim(),
        confidenceScore: String(input.confidenceScore),
        matchMethod: input.matchMethod
      })
      .returning();

    return aliasRow;
  }
};
