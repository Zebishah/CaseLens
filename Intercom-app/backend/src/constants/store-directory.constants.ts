/**
 * Store-directory / CC rules for generated portfolio companies.
 * Lookup is by store number only — does not change reporter store extraction.
 *
 * Excel sheet names are capped at 31 characters.
 */

export const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

export const STORE_DIRECTORY_SHEETS = {
  NORTHWIND: 'Northwind Bakery - Store Directory',
  HELIX: 'Helix Hospitality - Store Directory',
  MERIDIAN: 'Meridian Holdings - Store Directory'
} as const;

export const truncateExcelSheetName = (name: string): string =>
  name.length <= EXCEL_SHEET_NAME_MAX_LENGTH
    ? name
    : name.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);

export type StoreDirectoryCompanySlug =
  | 'northwind-bakery'
  | 'helix-hospitality'
  | 'meridian-holdings';

export type StoreDirectoryCompanyDef = {
  slug: StoreDirectoryCompanySlug;
  name: string;
  sheetName: string;
};

export const STORE_DIRECTORY_COMPANIES: StoreDirectoryCompanyDef[] = [
  {
    slug: 'northwind-bakery',
    name: 'Northwind Bakery',
    sheetName: STORE_DIRECTORY_SHEETS.NORTHWIND
  },
  {
    slug: 'helix-hospitality',
    name: 'Helix Hospitality',
    sheetName: STORE_DIRECTORY_SHEETS.HELIX
  },
  {
    slug: 'meridian-holdings',
    name: 'Meridian Holdings',
    sheetName: STORE_DIRECTORY_SHEETS.MERIDIAN
  }
];

export const STORE_DIRECTORY_COLUMN_MAP: Record<
  StoreDirectoryCompanySlug,
  {
    storeNumber: string;
    storeName?: string;
    vpName?: string;
    vpEmail?: string;
    directorName?: string;
    directorEmail?: string;
    districtManagerName?: string;
    districtManagerEmail?: string;
    ownerName?: string;
    ownerEmail?: string;
  }
> = {
  'northwind-bakery': {
    storeNumber: 'Store Number',
    storeName: 'Store Name',
    vpName: 'VP of Ops',
    vpEmail: 'VP of Ops Email',
    directorName: 'Director',
    directorEmail: 'Director Email',
    districtManagerName: 'District Manager',
    districtManagerEmail: 'District Manager Email'
  },
  'helix-hospitality': {
    storeNumber: 'Store Number',
    storeName: 'Store Name',
    districtManagerName: 'District Manager',
    districtManagerEmail: 'District Manager Email'
  },
  'meridian-holdings': {
    storeNumber: 'Store Number',
    ownerName: 'Owner (District Manager)',
    ownerEmail: 'Owner Email'
  }
};

export const STORE_NUMBER_HEADER = 'Store Number';

export const isHelixAlwaysCcRow = (
  context: string | null | undefined,
  title: string | null | undefined,
  name: string | null | undefined
): boolean => {
  const contextLower = context?.trim().toLowerCase() ?? '';
  const titleLower = title?.trim().toLowerCase() ?? '';
  const nameLower = name?.trim().toLowerCase() ?? '';

  if (contextLower.includes('always cc')) {
    return true;
  }

  if (contextLower.includes('lead inbox')) {
    return true;
  }

  if (!contextLower && !titleLower && nameLower.includes('hr group')) {
    return true;
  }

  return false;
};
