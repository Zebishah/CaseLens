import type { IntercomCaseType } from '../constants/intercom.constants.js';
import type { EmployeeSearchPath } from '../constants/employee-search.constants.js';
import type { RelatedCaseSearchScope } from '../modules/conversation/related-case-scope.util.js';
import type { CcRecipientsResult } from '../modules/store-directory/cc-recipients.service.js';

export type IntelligenceNameVariant = {
  variantName: string;
  confidenceScore: number;
  matchMethod: string;
};

export type IntelligenceEmployeeMatch = {
  employeeIdentityId: number;
  canonicalName: string;
  confidenceScore: number;
  matchMethod: string;
  /** Name spelling extracted from this conversation when it differs from canonical. */
  extractedName?: string;
  nameVariants?: IntelligenceNameVariant[];
};

export type IntelligenceRelatedCase = {
  conversationId: number;
  intercomId: string;
  subject: string | null;
  caseType: IntercomCaseType | string;
  matchedEmployeeNames: string[];
  reporterName: string | null;
  reporterEmail?: string | null;
  reporterStoreNumber?: string | null;
  reporterCompanyDomain?: string | null;
  status: string | null;
  advisorName: string | null;
  createdAt: string;
  /** Opening-message snippet for sidebar cards (fallback when AI summary is unavailable). */
  previewText?: string | null;
  /** Gemini 3–4 sentence summary of subject + opening message (Phase 2). */
  summaryText?: string | null;
  relationshipGroup?: 'closely_related' | 'employee_history';
  relationshipEvidence?: string[];
};

export type IntelligenceFuzzyRelatedCase = IntelligenceRelatedCase & {
  fuzzyMatchScore: number;
  fuzzyMatchedName: string;
  fuzzySharedTokens: string[];
};

export type IntelligencePossibleSamePerson = {
  employeeIdentityId: number;
  canonicalName: string;
  confidenceScore: number;
  matchMethod: string;
  sharedTokens: string[];
};

export type IntelligenceEmployeeMentionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'no_employee_mentioned';

export type IntelligenceSnapshot = {
  /** Resolved category for the conversation currently open in Intercom. */
  caseType?: string;
  /** Employee names as written in this conversation (from Gemini extraction). */
  mentionedInReport?: string[];
  employeeMatches: IntelligenceEmployeeMatch[];
  relatedCases: IntelligenceRelatedCase[];
  employeeMentionStatus?: IntelligenceEmployeeMentionStatus;
  unresolvedEmployeeMention?: string | null;
  relatedCaseSearchTerms?: string[];
  /** Typo-tolerant name matches shown below exact related cases. */
  fuzzyRelatedCases?: IntelligenceFuzzyRelatedCase[];
  /** Other conversations in the same case category (any employee). */
  categoryCases?: IntelligenceRelatedCase[];
  /** Related cases hidden by the teammate for this conversation only (Intercom IDs). */
  dismissedRelatedCaseIntercomIds?: string[];
  /** Category cases hidden by the teammate for this conversation only (Intercom IDs). */
  dismissedCategoryCaseIntercomIds?: string[];
  possibleSamePerson?: IntelligencePossibleSamePerson[];
  /** Employees from the company domain roster that match the extracted name (informational only). */
  domainEmployeeMatches?: IntelligencePossibleSamePerson[];
  /** Message count in DB when this snapshot was built. */
  messageCount?: number;
  extractionSource?: 'gemini' | 'fallback';
  /** How employee matching scoped the roster (store → domain → name → created). */
  employeeSearchPath?: EmployeeSearchPath;
  /** Sidebar notices from the store/domain/name matching flow. */
  employeeSearchNotices?: string[];
  /** Store search failed — show button to run company domain search. */
  awaitingCompanyDomainSearch?: boolean;
  /** User already ran company domain search for this snapshot cycle. */
  companyDomainSearchAttempted?: boolean;
  /** Store/domain scope used when loading related + category cases. */
  relatedCaseSearchScope?: RelatedCaseSearchScope;
  /** @deprecated Use relatedCaseSearchScope — kept for older snapshots. */
  relatedCasesReporterDomain?: string | null;
  /** Failed intelligence runs for the same message set; stops after MAX_INTELLIGENCE_ATTEMPTS. */
  failureAttempts?: number;
  /** Durable identity for this intelligence version (case + message count + Intercom updated_at). */
  intelligenceVersion?: string;
  /** Intercom conversation updated_at used when this snapshot was built. */
  sourceRevision?: string | null;
  /** Conversation subject in DB when this snapshot was built (Intercom title). */
  processedSubject?: string | null;
  /**
   * Cached CC list for fast 2nd-open canvas (no live store-directory lookup).
   * Refreshed on intelligence store + Refresh results.
   */
  ccRecipients?: CcRecipientsResult;
  /** Wall-clock ms for the last full intelligence run (Gemini → snapshot). */
  processingDurationMs?: number;
  processingMode?: 'live' | 'fixture';
  promptVersion?: string;
  modelVersion?: string;
  extractionConfidence?: number;
  employeeMatchConfidence?: number;
  requiresManualReview?: boolean;
  /** Per-step ms for the last full intelligence run (evidence / debugging). */
  processingTimingsMs?: {
    syncMs?: number;
    geminiMs?: number;
    employeeMatchMs?: number;
    relatedCasesMs?: number;
    storeSnapshotMs?: number;
    peerRefreshMs?: number;
    totalMs: number;
  };
  processedAt: string;
  /** Human-confirmed fields that later AI runs must not silently overwrite. */
  operatorConfirmedFields?: string[];
};
