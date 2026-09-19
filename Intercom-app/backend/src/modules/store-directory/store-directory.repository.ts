import { asc, eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { companies } from '../../database/schema/companies.js';
import { companyFixedContacts } from '../../database/schema/company_fixed_contacts.js';
import { storeDirectory } from '../../database/schema/store_directory.js';
import { storeDirectorySyncRuns } from '../../database/schema/store_directory_sync_runs.js';
import { STORE_DIRECTORY_COMPANIES } from '../../constants/store-directory.constants.js';
import {
  invalidateStoreDirectoryCaches,
  readDirectoryCache,
  STORE_DIRECTORY_CACHE_TTL_SECONDS,
  STORE_DIRECTORY_NEGATIVE_CACHE_TTL_SECONDS,
  storeLookupCacheKey,
  writeDirectoryCache
} from './store-directory.cache.js';
import type { ParsedFixedContact, ParsedStoreRow } from './store-directory.parser.js';
import { normalizeStoreNumber } from './store-directory.parser.js';

export type StoreDirectoryLookupRow = {
  companyId: number;
  companySlug: string;
  companyName: string;
  storeNumber: string;
  storeName: string | null;
  vpName: string | null;
  vpEmail: string | null;
  directorName: string | null;
  directorEmail: string | null;
  districtManagerName: string | null;
  districtManagerEmail: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type FixedContactLookupRow = {
  name: string;
  email: string;
  role: string | null;
  sortOrder: number;
};

const replaceDirectoryData = async (
  stores: ParsedStoreRow[],
  fixedContacts: ParsedFixedContact[] = []
): Promise<number> => {
  const fixedContactsBySlug = new Map<string, ParsedFixedContact[]>();
  for (const contact of fixedContacts) {
    const existing = fixedContactsBySlug.get(contact.companySlug) ?? [];
    existing.push(contact);
    fixedContactsBySlug.set(contact.companySlug, existing);
  }

  await db.transaction(async (tx) => {
    await tx.delete(storeDirectory);
    await tx.delete(companyFixedContacts);

    const companyIdBySlug = new Map<string, number>();

    for (const company of STORE_DIRECTORY_COMPANIES) {
      const existingRows = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, company.slug))
        .limit(1);
      const existing = existingRows[0];

      let companyId: number;
      if (existing) {
        const [updated] = await tx
          .update(companies)
          .set({
            name: company.name,
            sheetName: company.sheetName,
            updatedAt: new Date()
          })
          .where(eq(companies.id, existing.id))
          .returning({ id: companies.id });
        companyId = updated.id;
      } else {
        const [inserted] = await tx
          .insert(companies)
          .values({
            slug: company.slug,
            name: company.name,
            sheetName: company.sheetName
          })
          .returning({ id: companies.id });
        companyId = inserted.id;
      }

      companyIdBySlug.set(company.slug, companyId);

      const companyFixedContactsFromExcel = fixedContactsBySlug.get(company.slug) ?? [];
      if (companyFixedContactsFromExcel.length > 0) {
        await tx.insert(companyFixedContacts).values(
          companyFixedContactsFromExcel.map((contact, index) => ({
            companyId,
            name: contact.name,
            email: contact.email,
            role: contact.role,
            sortOrder: index
          }))
        );
      }
    }

    if (stores.length === 0) {
      return;
    }

    await tx.insert(storeDirectory).values(
      stores.map((store) => ({
        companyId: companyIdBySlug.get(store.companySlug)!,
        storeNumber: store.storeNumber,
        storeName: store.storeName,
        vpName: store.vpName,
        vpEmail: store.vpEmail,
        directorName: store.directorName,
        directorEmail: store.directorEmail,
        districtManagerName: store.districtManagerName,
        districtManagerEmail: store.districtManagerEmail,
        ownerName: store.ownerName,
        ownerEmail: store.ownerEmail,
        rawRow: store.rawRow
      }))
    );
  });

  // The transaction has committed; advance the cache generation only now.
  await invalidateStoreDirectoryCaches();
  return stores.length;
};

const isStoreDirectoryLookupRows = (value: unknown): value is StoreDirectoryLookupRow[] => {
  if (!Array.isArray(value)) return false;
  const nullableString = (item: unknown) => item === null || typeof item === 'string';
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return (
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
      nullableString(row.ownerEmail)
    );
  });
};

const findStoresByNumber = async (storeNumber: string): Promise<StoreDirectoryLookupRow[]> => {
  const normalized = normalizeStoreNumber(storeNumber);
  if (!normalized) {
    return [];
  }

  const cacheKey = storeLookupCacheKey(normalized);
  const cached = await readDirectoryCache(cacheKey, isStoreDirectoryLookupRows);
  if (cached.value !== null) return cached.value;

  const rows = await db
    .select({
      companyId: companies.id,
      companySlug: companies.slug,
      companyName: companies.name,
      storeNumber: storeDirectory.storeNumber,
      storeName: storeDirectory.storeName,
      vpName: storeDirectory.vpName,
      vpEmail: storeDirectory.vpEmail,
      directorName: storeDirectory.directorName,
      directorEmail: storeDirectory.directorEmail,
      districtManagerName: storeDirectory.districtManagerName,
      districtManagerEmail: storeDirectory.districtManagerEmail,
      ownerName: storeDirectory.ownerName,
      ownerEmail: storeDirectory.ownerEmail
    })
    .from(storeDirectory)
    .innerJoin(companies, eq(storeDirectory.companyId, companies.id))
    .where(eq(storeDirectory.storeNumber, normalized))
    .orderBy(asc(companies.name));

  await writeDirectoryCache(
    cacheKey,
    cached.version,
    rows,
    rows.length > 0
      ? STORE_DIRECTORY_CACHE_TTL_SECONDS
      : STORE_DIRECTORY_NEGATIVE_CACHE_TTL_SECONDS
  );
  return rows;
};

const findFixedContacts = async (companyId: number): Promise<FixedContactLookupRow[]> => {
  const rows = await db
    .select({
      name: companyFixedContacts.name,
      email: companyFixedContacts.email,
      role: companyFixedContacts.role,
      sortOrder: companyFixedContacts.sortOrder
    })
    .from(companyFixedContacts)
    .where(eq(companyFixedContacts.companyId, companyId))
    .orderBy(asc(companyFixedContacts.sortOrder));

  return rows;
};

const startSyncRun = async (input: {
  source: string;
  boxFileId?: string | null;
}): Promise<number> => {
  const [row] = await db
    .insert(storeDirectorySyncRuns)
    .values({
      status: 'running',
      source: input.source,
      boxFileId: input.boxFileId ?? null
    })
    .returning({ id: storeDirectorySyncRuns.id });

  return row.id;
};

const finishSyncRun = async (input: {
  id: number;
  status: 'succeeded' | 'failed';
  storesUpserted?: number;
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> => {
  await db
    .update(storeDirectorySyncRuns)
    .set({
      status: input.status,
      storesUpserted: input.storesUpserted ?? 0,
      errorMessage: input.errorMessage ?? null,
      meta: input.meta ?? null,
      finishedAt: new Date()
    })
    .where(eq(storeDirectorySyncRuns.id, input.id));
};

const findRunningSync = async (): Promise<{ id: number } | undefined> => {
  const [row] = await db
    .select({ id: storeDirectorySyncRuns.id })
    .from(storeDirectorySyncRuns)
    .where(eq(storeDirectorySyncRuns.status, 'running'))
    .limit(1);
  return row;
};

export const storeDirectoryRepository = {
  replaceDirectoryData,
  findStoresByNumber,
  findFixedContacts,
  startSyncRun,
  finishSyncRun,
  findRunningSync
};
