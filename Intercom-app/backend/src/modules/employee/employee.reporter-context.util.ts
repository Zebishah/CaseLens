import { extractEmailDomain, normalizeEmailDomain } from './employee.email-domain.util.js';

export type ReporterContext = {
  storeNumber: string | null;
  domain: string | null;
};

const EMAIL_TOKEN_PATTERN = /\S+@\S+\.\S+/;

const isNumericStoreNumber = (value: string | null | undefined): boolean => {
  if (!value?.trim()) {
    return false;
  }

  return /^\d+$/.test(value.trim());
};

/** Long alphabetic prefix + trailing digits only — personal email, not a store inbox (e.g. zebihaider123). */
const looksLikePersonalEmailLocalPart = (localPart: string): boolean =>
  /^[a-z]{5,}\d+$/i.test(localPart.trim());

/**
 * Store directories use numeric store ids. From inbox locals like 895@…, 4280jjstore@…,
 * or jjkr453895@…, extract digits only — never return letter prefixes/suffixes as the store id.
 */
const extractDigitsOnlyStoreFromLocalPart = (localPart: string): string | null => {
  const trimmed = localPart.trim();
  if (!trimmed) {
    return null;
  }

  if (isNumericStoreNumber(trimmed)) {
    return trimmed;
  }

  if (looksLikePersonalEmailLocalPart(trimmed)) {
    return null;
  }

  const leadingDigits = trimmed.match(/^(\d+)[a-zA-Z]/);
  if (leadingDigits?.[1]) {
    return leadingDigits[1];
  }

  const trailingDigits = trimmed.match(/^[a-zA-Z]+(\d+)$/);
  if (trailingDigits?.[1]) {
    return trailingDigits[1];
  }

  return null;
};

const extractStoreFromEmailLikeValue = (value: string | null | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const emailToken = value.match(EMAIL_TOKEN_PATTERN)?.[0] ?? value.trim();
  const atIndex = emailToken.lastIndexOf('@');
  if (atIndex < 1) {
    return null;
  }

  const localPart = emailToken.slice(0, atIndex).trim();
  return extractDigitsOnlyStoreFromLocalPart(localPart);
};

/** Standalone numeric token in reporter display name only (not email addresses). */
const extractStandaloneStoreFromReporterName = (reporterName: string | null | undefined): string | null => {
  if (!reporterName?.trim() || reporterName.includes('@')) {
    return null;
  }

  const standalone = reporterName.match(/\b(\d+)\b/);
  return standalone?.[1] && isNumericStoreNumber(standalone[1]) ? standalone[1] : null;
};

/** Company label from domain — demoops.co → demoops. */
const extractDomainStem = (domain: string | null | undefined): string | null => {
  if (!domain?.trim()) {
    return null;
  }

  const normalized = normalizeEmailDomain(domain);
  const stem = normalized.split('.')[0]?.trim();
  return stem && stem.length >= 3 ? stem : null;
};

const suffixMatchesDomainStem = (suffix: string, domainStem: string | null): boolean => {
  const normalizedSuffix = suffix.trim().toLowerCase();
  if (!normalizedSuffix || !/^[a-z]{4,}$/.test(normalizedSuffix)) {
    return false;
  }

  if (!domainStem) {
    return true;
  }

  return normalizedSuffix === domainStem.trim().toLowerCase();
};

/**
 * Glued Intercom display names: 10206demoops, dd1976demoops (store + company suffix).
 * Requires the suffix to match the reporter email domain stem when domain is known.
 */
const extractGluedStoreFromReporterDisplayName = (
  reporterName: string | null | undefined,
  emailDomain: string | null | undefined
): string | null => {
  if (!reporterName?.trim() || reporterName.includes('@')) {
    return null;
  }

  const trimmed = reporterName.trim();
  const domainStem = extractDomainStem(emailDomain);

  if (domainStem) {
    const normalizedStem = domainStem.toLowerCase();
    if (trimmed.toLowerCase().endsWith(normalizedStem) && trimmed.length > normalizedStem.length) {
      const storeCandidate = trimmed.slice(0, trimmed.length - normalizedStem.length);
      const storeNumber =
        extractDigitsOnlyStoreFromLocalPart(storeCandidate) ??
        (isNumericStoreNumber(storeCandidate) ? storeCandidate : null);
      if (storeNumber) {
        return storeNumber;
      }
    }
  }

  const numericGlued = trimmed.match(/^(\d+)([a-z]{4,})$/i);
  if (numericGlued) {
    const [, storeCandidate, suffix] = numericGlued;
    if (storeCandidate && suffixMatchesDomainStem(suffix, domainStem)) {
      return storeCandidate;
    }
  }

  return null;
};

const extractDomainFromEmailLikeValue = (value: string | null | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const emailToken = value.match(EMAIL_TOKEN_PATTERN)?.[0];
  return emailToken ? extractEmailDomain(emailToken) : null;
};

/** Parse store number and company domain from reporter name and email. Store number is preferred when present. */
export const parseReporterContext = (
  reporterName: string | null | undefined,
  reporterEmail: string | null | undefined
): ReporterContext => {
  const domain =
    extractEmailDomain(reporterEmail) ??
    extractDomainFromEmailLikeValue(reporterName) ??
    extractDomainFromEmailLikeValue(reporterEmail);

  const normalizedDomain = domain ? normalizeEmailDomain(domain) : null;

  const storeNumber =
    extractStoreFromEmailLikeValue(reporterEmail) ??
    extractStoreFromEmailLikeValue(reporterName) ??
    extractGluedStoreFromReporterDisplayName(reporterName, normalizedDomain) ??
    extractStandaloneStoreFromReporterName(reporterName);

  return {
    storeNumber,
    domain: normalizedDomain
  };
};

/**
 * Prefer an email that yields a store number — Intercom source.author may differ from the
 * contact inbox (e.g. author is a generic address while contact is 78@northwind.co).
 */
export const resolveReporterContext = (
  reporterName: string | null | undefined,
  reporterEmail: string | null | undefined,
  alternateEmails: string[] = []
): ReporterContext => {
  const primary = parseReporterContext(reporterName, reporterEmail);
  if (primary.storeNumber) {
    return primary;
  }

  const seen = new Set<string>();
  for (const email of [reporterEmail, ...alternateEmails]) {
    const trimmed = email?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const candidate = parseReporterContext(reporterName, trimmed);
    if (candidate.storeNumber) {
      return {
        storeNumber: candidate.storeNumber,
        domain: candidate.domain ?? primary.domain
      };
    }
  }

  return primary;
};
