import readXlsxFile, { type Sheet } from 'read-excel-file/node';
import {
  STORE_DIRECTORY_COLUMN_MAP,
  STORE_DIRECTORY_COMPANIES,
  STORE_NUMBER_HEADER,
  isHelixAlwaysCcRow,
  truncateExcelSheetName,
  type StoreDirectoryCompanySlug
} from '../../constants/store-directory.constants.js';

export type ParsedStoreRow = {
  companySlug: StoreDirectoryCompanySlug;
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
  rawRow: Record<string, string | null>;
};

export type ParsedFixedContact = {
  companySlug: StoreDirectoryCompanySlug;
  name: string;
  email: string;
  role: string | null;
};

export type ParsedStoreDirectoryWorkbook = {
  stores: ParsedStoreRow[];
  fixedContacts: ParsedFixedContact[];
  sheetStats: Array<{ sheetName: string; companySlug: StoreDirectoryCompanySlug; rowCount: number }>;
  missingSheets: string[];
};

const cellToString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel may store store numbers as numbers — keep integer string without scientific notation.
    return Number.isInteger(value) ? String(value) : String(value);
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

/** Normalize store numbers for matching reporter emails (strip leading zeros for pure numeric). */
export const normalizeStoreNumber = (value: string | null | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return String(Number(trimmed));
  }

  return trimmed.toLowerCase();
};

const buildHeaderIndex = (headerRow: unknown[]): Map<string, number> => {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const label = cellToString(cell);
    if (label) {
      map.set(label.trim().toLowerCase(), index);
    }
  });
  return map;
};

const readMapped = (
  row: unknown[],
  headerIndex: Map<string, number>,
  columnName: string | undefined
): string | null => {
  if (!columnName) {
    return null;
  }

  const index = headerIndex.get(columnName.trim().toLowerCase());
  if (index === undefined) {
    return null;
  }

  return cellToString(row[index]);
};

const findSheetByExpectedName = (
  workbook: Sheet[],
  expectedName: string,
  companyName: string
): { rows: unknown[][]; actualName: string } | null => {
  const candidates = [expectedName, truncateExcelSheetName(expectedName), companyName];

  for (const candidate of candidates) {
    const sheet = workbook.find((item) => item.sheet === candidate);
    if (sheet) {
      return { rows: sheet.data as unknown[][], actualName: candidate };
    }
  }

  const loweredCompany = companyName.toLowerCase();
  const match = workbook.find((item) => item.sheet.toLowerCase().startsWith(loweredCompany));
  if (match) {
    return { rows: match.data as unknown[][], actualName: match.sheet };
  }

  return null;
};

const findStoreHeaderRowIndex = (rows: unknown[][]): number =>
  rows.findIndex((row) =>
    (row ?? []).some(
      (cell) => cellToString(cell)?.toLowerCase() === STORE_NUMBER_HEADER.toLowerCase()
    )
  );

const isFixedContactsSectionLabel = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return (
    (lower.includes('fixed') && lower.includes('contact')) ||
    (lower.includes('escalation') && lower.includes('contact'))
  );
};

const isStoreDirectorySectionLabel = (value: string | null): boolean =>
  Boolean(value?.toLowerCase().includes('store directory'));

const isRowEmpty = (row: unknown[]): boolean =>
  (row ?? []).every((cell) => !cellToString(cell));

const isValidEmail = (value: string | null): value is string => {
  if (!value) {
    return false;
  }

  const email = value.trim();
  return email.includes('@') && !email.includes(' ');
};

const findFixedContactsSectionStart = (rows: unknown[][]): number =>
  rows.findIndex((row) =>
    (row ?? []).some((cell) => isFixedContactsSectionLabel(cellToString(cell)))
  );

const findFixedContactsHeaderRowIndex = (rows: unknown[][], sectionStart: number): number => {
  const searchEnd = Math.min(rows.length, sectionStart + 6);
  for (let i = sectionStart + 1; i < searchEnd; i += 1) {
    const row = rows[i] ?? [];
    const headerIndex = buildHeaderIndex(row);
    if (headerIndex.has('email')) {
      return i;
    }
  }

  return -1;
};

const parseFixedContactsFromRows = (
  rows: unknown[][],
  companySlug: StoreDirectoryCompanySlug
): ParsedFixedContact[] => {
  const sectionStart = findFixedContactsSectionStart(rows);
  if (sectionStart < 0) {
    return [];
  }

  const headerRowIndex = findFixedContactsHeaderRowIndex(rows, sectionStart);
  if (headerRowIndex < 0) {
    return [];
  }

  const headerIndex = buildHeaderIndex(rows[headerRowIndex] ?? []);
  const storeHeaderRowIndex = findStoreHeaderRowIndex(rows);
  const contacts: ParsedFixedContact[] = [];
  const seenEmails = new Set<string>();

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    if (storeHeaderRowIndex >= 0 && i >= storeHeaderRowIndex) {
      break;
    }

    const row = rows[i] ?? [];
    if (isRowEmpty(row)) {
      continue;
    }

    if ((row ?? []).some((cell) => isStoreDirectorySectionLabel(cellToString(cell)))) {
      continue;
    }

    const email = readMapped(row, headerIndex, 'email');
    if (!isValidEmail(email)) {
      continue;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      continue;
    }

    const name = readMapped(row, headerIndex, 'name')?.trim() ?? email.trim();
    const title = readMapped(row, headerIndex, 'title')?.trim();
    const context = readMapped(row, headerIndex, 'context')?.trim();

    if (companySlug === 'helix-hospitality' && !isHelixAlwaysCcRow(context, title, name)) {
      continue;
    }

    seenEmails.add(normalizedEmail);

    const role = title || context || null;

    contacts.push({
      companySlug,
      name,
      email: email.trim(),
      role
    });
  }

  return contacts;
};

const parseStoreRowsFromGrid = (
  rows: unknown[][],
  companySlug: StoreDirectoryCompanySlug
): ParsedStoreRow[] => {
  const headerRowIndex = findStoreHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    return [];
  }

  const headerIndex = buildHeaderIndex(rows[headerRowIndex] ?? []);
  const columnMap = STORE_DIRECTORY_COLUMN_MAP[companySlug];
  const stores: ParsedStoreRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const storeNumberRaw = readMapped(row, headerIndex, columnMap.storeNumber);
    const storeNumber = normalizeStoreNumber(storeNumberRaw);
    if (!storeNumber) {
      continue;
    }

    const rawRow: Record<string, string | null> = {};
    headerIndex.forEach((colIndex, header) => {
      rawRow[header] = cellToString(row[colIndex]);
    });

    stores.push({
      companySlug,
      storeNumber,
      storeName: readMapped(row, headerIndex, columnMap.storeName),
      vpName: readMapped(row, headerIndex, columnMap.vpName),
      vpEmail: readMapped(row, headerIndex, columnMap.vpEmail),
      directorName: readMapped(row, headerIndex, columnMap.directorName),
      directorEmail: readMapped(row, headerIndex, columnMap.directorEmail),
      districtManagerName: readMapped(row, headerIndex, columnMap.districtManagerName),
      districtManagerEmail: readMapped(row, headerIndex, columnMap.districtManagerEmail),
      ownerName: readMapped(row, headerIndex, columnMap.ownerName),
      ownerEmail: readMapped(row, headerIndex, columnMap.ownerEmail),
      rawRow
    });
  }

  return stores;
};

const parseCompanySheet = (
  rows: unknown[][],
  companySlug: StoreDirectoryCompanySlug
): { stores: ParsedStoreRow[]; fixedContacts: ParsedFixedContact[] } => {
  return {
    fixedContacts: parseFixedContactsFromRows(rows, companySlug),
    stores: parseStoreRowsFromGrid(rows, companySlug)
  };
};

export const parseStoreDirectoryWorkbook = async (buffer: Buffer): Promise<ParsedStoreDirectoryWorkbook> => {
  const workbook = await readXlsxFile(buffer);
  const stores: ParsedStoreRow[] = [];
  const fixedContacts: ParsedFixedContact[] = [];
  const sheetStats: ParsedStoreDirectoryWorkbook['sheetStats'] = [];
  const missingSheets: string[] = [];

  for (const company of STORE_DIRECTORY_COMPANIES) {
    const resolved = findSheetByExpectedName(workbook, company.sheetName, company.name);
    if (!resolved) {
      missingSheets.push(company.sheetName);
      continue;
    }

    const parsed = parseCompanySheet(resolved.rows, company.slug);
    stores.push(...parsed.stores);
    fixedContacts.push(...parsed.fixedContacts);
    sheetStats.push({
      sheetName: resolved.actualName,
      companySlug: company.slug,
      rowCount: parsed.stores.length
    });
  }

  return { stores, sheetStats, fixedContacts, missingSheets };
};
