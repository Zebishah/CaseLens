export type EmployeeMentionValidation =
  | {
      valid: true;
      normalizedName: string;
      evidence: string;
    }
  | {
      valid: false;
      reason:
        | 'missing'
        | 'not_in_subject'
        | 'generic_phrase'
        | 'invalid_characters'
        | 'ambiguous'
        | 'not_human_name'
        | 'too_short'
        | 'single_token'
        | 'ordinary_sentence';
    };

const PLATFORM_TOKENS = new Set([
  'intercom',
  'slack',
  'gmail',
  'outlook',
  'box',
  'gemini',
  'messenger'
]);

const GENERIC_TOKENS = new Set([
  'a',
  'an',
  'and',
  'are',
  'by',
  'faced',
  'first',
  'second',
  'third',
  'new',
  'latest',
  'test',
  'testing',
  'the',
  'this',
  'that',
  'these',
  'those',
  'is',
  'was',
  'were',
  'having',
  'conversation',
  'conversations',
  'webhook',
  'webhooks',
  'hr',
  'intelligence',
  'employee',
  'employees',
  'case',
  'cases',
  'general',
  'store',
  'location',
  'manager',
  'department',
  'support',
  'done',
  'wrong',
  'work',
  'issue',
  'issues',
  'request',
  'requests',
  'complaint',
  'complaints',
  'payroll',
  'attendance',
  'leave',
  'concern',
  'concerns',
  'subject',
  'message',
  'ticket',
  'inbox',
  'app',
  'application',
  'provider',
  'team',
  'teams',
  'company',
  'workspace'
]);

const BLOCKED_PHRASES = new Set([
  'done wrong',
  'work done',
  'first intercom',
  'intercom test',
  'test conversation',
  'hr intelligence',
  'payroll issue',
  'store manager',
  'general case',
  'employee case',
  'support request'
]);

const MIN_LETTER_COUNT = 3;

const normalizeEvidence = (value: string): string =>
  value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const splitTokens = (value: string): string[] =>
  normalizeEvidence(value)
    .split(/[^\p{L}0-9']+/u)
    .filter(Boolean);

const countUnicodeLetters = (value: string): number =>
  [...value.normalize('NFKC')].filter((character) => /\p{L}/u.test(character)).length;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isGenericOrPlatformToken = (token: string): boolean =>
  GENERIC_TOKENS.has(token) || PLATFORM_TOKENS.has(token);

/**
 * Reject persisted/generated labels that are clearly not human names before
 * they can be reused as fuzzy "possible same person" candidates.
 * This deliberately does not impose the subject parser's two-word limit.
 */
export const isClearlyNonPersonEmployeeName = (
  value: string | null | undefined
): boolean => {
  const normalized = normalizeEvidence(value ?? '');
  if (!normalized || /@|:\/\/|\d/.test(normalized)) {
    return true;
  }

  const tokens = splitTokens(normalized);
  return (
    tokens.length === 0 ||
    BLOCKED_PHRASES.has(normalized) ||
    tokens.every(isGenericOrPlatformToken)
  );
};

export const hasExplicitOneWordEmployeeConstruction = (
  subject: string,
  name: string
): boolean => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return false;
  }

  const namePattern = escapeRegExp(trimmedName);
  const patterns = [
    new RegExp(`\\bemployee\\s*:\\s*${namePattern}\\b`, 'iu'),
    new RegExp(`\\bcase\\s+regarding\\s+${namePattern}\\b`, 'iu'),
    new RegExp(`\\b(?:for|regarding|concerning|involving)\\s+${namePattern}\\b`, 'iu')
  ];

  return patterns.some((pattern) => pattern.test(subject));
};

export const validateEmployeeMention = (input: {
  subject: string | null | undefined;
  name: string | null | undefined;
  evidence: string | null | undefined;
  reporterName?: string | null;
  source?: 'gemini' | 'subject';
}): EmployeeMentionValidation => {
  const name = input.name?.trim() ?? '';
  const evidence = input.evidence?.trim() ?? '';
  const subject = input.subject?.trim() ?? '';

  if (!name || !evidence || !subject) {
    return { valid: false, reason: 'missing' };
  }

  const nameNorm = normalizeEvidence(name);
  const evidenceNorm = normalizeEvidence(evidence);
  const subjectNorm = normalizeEvidence(subject);

  if (nameNorm !== evidenceNorm) {
    return { valid: false, reason: 'not_in_subject' };
  }

  if (!subjectNorm.includes(evidenceNorm)) {
    return { valid: false, reason: 'not_in_subject' };
  }

  if (/@|:\/\/|\d/.test(name) || !/^[\p{L}\s'.-]+$/u.test(name)) {
    return { valid: false, reason: 'invalid_characters' };
  }

  const tokens = splitTokens(name);
  if (tokens.length === 0) {
    return { valid: false, reason: 'missing' };
  }

  const letterCount = countUnicodeLetters(name);
  const explicitConstruction = hasExplicitOneWordEmployeeConstruction(subject, name);

  if (letterCount < MIN_LETTER_COUNT && !explicitConstruction) {
    return { valid: false, reason: 'too_short' };
  }

  if (BLOCKED_PHRASES.has(nameNorm) || tokens.every(isGenericOrPlatformToken)) {
    return { valid: false, reason: 'generic_phrase' };
  }

  if (tokens.some((token) => PLATFORM_TOKENS.has(token) || GENERIC_TOKENS.has(token))) {
    return { valid: false, reason: 'not_human_name' };
  }

  const reporterNorm = input.reporterName ? normalizeEvidence(input.reporterName) : '';
  if (reporterNorm && nameNorm === reporterNorm && !subjectNorm.includes(nameNorm)) {
    return { valid: false, reason: 'not_in_subject' };
  }

  return {
    valid: true,
    normalizedName: name.replace(/\s+/g, ' ').trim(),
    evidence: evidence.replace(/\s+/g, ' ').trim()
  };
};

export const subjectHasNoPersonToken = (subject: string | null | undefined): boolean => {
  const tokens = splitTokens(subject ?? '');
  if (tokens.length === 0) {
    return true;
  }
  return tokens.every(isGenericOrPlatformToken);
};

export const retainExtractedNameAfterResolution = (
  name: string,
  mentionStatus?: 'resolved' | 'unresolved' | 'ambiguous' | 'no_employee_mentioned' | null
): boolean => {
  if (mentionStatus === 'resolved') {
    return true;
  }

  if (mentionStatus === 'no_employee_mentioned') {
    return false;
  }

  return countUnicodeLetters(name) >= MIN_LETTER_COUNT;
};
