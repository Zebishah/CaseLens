import { logger } from '../../config/logger.config.js';
import type { IntelligenceEmployeeMatch } from '../../types/intelligence.types.js';
import type { IdentityReporterEmailHistory } from './employee.email-domain.util.js';
import {
  extractEmailDomain,
  getReporterEmailGateMode,
  isIdentityAllowedForCaseDomain,
  isIdentityAllowedForCaseFullEmail,
  normalizeEmailAddress
} from './employee.email-domain.util.js';

const EMPTY_REPORTER_EMAIL_HISTORY: IdentityReporterEmailHistory = {
  businessDomains: [],
  publicEmails: []
};

export const filterMatchesByReporterDomain = (
  matches: IntelligenceEmployeeMatch[],
  caseReporterEmail: string | null | undefined,
  historyByIdentityId: ReadonlyMap<number, IdentityReporterEmailHistory>
): IntelligenceEmployeeMatch[] => {
  const gateMode = getReporterEmailGateMode(caseReporterEmail);
  if (gateMode === 'skip' || matches.length === 0) {
    return matches;
  }

  const caseDomain = extractEmailDomain(caseReporterEmail);
  const normalizedCaseEmail = normalizeEmailAddress(caseReporterEmail);

  return matches.filter((match) => {
    const history =
      historyByIdentityId.get(match.employeeIdentityId) ?? EMPTY_REPORTER_EMAIL_HISTORY;

    const allowed =
      gateMode === 'domain' && caseDomain
        ? isIdentityAllowedForCaseDomain(history.businessDomains, caseDomain)
        : isIdentityAllowedForCaseFullEmail(history.publicEmails, caseReporterEmail!);

    if (!allowed) {
      logger.info('[employee-matching] Reporter email gate rejected candidate', {
        employeeIdentityId: match.employeeIdentityId,
        canonicalName: match.canonicalName,
        gateMode,
        caseReporterEmail: normalizedCaseEmail,
        caseDomain,
        knownBusinessDomains: history.businessDomains,
        knownFullEmails: history.publicEmails
      });
    }

    return allowed;
  });
};
