/** Free / personal email providers — compare full address, not domain alone. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.ca',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'hey.com'
]);

/** ISP / mailbox hosts — also compare full address (different users share the domain). */
const CONSUMER_ISP_DOMAINS = new Set([
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'charter.net',
  'cox.net',
  'btinternet.com',
  'virginmedia.com',
  'sky.com',
  'rogers.com',
  'shaw.ca',
  'telus.net'
]);

export type ReporterEmailGateMode = 'skip' | 'domain' | 'full';

export type IdentityReporterEmailHistory = {
  businessDomains: string[];
  publicEmails: string[];
};

export const normalizeEmailAddress = (email: string | null | undefined): string | null => {
  if (!email?.trim()) {
    return null;
  }

  return email.trim().toLowerCase();
};

export const normalizeEmailDomain = (domain: string): string =>
  domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');

export const extractEmailDomain = (email: string | null | undefined): string | null => {
  if (!email?.trim()) {
    return null;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0 || atIndex === email.length - 1) {
    return null;
  }

  const domain = normalizeEmailDomain(email.slice(atIndex + 1));
  return domain.length > 0 ? domain : null;
};

export const isConsumerEmailDomain = (domain: string | null | undefined): boolean => {
  if (!domain?.trim()) {
    return false;
  }

  return CONSUMER_EMAIL_DOMAINS.has(normalizeEmailDomain(domain));
};

export const isConsumerIspDomain = (domain: string | null | undefined): boolean => {
  if (!domain?.trim()) {
    return false;
  }

  return CONSUMER_ISP_DOMAINS.has(normalizeEmailDomain(domain));
};

/** @deprecated Use getReporterEmailGateMode — kept for existing call sites in tests. */
export const isPublicEmailDomain = (domain: string | null | undefined): boolean =>
  isConsumerEmailDomain(domain);

/** Organizational / work email — compare reporter domain only. */
export const isOrganizationalEmailDomain = (domain: string | null | undefined): boolean => {
  if (!domain?.trim()) {
    return false;
  }

  const normalized = normalizeEmailDomain(domain);
  if (isConsumerEmailDomain(normalized) || isConsumerIspDomain(normalized)) {
    return false;
  }

  if (/\.(edu|gov|mil)(\.[a-z]{2,})?$/i.test(normalized)) {
    return true;
  }

  if (!/\.(com|org|net|co|io|uk|us|biz|info)$/i.test(normalized)) {
    return false;
  }

  const labels = normalized.split('.');
  if (labels.length < 2) {
    return false;
  }

  const registeredDomain = labels[labels.length - 2] ?? '';
  if (/mail|isp|internet|telecom|broadband|wireless|mailbox/i.test(registeredDomain)) {
    return false;
  }

  return true;
};

/** @deprecated Use isOrganizationalEmailDomain */
export const isBusinessEmailDomain = (domain: string | null | undefined): boolean =>
  isOrganizationalEmailDomain(domain);

/** @deprecated Use getReporterEmailGateMode */
export const isPublicInboxEmail = (email: string | null | undefined): boolean =>
  getReporterEmailGateMode(email) === 'full';

/**
 * How to compare reporter email for the employee gate.
 * - skip: no reporter email — caller keeps existing matching
 * - domain: work / org email — compare company domain
 * - full: Gmail, Yahoo, ISP, unknown — compare whole address
 */
export const getReporterEmailGateMode = (
  email: string | null | undefined
): ReporterEmailGateMode => {
  if (!email?.trim()) {
    return 'skip';
  }

  const domain = extractEmailDomain(email);
  if (!domain) {
    return 'skip';
  }

  if (isConsumerEmailDomain(domain) || isConsumerIspDomain(domain)) {
    return 'full';
  }

  if (isOrganizationalEmailDomain(domain)) {
    return 'domain';
  }

  return 'full';
};

export const isIdentityAllowedForCaseDomain = (
  knownDomains: readonly string[],
  caseDomain: string
): boolean => {
  if (knownDomains.length === 0) {
    return true;
  }

  const normalizedCaseDomain = normalizeEmailDomain(caseDomain);
  return knownDomains.some((domain) => normalizeEmailDomain(domain) === normalizedCaseDomain);
};

export const isIdentityAllowedForCaseFullEmail = (
  knownFullEmails: readonly string[],
  caseEmail: string
): boolean => {
  if (knownFullEmails.length === 0) {
    return true;
  }

  const normalizedCaseEmail = normalizeEmailAddress(caseEmail);
  if (!normalizedCaseEmail) {
    return true;
  }

  return knownFullEmails.some(
    (email) => normalizeEmailAddress(email) === normalizedCaseEmail
  );
};

/** @deprecated Use isIdentityAllowedForCaseFullEmail */
export const isIdentityAllowedForCasePublicEmail = isIdentityAllowedForCaseFullEmail;

export const collectReporterEmailHistoryFromEmails = (
  emails: Array<string | null | undefined>
): IdentityReporterEmailHistory => {
  const businessDomains = new Set<string>();
  const publicEmails = new Set<string>();

  for (const email of emails) {
    const mode = getReporterEmailGateMode(email);
    if (mode === 'skip') {
      continue;
    }

    if (mode === 'domain') {
      const domain = extractEmailDomain(email);
      if (domain) {
        businessDomains.add(domain);
      }
      continue;
    }

    const normalized = normalizeEmailAddress(email);
    if (normalized) {
      publicEmails.add(normalized);
    }
  }

  return {
    businessDomains: [...businessDomains],
    publicEmails: [...publicEmails]
  };
};

/** @deprecated Use collectReporterEmailHistoryFromEmails */
export const collectDomainsFromEmails = (
  emails: Array<string | null | undefined>
): string[] => collectReporterEmailHistoryFromEmails(emails).businessDomains;

/** @deprecated Use collectReporterEmailHistoryFromEmails */
export const collectPublicEmailsFromAddresses = (
  emails: Array<string | null | undefined>
): string[] => collectReporterEmailHistoryFromEmails(emails).publicEmails;
