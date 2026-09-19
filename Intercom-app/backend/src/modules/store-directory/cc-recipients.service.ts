import type { StoreDirectoryCompanySlug } from '../../constants/store-directory.constants.js';
import { logger } from '../../config/logger.config.js';
import { normalizeStoreNumber } from './store-directory.parser.js';
import {
  storeDirectoryRepository,
  type StoreDirectoryLookupRow
} from './store-directory.repository.js';
import {
  extractEmailDomain,
  isOrganizationalEmailDomain
} from '../employee/employee.email-domain.util.js';
import {
  ccRecipientsCacheKey,
  CC_RECIPIENT_CACHE_TTL_SECONDS,
  CC_RECIPIENT_NEGATIVE_CACHE_TTL_SECONDS,
  readDirectoryCache,
  writeDirectoryCache
} from './store-directory.cache.js';

export type CcRecipient = {
  name: string;
  email: string;
  role: string;
  source: 'fixed' | 'store';
};

export type CcRecipientsResult =
  | {
      status: 'no_store';
      storeNumber: null;
      companyName: null;
      recipients: [];
      message: string;
    }
  | {
      status: 'not_found';
      storeNumber: string;
      companyName: null;
      recipients: [];
      message: string;
    }
  | {
      status: 'ambiguous';
      storeNumber: string;
      companyName: null;
      recipients: [];
      message: string;
    }
  | {
      status: 'ok';
      storeNumber: string;
      companyName: string;
      recipients: CcRecipient[];
      message: null;
    }
  | {
      status: 'unavailable';
      storeNumber: string | null;
      companyName: null;
      recipients: [];
      message: string;
    };

const NO_STORE_MESSAGE = 'No store number — enter a store number to load CC recipients.';
const NOT_FOUND_MESSAGE = (storeNumber: string) =>
  `No store found for number ${storeNumber}. Check the store number and try again.`;
const AMBIGUOUS_MESSAGE = (storeNumber: string) =>
  `Multiple companies found for store ${storeNumber} — cannot choose CC recipients`;
const UNAVAILABLE_MESSAGE = 'CC recipient directory is unavailable right now';

const pushUnique = (list: CcRecipient[], recipient: CcRecipient): void => {
  const email = recipient.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return;
  }

  if (list.some((item) => item.email.toLowerCase() === email)) {
    return;
  }

  list.push({
    name: recipient.name.trim() || email,
    email: recipient.email.trim(),
    role: recipient.role,
    source: recipient.source
  });
};

const buildStoreRecipients = (store: StoreDirectoryLookupRow): CcRecipient[] => {
  const slug = store.companySlug as StoreDirectoryCompanySlug;
  const recipients: CcRecipient[] = [];

  if (slug === 'northwind-bakery') {
    if (store.vpName || store.vpEmail) {
      pushUnique(recipients, {
        name: store.vpName ?? '',
        email: store.vpEmail ?? '',
        role: 'VP of Ops',
        source: 'store'
      });
    }
    if (store.directorName || store.directorEmail) {
      pushUnique(recipients, {
        name: store.directorName ?? '',
        email: store.directorEmail ?? '',
        role: 'Director',
        source: 'store'
      });
    }
    if (store.districtManagerName || store.districtManagerEmail) {
      pushUnique(recipients, {
        name: store.districtManagerName ?? '',
        email: store.districtManagerEmail ?? '',
        role: 'District Manager',
        source: 'store'
      });
    }
    return recipients;
  }

  if (slug === 'helix-hospitality') {
    if (store.districtManagerName || store.districtManagerEmail) {
      pushUnique(recipients, {
        name: store.districtManagerName ?? '',
        email: store.districtManagerEmail ?? '',
        role: 'District Manager',
        source: 'store'
      });
    }
    return recipients;
  }

  if (slug === 'meridian-holdings') {
    if (store.ownerName || store.ownerEmail) {
      pushUnique(recipients, {
        name: store.ownerName ?? '',
        email: store.ownerEmail ?? '',
        role: 'Owner (District Manager)',
        source: 'store'
      });
    }
  }

  return recipients;
};

export const buildCcRecipientsForStore = async (
  store: StoreDirectoryLookupRow
): Promise<CcRecipient[]> => {
  const recipients: CcRecipient[] = [];
  const fixed = await storeDirectoryRepository.findFixedContacts(store.companyId);

  for (const contact of fixed) {
    pushUnique(recipients, {
      name: contact.name,
      email: contact.email,
      role: contact.role ?? 'Fixed contact',
      source: 'fixed'
    });
  }

  for (const storeRecipient of buildStoreRecipients(store)) {
    pushUnique(recipients, storeRecipient);
  }

  return recipients;
};

type CcCandidate = { store: StoreDirectoryLookupRow; recipients: CcRecipient[] };
type CcCandidateCache = { matches: CcCandidate[] };

const isCcCandidateCache = (value: unknown): value is CcCandidateCache => {
  if (!value || typeof value !== 'object' || !('matches' in value) || !Array.isArray(value.matches)) {
    return false;
  }
  const nullableString = (item: unknown) => item === null || typeof item === 'string';
  return value.matches.every((candidate) => {
    if (!candidate || typeof candidate !== 'object' || !('store' in candidate) || !('recipients' in candidate)) {
      return false;
    }
    const { store, recipients } = candidate;
    if (!store || typeof store !== 'object' || !Array.isArray(recipients)) return false;
    const row = store as Record<string, unknown>;
    const validStore =
      typeof row.companyId === 'number' &&
      typeof row.companySlug === 'string' &&
      typeof row.companyName === 'string' &&
      typeof row.storeNumber === 'string' &&
      nullableString(row.storeName) &&
      nullableString(row.vpName) &&
      nullableString(row.vpEmail) &&
      nullableString(row.directorName) &&
      nullableString(row.directorEmail) &&
      nullableString(row.districtManagerName) &&
      nullableString(row.districtManagerEmail) &&
      nullableString(row.ownerName) &&
      nullableString(row.ownerEmail);
    const validRecipients = recipients.every((recipient) => {
      if (!recipient || typeof recipient !== 'object') return false;
      const item = recipient as Record<string, unknown>;
      return (
        typeof item.name === 'string' &&
        typeof item.email === 'string' &&
        typeof item.role === 'string' &&
        (item.source === 'fixed' || item.source === 'store')
      );
    });
    return validStore && validRecipients;
  });
};

const getCcCandidates = async (storeNumber: string): Promise<CcCandidate[]> => {
  const cacheKey = ccRecipientsCacheKey(storeNumber);
  const cached = await readDirectoryCache(cacheKey, isCcCandidateCache);
  if (cached.value !== null) return cached.value.matches;

  const stores = await storeDirectoryRepository.findStoresByNumber(storeNumber);
  const matches = await Promise.all(
    stores.map(async (store) => ({
      store,
      recipients: await buildCcRecipientsForStore(store)
    }))
  );
  await writeDirectoryCache(
    cacheKey,
    cached.version,
    { matches },
    matches.length > 0
      ? CC_RECIPIENT_CACHE_TTL_SECONDS
      : CC_RECIPIENT_NEGATIVE_CACHE_TTL_SECONDS
  );
  return matches;
};

export const resolveCcRecipientsForStoreNumber = async (
  storeNumber: string | null | undefined,
  senderEmail?: string | null
): Promise<CcRecipientsResult> => {
  const normalized = normalizeStoreNumber(storeNumber ?? null);
  if (!normalized) {
    return {
      status: 'no_store',
      storeNumber: null,
      companyName: null,
      recipients: [],
      message: NO_STORE_MESSAGE
    };
  }

  try {
    const candidates = await getCcCandidates(normalized);
    const matches = candidates.map(({ store }) => store);
    if (matches.length === 0) {
      return {
        status: 'not_found',
        storeNumber: normalized,
        companyName: null,
        recipients: [],
        message: NOT_FOUND_MESSAGE(normalized)
      };
    }

    if (matches.length === 1) {
      const { store, recipients } = candidates[0]!;

      return {
        status: 'ok',
        storeNumber: normalized,
        companyName: store.companyName,
        recipients,
        message: null
      };
    }

    const senderDomain = extractEmailDomain(senderEmail);
    const domainMatches =
      senderDomain && isOrganizationalEmailDomain(senderDomain)
        ? candidates.filter(({ recipients }) =>
            recipients.some((recipient) => {
              const recipientDomain = extractEmailDomain(recipient.email);
              return (
                recipientDomain === senderDomain &&
                isOrganizationalEmailDomain(recipientDomain)
              );
            })
          )
        : [];

    if (domainMatches.length === 1) {
      const selected = domainMatches[0]!;
      return {
        status: 'ok',
        storeNumber: normalized,
        companyName: selected.store.companyName,
        recipients: selected.recipients,
        message: null
      };
    }

    logger.warn('[cc-recipients] Duplicate store could not be resolved by sender domain', {
      storeNumber: normalized,
      senderDomain,
      candidateCompanies: matches.map((match) => match.companyName),
      matchedCompanies: domainMatches.map(({ store }) => store.companyName)
    });

    return {
      status: 'ambiguous',
      storeNumber: normalized,
      companyName: null,
      recipients: [],
      message: AMBIGUOUS_MESSAGE(normalized)
    };
  } catch (error) {
    logger.warn('[cc-recipients] Lookup failed', {
      storeNumber: normalized,
      message: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 'unavailable',
      storeNumber: normalized,
      companyName: null,
      recipients: [],
      message: UNAVAILABLE_MESSAGE
    };
  }
};

export const ccRecipientsService = {
  resolveForStoreNumber: resolveCcRecipientsForStoreNumber
};
