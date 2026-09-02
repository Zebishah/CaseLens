import { sql, type SQL } from 'drizzle-orm';
import {
  parseReporterContext,
  type ReporterContext
} from '../employee/employee.reporter-context.util.js';

export type RelatedCaseSearchScope = {
  mode: 'store' | 'domain' | 'store-and-domain' | 'none';
  storeNumber: string | null;
  domain: string | null;
};

export const scopeIncludesCompanyDomain = (
  scope: RelatedCaseSearchScope | null | undefined
): boolean => scope?.mode === 'domain' || scope?.mode === 'store-and-domain';

/** Whether a conversation belongs to a specific store inbox (not domain-only HR). */
export const isStoreScopedConversation = (conversation: {
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterStoreNumber?: string | null;
}): boolean => {
  if (conversation.reporterStoreNumber?.trim()) {
    return true;
  }

  return Boolean(
    parseReporterContext(conversation.reporterName, conversation.reporterEmail).storeNumber
  );
};

/**
 * Store inbox → same store only.
 * Domain-only inbox → same company domain, no store on either side.
 * No store and no domain → only other unscoped conversations.
 */
export const resolveRelatedCaseSearchScope = (
  reporterContext: ReporterContext
): RelatedCaseSearchScope => {
  if (reporterContext.storeNumber) {
    return {
      mode: 'store',
      storeNumber: reporterContext.storeNumber,
      domain: null
    };
  }

  if (reporterContext.domain) {
    return {
      mode: 'domain',
      storeNumber: null,
      domain: reporterContext.domain
    };
  }

  return {
    mode: 'none',
    storeNumber: null,
    domain: null
  };
};

export const resolveRelatedCaseSearchScopeFromConversation = (conversation: {
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterStoreNumber?: string | null;
  reporterCompanyDomain?: string | null;
}): RelatedCaseSearchScope => {
  if (conversation.reporterStoreNumber?.trim()) {
    return {
      mode: 'store',
      storeNumber: conversation.reporterStoreNumber.trim(),
      domain: null
    };
  }

  if (conversation.reporterCompanyDomain?.trim()) {
    return {
      mode: 'domain',
      storeNumber: null,
      domain: conversation.reporterCompanyDomain.trim().toLowerCase()
    };
  }

  return resolveRelatedCaseSearchScope(
    parseReporterContext(conversation.reporterName, conversation.reporterEmail)
  );
};

/** Widen store inbox related-case search to same store plus full company domain. */
export const widenStoreScopeToDomainWhenNeeded = (
  scope: RelatedCaseSearchScope,
  domain: string | null | undefined,
  domainSearchWidened: boolean
): RelatedCaseSearchScope => {
  if (!domainSearchWidened) {
    return scope;
  }

  const normalizedDomain = domain?.trim().toLowerCase();
  const storeNumber = scope.storeNumber?.trim();
  if (!normalizedDomain || scope.mode !== 'store' || !storeNumber) {
    return scope;
  }

  return {
    mode: 'store-and-domain',
    storeNumber,
    domain: normalizedDomain
  };
};

const resolveConversationCompanyDomain = (conversation: {
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterCompanyDomain?: string | null;
}): string | null => {
  if (conversation.reporterCompanyDomain?.trim()) {
    return conversation.reporterCompanyDomain.trim().toLowerCase();
  }

  return parseReporterContext(conversation.reporterName, conversation.reporterEmail).domain;
};

/** Whether a candidate conversation belongs in the open ticket's related-case scope. */
export const conversationMatchesRelatedCaseScope = (
  conversation: {
    reporterName?: string | null;
    reporterEmail?: string | null;
    reporterStoreNumber?: string | null;
    reporterCompanyDomain?: string | null;
  },
  scope: RelatedCaseSearchScope | null | undefined
): boolean => {
  if (!scope) {
    return true;
  }

  const candidateScope = resolveRelatedCaseSearchScopeFromConversation(conversation);

  if (scope.mode === 'none') {
    return candidateScope.mode === 'none';
  }

  if (scope.mode === 'store') {
    return (
      candidateScope.mode === 'store' &&
      candidateScope.storeNumber === scope.storeNumber
    );
  }

  if (scope.mode === 'domain') {
    return (
      candidateScope.mode === 'domain' &&
      candidateScope.domain === scope.domain
    );
  }

  if (scope.mode === 'store-and-domain') {
    const storeNumber = scope.storeNumber?.trim();
    const domain = scope.domain?.trim().toLowerCase();
    const storeMatch =
      Boolean(storeNumber) &&
      candidateScope.mode === 'store' &&
      candidateScope.storeNumber === storeNumber;
    const domainMatch =
      Boolean(domain) && resolveConversationCompanyDomain(conversation) === domain;

    return storeMatch || domainMatch;
  }

  return false;
};

/**
 * Reporter email local parts that identify a store inbox (e.g. 10206@, dd1976@).
 * Mirrors store detection in employee.reporter-context.util.
 */
const buildReporterEmailLooksLikeStoreSql = (): SQL => sql`(
  c.reporter_email IS NOT NULL
  AND (
    split_part(lower(trim(c.reporter_email)), '@', 1) ~ '^[0-9]{3,}$'
    OR (
      split_part(lower(trim(c.reporter_email)), '@', 1) ~ '[a-z]'
      AND split_part(lower(trim(c.reporter_email)), '@', 1) ~ '[0-9]'
      AND split_part(lower(trim(c.reporter_email)), '@', 1) !~ '^[a-z]{5,}[0-9]+$'
    )
  )
)`;

/** Conversations scoped to a specific store (column or store-like reporter email). */
export const buildConversationIsStoreScopedSql = (): SQL => sql`(
  (
    c.reporter_store_number IS NOT NULL
    AND trim(c.reporter_store_number) <> ''
  )
  OR (
    c.reporter_store_number IS NULL
    AND ${buildReporterEmailLooksLikeStoreSql()}
  )
)`;

const buildConversationHasCompanyDomainSql = (): SQL => sql`(
  (
    c.reporter_company_domain IS NOT NULL
    AND trim(c.reporter_company_domain) <> ''
  )
  OR (
    c.reporter_email IS NOT NULL
    AND trim(c.reporter_email) <> ''
    AND position('@' in trim(c.reporter_email)) > 1
  )
)`;

const buildConversationMatchesStoreNumberSql = (storeNumber: string): SQL => sql`(
  ${buildConversationIsStoreScopedSql()}
  AND (
    c.reporter_store_number = ${storeNumber}
    OR (
      c.reporter_store_number IS NULL
      AND c.reporter_email IS NOT NULL
      AND split_part(lower(trim(c.reporter_email)), '@', 1) = ${storeNumber}
    )
  )
)`;

/** All reporters at a company domain, including store inboxes. */
export const buildCompanyDomainConversationSql = (domain: string): SQL => {
  const normalized = domain.trim().toLowerCase();
  return sql`(
    lower(c.reporter_company_domain) = ${normalized}
    OR (
      c.reporter_company_domain IS NULL
      AND c.reporter_email IS NOT NULL
      AND lower(c.reporter_email) LIKE ${`%@${normalized}`}
    )
  )`;
};

const buildConversationMatchesCompanyDomainSql = (domain: string): SQL =>
  buildCompanyDomainConversationSql(domain);

/** SQL filter for raw queries using table alias `c`. */
export const buildRelatedCaseScopeSql = (
  scope: RelatedCaseSearchScope | null | undefined
): SQL => {
  if (!scope) {
    return sql``;
  }

  if (scope.mode === 'none') {
    return sql`AND NOT ${buildConversationIsStoreScopedSql()}
      AND NOT ${buildConversationHasCompanyDomainSql()}`;
  }

  if (scope.mode === 'store' && scope.storeNumber) {
    return sql`AND ${buildConversationMatchesStoreNumberSql(scope.storeNumber.trim())}`;
  }

  if (scope.mode === 'domain' && scope.domain) {
    const domain = scope.domain.trim().toLowerCase();
    return sql`AND NOT ${buildConversationIsStoreScopedSql()}
      AND ${buildConversationMatchesCompanyDomainSql(domain)}`;
  }

  if (scope.mode === 'store-and-domain' && scope.storeNumber && scope.domain) {
    const storeNumber = scope.storeNumber.trim();
    const domain = scope.domain.trim().toLowerCase();
    return sql`AND (
      ${buildConversationMatchesStoreNumberSql(storeNumber)}
      OR ${buildConversationMatchesCompanyDomainSql(domain)}
    )`;
  }

  return sql``;
};
