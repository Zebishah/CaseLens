import type { IntelligenceRelatedCase } from '../../types/intelligence.types.js';

const GENERIC_TOPIC_TERMS = new Set([
  'case',
  'issue',
  'employee',
  'conversation',
  'request',
  'intercom',
  'general',
  'test'
]);

const normalizeTerm = (value: string): string => value.trim().toLowerCase();

const collectCaseText = (relatedCase: IntelligenceRelatedCase): string =>
  [
    relatedCase.subject,
    relatedCase.caseType,
    relatedCase.previewText,
    relatedCase.summaryText,
    ...(relatedCase.matchedEmployeeNames ?? [])
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .toLowerCase();

const sharedTopicTerms = (
  relatedCase: IntelligenceRelatedCase,
  topicTerms: string[]
): string[] => {
  const text = collectCaseText(relatedCase);
  const shared: string[] = [];

  for (const term of topicTerms) {
    const normalized = normalizeTerm(term);
    if (!normalized || GENERIC_TOPIC_TERMS.has(normalized) || normalized.length < 3) {
      continue;
    }
    if (text.includes(normalized) && !shared.includes(normalized)) {
      shared.push(normalized);
    }
  }

  return shared;
};

const isWithinDays = (isoDate: string, days: number): boolean => {
  const created = Date.parse(isoDate);
  if (!Number.isFinite(created)) {
    return false;
  }
  return Date.now() - created <= days * 24 * 60 * 60 * 1000;
};

export const rankRelatedCases = (input: {
  relatedCases: IntelligenceRelatedCase[];
  caseType?: string | null;
  topicTerms?: string[];
  currentStoreNumber?: string | null;
}): IntelligenceRelatedCase[] => {
  const currentType = input.caseType?.trim().toLowerCase() ?? '';
  const currentStore = input.currentStoreNumber?.trim() ?? '';
  const topicTerms = input.topicTerms ?? [];

  return input.relatedCases.map((relatedCase) => {
    const evidence: string[] = ['Same employee'];
    const sameCategory =
      Boolean(currentType) && relatedCase.caseType.trim().toLowerCase() === currentType;
    const topics = sharedTopicTerms(relatedCase, topicTerms);
    const sameStore =
      Boolean(currentStore) && relatedCase.reporterStoreNumber?.trim() === currentStore;
    const recent = isWithinDays(relatedCase.createdAt, 30);

    if (sameCategory) {
      evidence.push(`Same category: ${relatedCase.caseType}`);
    }
    if (topics.length > 0) {
      evidence.push(`Shared topic: ${topics.join(', ')}`);
    }
    if (sameStore) {
      evidence.push('Same store');
    }
    if (recent) {
      evidence.push('Reported within 30 days');
    }

    const closelyRelated = sameCategory || topics.length > 0;

    return {
      ...relatedCase,
      relationshipGroup: closelyRelated ? 'closely_related' : 'employee_history',
      relationshipEvidence: evidence
    };
  });
};
