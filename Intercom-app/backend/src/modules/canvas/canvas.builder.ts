import { CANVAS_COPY } from '../../constants/canvas.constants.js';
import { filterEmployeeSearchNoticesForDisplay } from '../../constants/employee-search.constants.js';
import { formatCaseTypeLabel, inferCaseType } from '../conversation/case-type.util.js';
import type {
  IntelligenceEmployeeMatch,
  IntelligenceEmployeeMentionStatus,
  IntelligenceFuzzyRelatedCase,
  IntelligenceNameVariant,
  IntelligencePossibleSamePerson,
  IntelligenceRelatedCase,
  IntelligenceSnapshot
} from '../../types/intelligence.types.js';
import { buildHrIntelligenceCaseUrl, buildIntercomConversationUrl } from './canvas.url.util.js';
import {
  buildDismissRelatedCaseComponentId,
  filterDismissedRelatedCases
} from './related-case-dismiss.util.js';
import type { CanvasComponent, CanvasListItem, CanvasResponse } from './canvas.types.js';
import type { CanvasSnapshotBanner } from './canvas-snapshot-banner.util.js';
import { toPublicCanvasErrorMessage } from './canvas-error-message.util.js';
import type { CcRecipientsResult } from '../store-directory/cc-recipients.service.js';

export const REFRESH_INTELLIGENCE_COMPONENT_ID = 'refresh-intelligence';
export const REANALYZE_INTELLIGENCE_COMPONENT_ID = 'reanalyze-intelligence';
export const SEARCH_COMPANY_DOMAIN_COMPONENT_ID = 'search-company-domain';
export const MANUAL_STORE_NUMBER_INPUT_ID = 'manual-store-number';
export const SUBMIT_MANUAL_STORE_NUMBER_COMPONENT_ID = 'submit-manual-store-number';
export const EDIT_MANUAL_STORE_NUMBER_COMPONENT_ID = 'edit-manual-store-number';

export type CanvasScopeSearchContext = {
  storeNumber?: string | null;
  companyDomain?: string | null;
};

export type CanvasPendingPreview = {
  reporterName?: string | null;
  caseType?: string | null;
  subject?: string | null;
  rawPayload?: Record<string, unknown> | null;
};

const header = (text: string): CanvasComponent => ({
  type: 'text',
  text,
  style: 'header'
});

const paragraph = (text: string): CanvasComponent => ({
  type: 'text',
  text,
  style: 'paragraph'
});

const muted = (text: string): CanvasComponent => ({
  type: 'text',
  text,
  style: 'muted'
});

const divider = (): CanvasComponent => ({ type: 'divider' });

const formatDisplayDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const _formatConfidence = (score: number): string => `${Math.round(score)}%`;

const formatCaseType = (caseType: string): string => formatCaseTypeLabel(caseType);

const formatRelatedCaseTitle = (relatedCase: IntelligenceRelatedCase): string =>
  relatedCase.subject?.trim() || 'Untitled conversation';

const resolveOpenCaseEmployeeLabel = (
  employeeMatches: IntelligenceEmployeeMatch[],
  mentionedInReport?: string[]
): string | null => {
  const canonical = employeeMatches[0]?.canonicalName?.trim();
  if (canonical) {
    return canonical;
  }

  const mentioned = mentionedInReport?.map((name) => name.trim()).find(Boolean);
  return mentioned ?? null;
};

const resolveRelatedCasePreviewText = (
  relatedCase: IntelligenceRelatedCase
): string | null =>
  relatedCase.summaryText?.trim() ||
  relatedCase.previewText?.trim() ||
  relatedCase.subject?.trim() ||
  null;

/** Meta only — Intercom clamps list-item subtitles to ~3 lines. */
const formatRelatedCaseSubtitle = (
  relatedCase: IntelligenceRelatedCase,
  _openCaseEmployeeLabel?: string | null
): string => {
  const parts: string[] = [];

  if (relatedCase.status) {
    parts.push(relatedCase.status.charAt(0).toUpperCase() + relatedCase.status.slice(1));
  }

  parts.push(formatDisplayDate(relatedCase.createdAt));
  parts.push(`Case #${relatedCase.intercomId}`);

  return parts.join(' · ');
};

const resolveCanvasMentionStatus = (
  snapshot: IntelligenceSnapshot
): IntelligenceEmployeeMentionStatus => {
  if (snapshot.employeeMentionStatus) {
    return snapshot.employeeMentionStatus;
  }

  if (snapshot.employeeMatches.length > 0) {
    return 'resolved';
  }

  if ((snapshot.unresolvedEmployeeMention ?? snapshot.mentionedInReport?.[0])?.trim()) {
    return 'unresolved';
  }

  return 'no_employee_mentioned';
};

const formatRelatedCaseEvidence = (
  relatedCase: IntelligenceRelatedCase,
  context?: { caseType?: string; storeNumber?: string | null }
): string | null => {
  if (relatedCase.relationshipEvidence && relatedCase.relationshipEvidence.length > 0) {
    const prefix =
      relatedCase.relationshipGroup === 'employee_history'
        ? CANVAS_COPY.EMPLOYEE_HISTORY_EVIDENCE_PREFIX
        : CANVAS_COPY.RELATED_LINK_EVIDENCE_PREFIX;
    return `${prefix}: ${relatedCase.relationshipEvidence.join(' · ')}`;
  }

  const evidence: string[] = [];
  const names = (relatedCase.matchedEmployeeNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (names.length > 0) {
    evidence.push(`same employee (${names.join(', ')})`);
  }
  if (context?.caseType && relatedCase.caseType?.toLowerCase() === context.caseType.toLowerCase()) {
    evidence.push('same category');
  }
  if (
    context?.storeNumber &&
    relatedCase.reporterStoreNumber &&
    context.storeNumber === relatedCase.reporterStoreNumber
  ) {
    evidence.push('same store');
  }

  return evidence.length > 0
    ? `${CANVAS_COPY.RELATED_LINK_EVIDENCE_PREFIX}: ${evidence.join(' · ')}`
    : null;
};

const formatMatchMethodLabel = (matchMethod: string): string => {
  switch (matchMethod) {
    case 'exact':
      return 'Matched';
    case 'alias':
      return 'Known spelling';
    case 'token':
      return 'Name match';
    case 'fuzzy':
      return 'Similar spelling';
    case 'manual':
      return 'Confirmed';
    default:
      return 'Matched';
  }
};

const formatIdentityEvidence = (match: IntelligenceEmployeeMatch): string => {
  const method = (() => {
    switch (match.matchMethod) {
      case 'exact': return 'Exact name match';
      case 'alias': return 'Known alias';
      case 'token': return 'Shared name tokens';
      case 'fuzzy': return 'Similar spelling';
      case 'manual': return 'Operator confirmed';
      default: return 'Directory match';
    }
  })();
  const extracted = match.extractedName?.trim();
  return extracted && extracted.toLowerCase() !== match.canonicalName.trim().toLowerCase()
    ? `${method}: “${extracted}” → ${match.canonicalName} · ${match.confidenceScore}% confidence`
    : `${method} · ${match.confidenceScore}% confidence`;
};

const formatNameVariants = (
  match: IntelligenceEmployeeMatch,
  variants: IntelligenceNameVariant[] | undefined
): string | null => {
  const byNormalizedName = new Map<string, IntelligenceNameVariant>();
  const canonicalKey = match.canonicalName.trim().toLowerCase();

  const considerVariant = (variant: IntelligenceNameVariant): void => {
    const variantKey = variant.variantName.trim().toLowerCase();
    if (!variantKey || variantKey === canonicalKey) {
      return;
    }

    const existing = byNormalizedName.get(variantKey);
    if (!existing || variant.confidenceScore > existing.confidenceScore) {
      byNormalizedName.set(variantKey, variant);
    }
  };

  if (match.extractedName) {
    considerVariant({
      variantName: match.extractedName,
      confidenceScore: match.confidenceScore,
      matchMethod: match.matchMethod
    });
  }

  for (const variant of variants ?? []) {
    considerVariant(variant);
  }

  if (byNormalizedName.size === 0) {
    return null;
  }

  const labels = [...byNormalizedName.values()]
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .map((variant) => variant.variantName);

  return `Also written as: ${labels.join(', ')}`;
};

const buildCaseCategorySection = (caseType: string | undefined): CanvasComponent[] => {
  if (!caseType?.trim()) {
    return [];
  }

  return [
    muted(`${CANVAS_COPY.CASE_CATEGORY_PREFIX}: ${formatCaseType(caseType)}`)
  ];
};

const buildMentionedInReportSection = (names: string[] | undefined): CanvasComponent[] => {
  const uniqueNames = [...new Set((names ?? []).map((name) => name.trim()).filter(Boolean))];

  if (uniqueNames.length === 0) {
    return [];
  }

  return [
    muted(`${CANVAS_COPY.MENTIONED_IN_REPORT_PREFIX}: ${uniqueNames.join(', ')}`)
  ];
};

const buildEditStoreNumberButton = (): CanvasComponent => ({
  type: 'button',
  id: EDIT_MANUAL_STORE_NUMBER_COMPONENT_ID,
  label: CANVAS_COPY.CC_STORE_EDIT,
  style: 'link',
  action: {
    type: 'submit'
  }
});

const buildStoreNumberInputControls = (options?: {
  value?: string | null;
  requiredMessage?: boolean;
}): CanvasComponent[] => {
  const components: CanvasComponent[] = [];

  if (options?.requiredMessage) {
    components.push(muted(CANVAS_COPY.CC_STORE_INPUT_REQUIRED));
  } else {
    components.push(muted(CANVAS_COPY.CC_STORE_INPUT_HINT));
  }

  components.push({
    type: 'input',
    id: MANUAL_STORE_NUMBER_INPUT_ID,
    label: CANVAS_COPY.CC_STORE_INPUT_LABEL,
    placeholder: CANVAS_COPY.CC_STORE_INPUT_PLACEHOLDER,
    ...(options?.value ? { value: options.value } : {})
  });
  components.push({
    type: 'button',
    id: SUBMIT_MANUAL_STORE_NUMBER_COMPONENT_ID,
    label: CANVAS_COPY.CC_STORE_SUBMIT,
    style: 'secondary',
    action: {
      type: 'submit'
    }
  });

  return components;
};

/** Store field is hidden until Edit — used when store is missing, wrong, or has no CC list. */
const appendEditableStoreControls = (
  components: CanvasComponent[],
  options: {
    editingStore?: boolean;
    storeValue?: string | null;
    requiredMessage?: boolean;
  }
): void => {
  if (options.editingStore) {
    components.push(
      ...buildStoreNumberInputControls({
        value: options.storeValue,
        requiredMessage: options.requiredMessage
      })
    );
    return;
  }

  components.push(buildEditStoreNumberButton());
};

const buildCcRecipientsSection = (
  cc?: CcRecipientsResult | null,
  options?: { editingStore?: boolean; storeInputRequired?: boolean }
): CanvasComponent[] => {
  if (!cc) {
    return [];
  }

  const editingStore = options?.editingStore === true;
  const storeInputRequired = options?.storeInputRequired === true;

  const components: CanvasComponent[] = [
    header(CANVAS_COPY.CC_RECIPIENTS_HEADER),
    muted(CANVAS_COPY.CC_RECIPIENTS_DETAIL)
  ];

  if (cc.status === 'no_store') {
    components.push(paragraph(CANVAS_COPY.CC_NO_STORE));
    appendEditableStoreControls(components, {
      editingStore,
      requiredMessage: storeInputRequired
    });
    return components;
  }

  if (cc.status === 'unavailable') {
    components.push(muted(cc.message || CANVAS_COPY.CC_UNAVAILABLE));
    return components;
  }

  if (cc.status === 'not_found') {
    components.push(
      paragraph(
        `${CANVAS_COPY.CC_NOT_FOUND_PREFIX} ${cc.storeNumber}. ${CANVAS_COPY.CC_NOT_FOUND_HINT}`
      )
    );
    appendEditableStoreControls(components, {
      editingStore,
      storeValue: cc.storeNumber,
      requiredMessage: storeInputRequired
    });
    return components;
  }

  if (cc.status === 'ambiguous') {
    components.push(paragraph(cc.message));
    appendEditableStoreControls(components, {
      editingStore,
      storeValue: cc.storeNumber,
      requiredMessage: storeInputRequired
    });
    return components;
  }

  const companyLine = cc.companyName
    ? `Company: ${cc.companyName} · Store: ${cc.storeNumber}`
    : `Store: ${cc.storeNumber}`;
  components.push(muted(companyLine));

  if (cc.recipients.length === 0) {
    components.push(paragraph(CANVAS_COPY.CC_EMPTY_FOR_STORE));
    appendEditableStoreControls(components, {
      editingStore,
      storeValue: cc.storeNumber,
      requiredMessage: storeInputRequired
    });
    return components;
  }

  const items: CanvasListItem[] = cc.recipients.map((recipient, index) => ({
    type: 'item',
    id: `cc-recipient-${index}`,
    title: `${recipient.name} (${recipient.role})`,
    subtitle: recipient.email
  }));

  components.push({ type: 'list', items });
  // Recipients found — still allow correcting a wrong store number.
  appendEditableStoreControls(components, {
    editingStore,
    storeValue: cc.storeNumber,
    requiredMessage: storeInputRequired
  });
  return components;
};

const buildEmployeeSearchNoticesSection = (
  snapshot: Pick<
    IntelligenceSnapshot,
    'employeeSearchNotices' | 'employeeMatches' | 'awaitingCompanyDomainSearch'
  >
): CanvasComponent[] => {
  const uniqueNotices = filterEmployeeSearchNoticesForDisplay(snapshot.employeeSearchNotices, {
    employeeMatchCount: snapshot.employeeMatches.length
  });

  return uniqueNotices.map((notice) => muted(notice));
};

const buildRefreshButton = (): CanvasComponent => ({
  type: 'button',
  id: REFRESH_INTELLIGENCE_COMPONENT_ID,
  label: CANVAS_COPY.REFRESH_RESULTS,
  style: 'link',
  action: {
    type: 'submit'
  }
});

const buildReanalyzeButton = (): CanvasComponent => ({
  type: 'button',
  id: REANALYZE_INTELLIGENCE_COMPONENT_ID,
  label: CANVAS_COPY.REANALYZE_CASE,
  style: 'link',
  action: {
    type: 'submit'
  }
});

/** Light refresh + hard re-analyze — keep both so existing wait/load flows stay usable. */
const buildRefreshActionButtons = (): CanvasComponent[] => [
  buildRefreshButton(),
  buildReanalyzeButton()
];

const buildScopeSearchButtons = (
  _context: CanvasScopeSearchContext | undefined,
  _banner?: CanvasSnapshotBanner
): CanvasComponent[] => {
  // Store/domain search buttons removed (client request Jul 2026). CC recipients remain separate.
  return [];
};

const buildSnapshotStatusSection = (
  banner: CanvasSnapshotBanner,
  scopeSearch?: CanvasScopeSearchContext
): CanvasComponent[] => {
  const components: CanvasComponent[] = [];

  switch (banner) {
    case 'refreshed':
      components.push(muted(CANVAS_COPY.RESULTS_UPDATED), ...buildRefreshActionButtons());
      break;
    case 'pending-update':
      components.push(
        muted(CANVAS_COPY.UPDATES_PENDING),
        muted(CANVAS_COPY.REFRESH_HINT),
        ...buildRefreshActionButtons()
      );
      break;
    case 'refresh-pending':
      components.push(
        muted(CANVAS_COPY.UPDATING_INTELLIGENCE),
        muted(CANVAS_COPY.REFRESH_STILL_UPDATING_HINT),
        ...buildRefreshActionButtons()
      );
      break;
    case 'domain-search-pending':
    case 'store-search-pending':
      // Legacy banners — store/domain search removed; show generic updating state.
      components.push(
        muted(CANVAS_COPY.UPDATING_INTELLIGENCE),
        muted(CANVAS_COPY.REFRESH_STILL_UPDATING_HINT),
        ...buildRefreshActionButtons()
      );
      break;
    case 'current':
    default:
      components.push(...buildRefreshActionButtons());
      break;
  }

  components.push(...buildScopeSearchButtons(scopeSearch, banner));
  return components;
};

const formatProcessingState = (banner: CanvasSnapshotBanner): string => {
  switch (banner) {
    case 'pending-update':
    case 'refresh-pending':
    case 'domain-search-pending':
    case 'store-search-pending':
      return CANVAS_COPY.PROCESSING_ACTIVE;
    case 'refreshed':
    case 'current':
    default:
      return CANVAS_COPY.PROCESSING_READY;
  }
};

const formatWritebackState = (status?: string | null): string => {
  switch (status) {
    case 'synced': return CANVAS_COPY.WRITEBACK_SYNCED;
    case 'failed': return CANVAS_COPY.WRITEBACK_FAILED;
    case 'pending': return CANVAS_COPY.WRITEBACK_PENDING;
    case 'skipped': return CANVAS_COPY.WRITEBACK_SKIPPED;
    default: return CANVAS_COPY.WRITEBACK_NOT_REPORTED;
  }
};

const buildSystemStateSection = (
  snapshot: IntelligenceSnapshot,
  banner: CanvasSnapshotBanner,
  intercomSyncStatus?: string | null
): CanvasComponent[] => {
  const versionPart = snapshot.intelligenceVersion?.split(':')[0];
  const version = versionPart ? `v${versionPart}` : '—';
  return [
    header(CANVAS_COPY.SYSTEM_STATE_HEADER),
    muted(`Processing: ${formatProcessingState(banner)}`),
    muted(`${CANVAS_COPY.PROCESSING_VERSION_PREFIX}: ${version} · ${CANVAS_COPY.LAST_UPDATED_PREFIX}: ${formatDisplayDate(snapshot.processedAt)}`),
    muted(`Intercom write-back: ${formatWritebackState(intercomSyncStatus)}`)
  ];
};

const buildOpenDashboardButton = (caseId?: number): CanvasComponent[] => {
  if (!caseId) {
    return [];
  }
  return [{
    type: 'button',
    id: 'open-hr-intelligence-case',
    label: 'Open in HR Intelligence',
    style: 'secondary',
    action: { type: 'url', url: buildHrIntelligenceCaseUrl(caseId) }
  }];
};

const formatEmployeeMatchItem = (match: IntelligenceEmployeeMatch): CanvasListItem => {
  const variantLine = formatNameVariants(match, match.nameVariants);
  const subtitle = variantLine
    ? `${formatMatchMethodLabel(match.matchMethod)} · ${match.confidenceScore}% · ${variantLine}`
    : `${formatMatchMethodLabel(match.matchMethod)} · ${match.confidenceScore}%`;

  return {
    type: 'item',
    id: `employee-${match.employeeIdentityId}`,
    title: match.canonicalName,
    subtitle
  };
};

const buildEmployeeMatchSection = (
  snapshot: IntelligenceSnapshot,
  options?: { companyDomainSearchAttempted?: boolean }
): CanvasComponent[] => {
  const components: CanvasComponent[] = [header(CANVAS_COPY.EMPLOYEE_MATCH_HEADER)];
  const mentionStatus = resolveCanvasMentionStatus(snapshot);

  if (mentionStatus === 'no_employee_mentioned') {
    components.push(muted(CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED));
    components.push(muted(CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED_STATUS));
    return components;
  }

  if (mentionStatus === 'unresolved' || mentionStatus === 'ambiguous') {
    const mention =
      snapshot.unresolvedEmployeeMention?.trim() || snapshot.mentionedInReport?.[0]?.trim() || null;
    if (mention) {
      components.push(muted(`Employee mentioned: ${mention}`));
    }
    components.push(muted(CANVAS_COPY.UNRESOLVED_DIRECTORY_MATCH));
    components.push(muted(CANVAS_COPY.REVIEW_REQUIRED));
    return components;
  }

  const matches = snapshot.employeeMatches;
  if (matches.length === 0) {
    components.push(muted(CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED));
    components.push(muted(CANVAS_COPY.NO_EMPLOYEE_IDENTIFIED_STATUS));
    return components;
  }

  const shouldSplit =
    options?.companyDomainSearchAttempted === true && matches.length > 1;

  if (!shouldSplit) {
    const strongestMatch = matches[0];
    if (strongestMatch) {
      components.push(muted(`${CANVAS_COPY.IDENTITY_EVIDENCE_PREFIX}: ${formatIdentityEvidence(strongestMatch)}`));
    }
    components.push({
      type: 'list',
      items: matches.map(formatEmployeeMatchItem)
    });
    return components;
  }

  const storeMatches = matches.filter(
    (match) => match.confidenceScore === 100 && match.matchMethod === 'exact'
  );
  const domainMatches = matches.filter(
    (match) => !(match.confidenceScore === 100 && match.matchMethod === 'exact')
  );

  if (storeMatches.length > 0) {
    components.push(muted(`${CANVAS_COPY.IDENTITY_EVIDENCE_PREFIX}: ${formatIdentityEvidence(storeMatches[0])}`));
    components.push({
      type: 'list',
      items: storeMatches.map(formatEmployeeMatchItem)
    });
  }

  if (domainMatches.length > 0) {
    components.push(divider());
    components.push(header(CANVAS_COPY.DOMAIN_EMPLOYEE_MATCHES_HEADER));
    components.push(muted(CANVAS_COPY.DOMAIN_EMPLOYEE_MATCHES_DETAIL));
    components.push({
      type: 'list',
      items: domainMatches.map(formatEmployeeMatchItem)
    });
  }

  return components;
};

const buildPossibleSamePersonSection = (
  possibleMatches: IntelligencePossibleSamePerson[]
): CanvasComponent[] => {
  if (possibleMatches.length === 0) {
    return [];
  }

  const components: CanvasComponent[] = [
    header(CANVAS_COPY.POSSIBLE_SAME_PERSON_HEADER),
    muted(CANVAS_COPY.POSSIBLE_SAME_PERSON_DETAIL)
  ];

  components.push({
    type: 'list',
    items: possibleMatches.map((match) => ({
      type: 'item',
      id: `possible-${match.employeeIdentityId}`,
      title: match.canonicalName,
      subtitle: [
        `${match.confidenceScore}% possible match`,
        match.sharedTokens.length > 0 ? `similar names: ${match.sharedTokens.join(', ')}` : null
      ]
        .filter(Boolean)
        .join(' · ')
    }))
  });

  return components;
};

const _buildDomainEmployeeMatchesSection = (
  domainMatches: IntelligencePossibleSamePerson[]
): CanvasComponent[] => {
  if (domainMatches.length === 0) {
    return [];
  }

  const components: CanvasComponent[] = [
    header(CANVAS_COPY.DOMAIN_EMPLOYEE_MATCHES_HEADER),
    muted(CANVAS_COPY.DOMAIN_EMPLOYEE_MATCHES_DETAIL)
  ];

  components.push({
    type: 'list',
    items: domainMatches.map((match) => ({
      type: 'item',
      id: `domain-match-${match.employeeIdentityId}`,
      title: match.canonicalName,
      subtitle: [
        `${match.confidenceScore}% match`,
        match.sharedTokens.length > 0 ? `similar names: ${match.sharedTokens.join(', ')}` : null
      ]
        .filter(Boolean)
        .join(' · ')
    }))
  });

  return components;
};

const buildCaseListItems = (
  relatedCase: IntelligenceRelatedCase,
  idPrefix: string,
  openCaseEmployeeLabel?: string | null
): CanvasListItem => ({
  type: 'item',
  id: `${idPrefix}-${relatedCase.intercomId}`,
  title: formatRelatedCaseTitle(relatedCase),
  subtitle: formatRelatedCaseSubtitle(relatedCase, openCaseEmployeeLabel),
  action: {
    type: 'url',
    url: buildIntercomConversationUrl(relatedCase.intercomId)
  }
});

const buildDismissCaseButton = (
  componentId: string,
  intercomId: string
): CanvasComponent => ({
  type: 'button',
  id: componentId,
  label: CANVAS_COPY.DISMISS_RELATED_CASE,
  style: 'link',
  action: {
    type: 'submit',
    payload: {
      relatedIntercomId: intercomId
    }
  }
});

const buildRelatedCasesSection = (
  relatedCases: IntelligenceRelatedCase[],
  openCaseEmployeeLabel?: string | null,
  mentionStatus?: IntelligenceEmployeeMentionStatus,
  context?: { caseType?: string; storeNumber?: string | null }
): CanvasComponent[] => {
  if (mentionStatus === 'no_employee_mentioned') {
    return [
      header(CANVAS_COPY.RELATED_CASES_HEADER),
      muted(CANVAS_COPY.NO_RELATED_CASES_NO_EMPLOYEE)
    ];
  }

  const closelyRelated = relatedCases.filter(
    (relatedCase) => relatedCase.relationshipGroup !== 'employee_history'
  );
  const otherHistory = relatedCases.filter(
    (relatedCase) => relatedCase.relationshipGroup === 'employee_history'
  );

  const components: CanvasComponent[] = [
    header(
      otherHistory.length > 0 ? CANVAS_COPY.CLOSELY_RELATED_CASES_HEADER : CANVAS_COPY.RELATED_CASES_HEADER
    )
  ];

  if (relatedCases.length === 0) {
    components.push(muted(CANVAS_COPY.NO_RELATED_CASES));
    return components;
  }

  const appendCaseCards = (cases: IntelligenceRelatedCase[]): void => {
    for (const relatedCase of cases) {
      components.push({
        type: 'list',
        items: [buildCaseListItems(relatedCase, 'related', openCaseEmployeeLabel)]
      });

      const preview = resolveRelatedCasePreviewText(relatedCase);
      if (preview) {
        components.push(paragraph(preview));
      }
      const evidence = formatRelatedCaseEvidence(relatedCase, context);
      if (evidence) {
        components.push(muted(evidence));
      }

      components.push(
        buildDismissCaseButton(
          buildDismissRelatedCaseComponentId(relatedCase.intercomId),
          relatedCase.intercomId
        )
      );
    }
  };

  appendCaseCards(closelyRelated.length > 0 || otherHistory.length === 0 ? closelyRelated : relatedCases);

  if (otherHistory.length > 0) {
    components.push(divider());
    components.push(header(CANVAS_COPY.OTHER_EMPLOYEE_HISTORY_HEADER));
    appendCaseCards(otherHistory);
  }

  return components;
};

const buildFuzzyRelatedCasesSection = (
  fuzzyRelatedCases: IntelligenceFuzzyRelatedCase[],
  openCaseEmployeeLabel?: string | null
): CanvasComponent[] => {
  if (fuzzyRelatedCases.length === 0) {
    return [];
  }

  const components: CanvasComponent[] = [
    header(CANVAS_COPY.FUZZY_RELATED_CASES_HEADER),
    muted(CANVAS_COPY.FUZZY_RELATED_CASES_DETAIL)
  ];

  for (const fuzzyCase of fuzzyRelatedCases) {
    const spellingHint =
      fuzzyCase.fuzzySharedTokens.length > 0
        ? `similar spelling: ${fuzzyCase.fuzzySharedTokens
            .join(', ')
            .replace(/~/g, ' / ')}`
        : `matched as: ${fuzzyCase.fuzzyMatchedName}`;
    const caseItem = buildCaseListItems(fuzzyCase, 'fuzzy-related', openCaseEmployeeLabel);

    components.push({
      type: 'list',
      items: [
        {
          ...caseItem,
          subtitle: `${caseItem.subtitle} · ${fuzzyCase.fuzzyMatchScore}% · ${spellingHint}`
        }
      ]
    });

    const preview = resolveRelatedCasePreviewText(fuzzyCase);
    if (preview) {
      components.push(paragraph(preview));
    }
  }

  return components;
};

const wrapCanvas = (components: CanvasComponent[]): CanvasResponse => ({
  canvas: {
    content: {
      components
    }
  }
});

export const canvasBuilder = {
  buildConfigure(): CanvasResponse {
    return wrapCanvas([
      header(CANVAS_COPY.APP_TITLE),
      paragraph(CANVAS_COPY.APP_CONNECTED),
      muted(CANVAS_COPY.APP_CONNECTED_DETAIL)
    ]);
  },

  buildDisabled(): CanvasResponse {
    return wrapCanvas([
      header(CANVAS_COPY.APP_TITLE),
      paragraph(CANVAS_COPY.INTERCOM_DISABLED)
    ]);
  },

  buildNotSynced(): CanvasResponse {
    return wrapCanvas([
      header(CANVAS_COPY.APP_TITLE),
      paragraph(CANVAS_COPY.NOT_SYNCED),
      muted(CANVAS_COPY.PROCESSING_DETAIL),
      ...buildRefreshActionButtons()
    ]);
  },

  buildSearchingCompanyDomain(preview?: CanvasPendingPreview): CanvasResponse {
    const components: CanvasComponent[] = [header(CANVAS_COPY.APP_TITLE)];

    const reporterName = preview?.reporterName?.trim();
    if (reporterName) {
      components.push(
        muted(`${CANVAS_COPY.PROCESSING_REPORTER_PREFIX}: ${reporterName}`)
      );
    }

    const caseType = inferCaseType(
      preview?.subject,
      preview?.rawPayload ?? null,
      preview?.caseType
    );
    components.push(...buildCaseCategorySection(caseType));
    components.push(muted(CANVAS_COPY.SEARCHING_COMPANY_DOMAIN));
    components.push(...buildRefreshActionButtons());

    return wrapCanvas(components);
  },

  buildPending(
    preview?: CanvasPendingPreview,
    ccRecipients?: CcRecipientsResult | null,
    options?: { editingStore?: boolean; storeInputRequired?: boolean; caseId?: number }
  ): CanvasResponse {
    const components: CanvasComponent[] = [
      header(CANVAS_COPY.APP_TITLE),
      ...buildOpenDashboardButton(options?.caseId),
      header(CANVAS_COPY.CASE_SUMMARY_HEADER),
      muted('Status: Processing')
    ];

    const reporterName = preview?.reporterName?.trim();
    if (reporterName) {
      components.push(
        muted(`${CANVAS_COPY.PROCESSING_REPORTER_PREFIX}: ${reporterName}`)
      );
    }

    const caseType = inferCaseType(
      preview?.subject,
      preview?.rawPayload ?? null,
      preview?.caseType
    );
    components.push(...buildCaseCategorySection(caseType));
    // components.push(paragraph(CANVAS_COPY.PROCESSING));
    components.push(muted(CANVAS_COPY.PROCESSING_DETAIL));
    components.push(...buildRefreshActionButtons());

    const ccSection = buildCcRecipientsSection(ccRecipients, options);
    if (ccSection.length > 0) {
      components.push(divider(), ...ccSection);
    }

    return wrapCanvas(components);
  },

  buildFailed(errorMessage?: string | null): CanvasResponse {
    return wrapCanvas([
      header(CANVAS_COPY.APP_TITLE),
      paragraph(CANVAS_COPY.FAILED),
      muted(toPublicCanvasErrorMessage(errorMessage)),
      ...buildRefreshActionButtons()
    ]);
  },

  buildUpdatingIntelligence(
    ccRecipients?: CcRecipientsResult | null,
    options?: { editingStore?: boolean; storeInputRequired?: boolean }
  ): CanvasResponse {
    const components: CanvasComponent[] = [
      header(CANVAS_COPY.APP_TITLE),
      muted(CANVAS_COPY.UPDATING_INTELLIGENCE),
      muted(CANVAS_COPY.REFRESH_STILL_UPDATING_HINT),
      ...buildRefreshActionButtons()
    ];

    const ccSection = buildCcRecipientsSection(ccRecipients, options);
    if (ccSection.length > 0) {
      components.push(divider(), ...ccSection);
    }

    return wrapCanvas(components);
  },

  buildDomainSearchProcessing(preview?: CanvasPendingPreview): CanvasResponse {
    const components: CanvasComponent[] = [
      header(CANVAS_COPY.APP_TITLE),
      muted(CANVAS_COPY.DOMAIN_SEARCH_STARTED),
      muted(CANVAS_COPY.SEARCHING_COMPANY_DOMAIN),
      muted(CANVAS_COPY.SCOPE_SEARCH_REOPEN_HINT),
      ...buildRefreshActionButtons()
    ];

    const reporterName = preview?.reporterName?.trim();
    if (reporterName) {
      components.splice(1, 0, muted(`${CANVAS_COPY.PROCESSING_REPORTER_PREFIX}: ${reporterName}`));
    }

    return wrapCanvas(components);
  },

  buildStoreSearchProcessing(preview?: CanvasPendingPreview): CanvasResponse {
    const components: CanvasComponent[] = [
      header(CANVAS_COPY.APP_TITLE),
      muted(CANVAS_COPY.STORE_SEARCH_STARTED),
      muted(CANVAS_COPY.SEARCHING_CURRENT_STORE),
      muted(CANVAS_COPY.SCOPE_SEARCH_REOPEN_HINT),
      ...buildRefreshActionButtons()
    ];

    const reporterName = preview?.reporterName?.trim();
    if (reporterName) {
      components.splice(1, 0, muted(`${CANVAS_COPY.PROCESSING_REPORTER_PREFIX}: ${reporterName}`));
    }

    return wrapCanvas(components);
  },

  buildIntelligenceSnapshot(
    snapshot: IntelligenceSnapshot,
    options?: {
      banner?: CanvasSnapshotBanner;
      scopeSearch?: CanvasScopeSearchContext;
      ccRecipients?: CcRecipientsResult | null;
      editingStore?: boolean;
      storeInputRequired?: boolean;
      intercomSyncFailed?: boolean;
      intercomSyncStatus?: string | null;
      caseId?: number;
    }
  ): CanvasResponse {
    const banner = options?.banner ?? 'current';
    const relatedCases = filterDismissedRelatedCases(
      snapshot.relatedCases,
      snapshot.dismissedRelatedCaseIntercomIds
    );
    const possibleSection = buildPossibleSamePersonSection(snapshot.possibleSamePerson ?? []);
    const caseCategorySection = buildCaseCategorySection(snapshot.caseType);
    const mentionStatus = resolveCanvasMentionStatus(snapshot);
    const mentionedInReportSection =
      mentionStatus === 'resolved'
        ? buildMentionedInReportSection(snapshot.mentionedInReport)
        : [];
    const ccSection = buildCcRecipientsSection(options?.ccRecipients, {
      editingStore: options?.editingStore,
      storeInputRequired: options?.storeInputRequired
    });
    const hasReportContext = caseCategorySection.length > 0 || mentionedInReportSection.length > 0;
    const openCaseEmployeeLabel = resolveOpenCaseEmployeeLabel(
      snapshot.employeeMatches,
      snapshot.mentionedInReport
    );
    const fuzzyRelatedSection = buildFuzzyRelatedCasesSection(
      (snapshot.fuzzyRelatedCases ?? []).filter(
        (fuzzyCase) => !relatedCases.some((relatedCase) => relatedCase.intercomId === fuzzyCase.intercomId)
      ),
      openCaseEmployeeLabel
    );
    const metaLines: CanvasComponent[] = [
      ...(options?.intercomSyncFailed ? [muted(CANVAS_COPY.INTERCOM_SYNC_FAILED)] : []),
      ...(snapshot.requiresManualReview ? [muted(CANVAS_COPY.MANUAL_REVIEW)] : []),
      ...(snapshot.operatorConfirmedFields?.length
        ? [muted(CANVAS_COPY.OPERATOR_CORRECTED)]
        : [])
    ];
    const components: CanvasComponent[] = [
      header(CANVAS_COPY.APP_TITLE),
      ...buildSnapshotStatusSection(banner, options?.scopeSearch),
      ...buildOpenDashboardButton(options?.caseId),
      ...metaLines,
      divider(),
      header(CANVAS_COPY.CASE_SUMMARY_HEADER),
      muted(`Status: ${formatProcessingState(banner)}`),
      ...caseCategorySection,
      ...mentionedInReportSection,
      ...(hasReportContext ? [divider()] : []),
      ...(ccSection.length > 0 ? [...ccSection, divider()] : []),
      ...buildEmployeeSearchNoticesSection(snapshot),
      ...buildEmployeeMatchSection(snapshot),
      ...(possibleSection.length > 0 ? [divider(), ...possibleSection] : []),
      divider(),
      ...buildRelatedCasesSection(relatedCases, openCaseEmployeeLabel, mentionStatus, {
        caseType: snapshot.caseType,
        storeNumber: options?.scopeSearch?.storeNumber
      }),
      ...(fuzzyRelatedSection.length > 0 ? [divider(), ...fuzzyRelatedSection] : []),
      divider(),
      ...buildSystemStateSection(snapshot, banner, options?.intercomSyncStatus)
    ];

    return wrapCanvas(components);
  }
};
