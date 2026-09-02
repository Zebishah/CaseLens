import { RELATED_CASE_MAX_AGE_MONTHS } from '../../constants/intelligence.constants.js';

export const getRelatedCaseCreatedAfterDate = (
  now: Date = new Date(),
  maxAgeMonths = RELATED_CASE_MAX_AGE_MONTHS
): Date => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - maxAgeMonths);
  return cutoff;
};
