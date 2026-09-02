import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import type { IntelligenceEmployeeMatch } from '../../types/intelligence.types.js';

export const dedupeMatchesByIdentity = (
  matches: IntelligenceEmployeeMatch[]
): IntelligenceEmployeeMatch[] => {
  const bestByIdentity = new Map<number, IntelligenceEmployeeMatch>();

  for (const match of matches) {
    const existing = bestByIdentity.get(match.employeeIdentityId);
    if (!existing || match.confidenceScore > existing.confidenceScore) {
      bestByIdentity.set(match.employeeIdentityId, match);
    }
  }

  return [...bestByIdentity.values()].sort((a, b) => b.confidenceScore - a.confidenceScore);
};

export const filterMatchesAboveThreshold = (
  matches: IntelligenceEmployeeMatch[],
  threshold: number = INTERCOM_MATCH.CONFIDENCE_THRESHOLD
): IntelligenceEmployeeMatch[] =>
  matches.filter((match) => match.confidenceScore >= threshold);

export const similarityToConfidence = (similarity: number): number =>
  Math.min(99, Math.round(similarity * 100));
