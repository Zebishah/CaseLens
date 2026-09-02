import {
  STORE_DIRECTORY_COMPANIES,
  type StoreDirectoryCompanySlug
} from '../../constants/store-directory.constants.js';
import { AppError } from '../../utils/error.util.js';
import { parseStoreDirectoryWorkbook, type ParsedStoreRow } from '../store-directory/store-directory.parser.js';

const SLUGS = new Set(STORE_DIRECTORY_COMPANIES.map((company) => company.slug));

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const cell = (row: Record<string, string>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return null;
};

export const parseDirectoryCsv = (csv: string): ParsedStoreRow[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw AppError.badRequest('CSV must include a header row and at least one store row');
  }

  const headers = splitCsvLine(lines[0]!).map((header) => header.trim().toLowerCase().replace(/\s+/g, '_'));
  const required = ['company_slug', 'store_number'];
  for (const name of required) {
    if (!headers.includes(name)) {
      throw AppError.badRequest(`CSV is missing required column: ${name}`);
    }
  }

  const stores: ParsedStoreRow[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    const slug = cell(row, 'company_slug');
    const storeNumber = cell(row, 'store_number');
    if (!slug || !storeNumber) {
      continue;
    }
    if (!SLUGS.has(slug as StoreDirectoryCompanySlug)) {
      throw AppError.badRequest(`Unknown company_slug: ${slug}`);
    }

    stores.push({
      companySlug: slug as StoreDirectoryCompanySlug,
      storeNumber,
      storeName: cell(row, 'store_name'),
      vpName: cell(row, 'vp_name'),
      vpEmail: cell(row, 'vp_email'),
      directorName: cell(row, 'director_name'),
      directorEmail: cell(row, 'director_email'),
      districtManagerName: cell(row, 'district_manager_name'),
      districtManagerEmail: cell(row, 'district_manager_email'),
      ownerName: cell(row, 'owner_name'),
      ownerEmail: cell(row, 'owner_email'),
      rawRow: row
    });
  }

  if (stores.length === 0) {
    throw AppError.badRequest('CSV did not contain any valid store rows');
  }

  return stores;
};

export const parseDirectoryUpload = (input: { csv?: string; xlsxBase64?: string }): ParsedStoreRow[] => {
  if (input.csv?.trim()) {
    return parseDirectoryCsv(input.csv);
  }

  if (input.xlsxBase64?.trim()) {
    const buffer = Buffer.from(input.xlsxBase64, 'base64');
    if (buffer.length > 2_000_000) {
      throw AppError.badRequest('Workbook exceeds the 2MB import limit');
    }
    return parseStoreDirectoryWorkbook(buffer).stores;
  }

  throw AppError.badRequest('Provide csv or xlsxBase64');
};
