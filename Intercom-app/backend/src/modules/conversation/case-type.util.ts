import {
  INTERCOM_CASE_TYPE_KEYWORDS,
  INTERCOM_CASE_TYPE_SLUGS,
  INTERCOM_CASE_TYPES,
  type IntercomCaseType
} from '../../constants/intercom.constants.js';

const CASE_TYPE_VALUES = new Set<string>(INTERCOM_CASE_TYPE_SLUGS);

const APPLICATION_STATUS_SLUGS = new Set([
  'hr_intelligence_processed',
  'hr-intelligence-processed',
  'category_hr_intelligence_processed',
  'category-hr-intelligence-processed',
  'manual_review',
  'manual-review',
  'processing',
  'sync',
  'ready',
  'failed'
]);

/**
 * When a subject matches multiple categories, pick the more specific operational one.
 * Attendance beats conduct so "late again — conduct discussion" stays attendance.
 */
const CASE_TYPE_PRIORITY: readonly IntercomCaseType[] = [
  INTERCOM_CASE_TYPES.ATTENDANCE,
  INTERCOM_CASE_TYPES.SCHEDULE,
  INTERCOM_CASE_TYPES.LEAVE,
  INTERCOM_CASE_TYPES.VACATION,
  INTERCOM_CASE_TYPES.PAYROLL,
  INTERCOM_CASE_TYPES.BENEFITS,
  INTERCOM_CASE_TYPES.INJURY,
  INTERCOM_CASE_TYPES.ACCOMMODATION,
  INTERCOM_CASE_TYPES.TERMINATION,
  INTERCOM_CASE_TYPES.ONBOARDING,
  INTERCOM_CASE_TYPES.TRANSFER,
  INTERCOM_CASE_TYPES.COACHING,
  INTERCOM_CASE_TYPES.ESCALATION,
  INTERCOM_CASE_TYPES.MISCONDUCT,
  INTERCOM_CASE_TYPES.CONDUCT,
  INTERCOM_CASE_TYPES.POLICY,
  INTERCOM_CASE_TYPES.GENERAL
];

const SUBJECT_NOISE_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'for',
  'of',
  'on',
  'in',
  'at',
  'with',
  'about',
  'regarding',
  're',
  'fw',
  'fwd',
  'today',
  'yesterday',
  'tomorrow',
  'again',
  'still',
  'this',
  'that',
  'week',
  'month',
  'please',
  'need',
  'help',
  'issue',
  'issues',
  'concern',
  'concerns',
  'case',
  'employee'
]);

const pickHighestPriorityCaseType = (
  matches: readonly IntercomCaseType[]
): IntercomCaseType => {
  for (const caseType of CASE_TYPE_PRIORITY) {
    if (matches.includes(caseType)) {
      return caseType;
    }
  }

  return matches[0] ?? INTERCOM_CASE_TYPES.GENERAL;
};

export const normalizeCaseTypeSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

  if (!slug) {
    return INTERCOM_CASE_TYPES.GENERAL;
  }

  const raw = value.trim().toLowerCase();
  if (APPLICATION_STATUS_SLUGS.has(slug) || APPLICATION_STATUS_SLUGS.has(raw)) {
    return INTERCOM_CASE_TYPES.GENERAL;
  }

  if (CASE_TYPE_VALUES.has(slug)) {
    return slug;
  }

  for (const knownSlug of INTERCOM_CASE_TYPE_SLUGS) {
    if (knownSlug !== INTERCOM_CASE_TYPES.GENERAL && slug.includes(knownSlug)) {
      return knownSlug;
    }
  }

  for (const [caseType, keywords] of Object.entries(INTERCOM_CASE_TYPE_KEYWORDS) as Array<
    [IntercomCaseType, readonly string[]]
  >) {
    if (keywords.some((keyword) => slug.includes(keyword.replace(/\s+/g, '_')))) {
      return caseType;
    }
  }

  return INTERCOM_CASE_TYPES.GENERAL;
};

/** Clear subject keywords → stable category (with priority if several match). */
export const inferCaseTypeFromSubject = (subject: string | null | undefined): IntercomCaseType => {
  const haystack = subject?.trim().toLowerCase() ?? '';
  if (!haystack) {
    return INTERCOM_CASE_TYPES.GENERAL;
  }

  const matches: IntercomCaseType[] = [];
  for (const [caseType, keywords] of Object.entries(INTERCOM_CASE_TYPE_KEYWORDS) as Array<
    [IntercomCaseType, readonly string[]]
  >) {
    if (caseType === INTERCOM_CASE_TYPES.GENERAL) {
      continue;
    }

    if (keywords.some((keyword) => haystack.includes(keyword))) {
      matches.push(caseType);
    }
  }

  if (matches.length === 0) {
    return INTERCOM_CASE_TYPES.GENERAL;
  }

  return pickHighestPriorityCaseType(matches);
};

/**
 * Normalize subject for reuse matching:
 * "Late again" and "late again today" → same bucket.
 */
export const normalizeSubjectForCaseTypeMatch = (
  subject: string | null | undefined
): string => {
  if (!subject?.trim()) {
    return '';
  }

  return subject
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !SUBJECT_NOISE_WORDS.has(token))
    .sort()
    .join(' ');
};

export const subjectsShareCaseTypeBucket = (
  left: string | null | undefined,
  right: string | null | undefined
): boolean => {
  const normalizedLeft = normalizeSubjectForCaseTypeMatch(left);
  const normalizedRight = normalizeSubjectForCaseTypeMatch(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftTokens = new Set(normalizedLeft.split(' ').filter(Boolean));
  const rightTokens = new Set(normalizedRight.split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return overlap >= 1 && overlap / union >= 0.67;
};

/** Prefer Gemini when present; subject keywords only when AI is absent. */
export const mergeCaseTypeSignals = (
  subject: string | null | undefined,
  aiCaseType?: string | null
): string => {
  if (aiCaseType?.trim()) {
    const fromAi = normalizeCaseTypeSlug(aiCaseType);
    if (fromAi !== INTERCOM_CASE_TYPES.GENERAL) {
      return fromAi;
    }
  }

  return inferCaseTypeFromSubject(subject);
};

/**
 * Resolve HR case category:
 * 1. Gemini (subject first, then messages — resolved upstream)
 * 2. Strong subject keywords
 * 3. Similar-subject reuse
 * 4. Stored case type
 * 5. general
 *
 * Intercom tags and application write-back statuses are never categories.
 */
export const resolveCaseType = (input: {
  subject: string | null | undefined;
  rawPayload: Record<string, unknown> | null | undefined;
  storedCaseType?: string | null;
  geminiCaseType?: string | null;
  similarSubjectCaseType?: string | null;
}): string => {
  void input.rawPayload;

  if (input.geminiCaseType?.trim()) {
    const fromGemini = normalizeCaseTypeSlug(input.geminiCaseType);
    if (fromGemini !== INTERCOM_CASE_TYPES.GENERAL) {
      return fromGemini;
    }
  }

  const fromSubject = inferCaseTypeFromSubject(input.subject);
  if (fromSubject !== INTERCOM_CASE_TYPES.GENERAL) {
    return fromSubject;
  }

  if (input.similarSubjectCaseType?.trim()) {
    const reused = normalizeCaseTypeSlug(input.similarSubjectCaseType);
    if (reused !== INTERCOM_CASE_TYPES.GENERAL) {
      return reused;
    }
  }

  if (input.storedCaseType?.trim()) {
    const stored = normalizeCaseTypeSlug(input.storedCaseType);
    if (stored !== INTERCOM_CASE_TYPES.GENERAL) {
      return stored;
    }
  }

  return INTERCOM_CASE_TYPES.GENERAL;
};

/**
 * Conduct + misconduct are one related-case / display family.
 * Stored slugs may still differ; matching and UI treat them as the same.
 */
const CONDUCT_FAMILY = new Set<string>([
  INTERCOM_CASE_TYPES.CONDUCT,
  INTERCOM_CASE_TYPES.MISCONDUCT
]);

export const normalizeCaseTypeForRelatedBucket = (caseType: string | null | undefined): string => {
  const normalized = caseType?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return '';
  }

  if (CONDUCT_FAMILY.has(normalized)) {
    return INTERCOM_CASE_TYPES.CONDUCT;
  }

  return normalized;
};

export const caseTypesMatchForRelated = (
  left: string | null | undefined,
  right: string | null | undefined
): boolean => {
  const leftBucket = normalizeCaseTypeForRelatedBucket(left);
  const rightBucket = normalizeCaseTypeForRelatedBucket(right);
  return Boolean(leftBucket) && leftBucket === rightBucket;
};

/** SQL / search: when looking up conduct or misconduct, include both slugs. */
export const expandCaseTypeSearchSlugs = (caseType: string | null | undefined): string[] => {
  const normalized = caseType?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return [];
  }

  if (CONDUCT_FAMILY.has(normalized)) {
    return [INTERCOM_CASE_TYPES.CONDUCT, INTERCOM_CASE_TYPES.MISCONDUCT];
  }

  return [normalized];
};

/** Sidebar label — conduct and misconduct both show as "Conduct". */
export const formatCaseTypeLabel = (caseType: string | null | undefined): string => {
  const normalized = caseType?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'General';
  }

  const displaySlug = CONDUCT_FAMILY.has(normalized)
    ? INTERCOM_CASE_TYPES.CONDUCT
    : normalized;

  return displaySlug
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/** Subject keywords → stored → general (no Gemini and no Intercom tags). */
export const inferCaseType = (
  subject: string | null | undefined,
  rawPayload: Record<string, unknown> | null | undefined,
  storedCaseType?: string | null
): string =>
  resolveCaseType({
    subject,
    rawPayload,
    storedCaseType
  });
