import type { IntelligenceRelatedCase } from '../../types/intelligence.types.js';

export const DISMISS_RELATED_CASE_PREFIX = 'dismiss-related-';
export const DISMISS_CATEGORY_CASE_PREFIX = 'dismiss-category-';

export const buildDismissRelatedCaseComponentId = (relatedIntercomId: string): string =>
  `${DISMISS_RELATED_CASE_PREFIX}${relatedIntercomId}`;

export const buildDismissCategoryCaseComponentId = (categoryIntercomId: string): string =>
  `${DISMISS_CATEGORY_CASE_PREFIX}${categoryIntercomId}`;

export const parseDismissRelatedCaseComponentId = (
  componentId: string | undefined
): string | null => {
  if (!componentId?.startsWith(DISMISS_RELATED_CASE_PREFIX)) {
    return null;
  }

  const relatedIntercomId = componentId.slice(DISMISS_RELATED_CASE_PREFIX.length).trim();
  return relatedIntercomId.length > 0 ? relatedIntercomId : null;
};

export const parseDismissCategoryCaseComponentId = (
  componentId: string | undefined
): string | null => {
  if (!componentId?.startsWith(DISMISS_CATEGORY_CASE_PREFIX)) {
    return null;
  }

  const categoryIntercomId = componentId.slice(DISMISS_CATEGORY_CASE_PREFIX.length).trim();
  return categoryIntercomId.length > 0 ? categoryIntercomId : null;
};

const filterDismissedCases = (
  cases: IntelligenceRelatedCase[],
  dismissedIntercomIds: string[] | undefined
): IntelligenceRelatedCase[] => {
  if (!dismissedIntercomIds?.length) {
    return cases;
  }

  const dismissed = new Set(dismissedIntercomIds);
  return cases.filter((relatedCase) => !dismissed.has(relatedCase.intercomId));
};

export const filterDismissedRelatedCases = (
  relatedCases: IntelligenceRelatedCase[],
  dismissedIntercomIds: string[] | undefined
): IntelligenceRelatedCase[] => filterDismissedCases(relatedCases, dismissedIntercomIds);

export const filterDismissedCategoryCases = (
  categoryCases: IntelligenceRelatedCase[],
  dismissedIntercomIds: string[] | undefined
): IntelligenceRelatedCase[] => filterDismissedCases(categoryCases, dismissedIntercomIds);

const addDismissedCaseIntercomId = (
  dismissedIntercomIds: string[] | undefined,
  intercomId: string
): string[] => [...new Set([...(dismissedIntercomIds ?? []), intercomId])];

export const addDismissedRelatedCaseIntercomId = (
  dismissedIntercomIds: string[] | undefined,
  relatedIntercomId: string
): string[] => addDismissedCaseIntercomId(dismissedIntercomIds, relatedIntercomId);

export const addDismissedCategoryCaseIntercomId = (
  dismissedIntercomIds: string[] | undefined,
  categoryIntercomId: string
): string[] => addDismissedCaseIntercomId(dismissedIntercomIds, categoryIntercomId);
