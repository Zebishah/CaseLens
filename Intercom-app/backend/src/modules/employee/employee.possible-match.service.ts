import { EMPLOYEE_MATCH_METHOD } from '../../constants/intelligence.constants.js';
import { INTERCOM_MATCH } from '../../constants/intercom.constants.js';
import { logger } from '../../config/logger.config.js';
import type { IntelligencePossibleSamePerson } from '../../types/intelligence.types.js';
import { scorePossibleSamePersonCandidate } from './employee.token-match.util.js';
import { employeeRepository } from './employee.repository.js';

export const possibleMatchService = {
  async findPossibleSamePerson(input: {
    contactName: string | null;
    contactEmail: string | null;
    excludeEmployeeIdentityId: number;
  }): Promise<IntelligencePossibleSamePerson[]> {
    const contactName = input.contactName?.trim();
    if (!contactName) {
      return [];
    }

    const candidates = await employeeRepository.findAllExcept(input.excludeEmployeeIdentityId);

    const matches: IntelligencePossibleSamePerson[] = [];

    for (const candidate of candidates) {
      const scored = scorePossibleSamePersonCandidate(
        contactName,
        candidate.canonicalName,
        input.contactEmail,
        candidate.email
      );

      if (!scored) {
        continue;
      }

      matches.push({
        employeeIdentityId: candidate.id,
        canonicalName: candidate.canonicalName,
        confidenceScore: scored.confidenceScore,
        matchMethod: EMPLOYEE_MATCH_METHOD.TOKEN,
        sharedTokens: scored.sharedTokens
      });
    }

    const results = matches
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, INTERCOM_MATCH.POSSIBLE_MATCH_LIMIT);

    logger.info('[possible-match] Token-based possible matches', {
      excludeEmployeeIdentityId: input.excludeEmployeeIdentityId,
      contactName: input.contactName,
      matchCount: results.length,
      topMatch: results[0] ?? null
    });

    return results;
  }
};
