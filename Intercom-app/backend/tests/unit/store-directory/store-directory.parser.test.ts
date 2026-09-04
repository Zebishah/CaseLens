import * as XLSX from 'xlsx';
import {
  normalizeStoreNumber,
  parseStoreDirectoryWorkbook
} from '../../../src/modules/store-directory/store-directory.parser.js';
import {
  STORE_DIRECTORY_COMPANIES,
  isHelixAlwaysCcRow,
  truncateExcelSheetName
} from '../../../src/constants/store-directory.constants.js';

const buildWorkbookBuffer = (): Buffer => {
  const workbook = XLSX.utils.book_new();

  for (const company of STORE_DIRECTORY_COMPANIES) {
    const sheetName = truncateExcelSheetName(company.sheetName);
    let rows: unknown[][];

    if (company.slug === 'northwind-bakery') {
      rows = [
        [company.sheetName],
        [
          'Region/Group',
          'Store Number',
          'Store Name',
          'VP of Ops',
          'VP of Ops Email',
          'Director',
          'Director Email',
          'District Manager',
          'District Manager Email'
        ],
        [
          'Central',
          413,
          'North St',
          'Pat Ventura',
          'pat.quinn@northwind.co',
          'Riley Lawson',
          'riley@northwind.co',
          'Kysean Alexander',
          'kysean@northwind.co'
        ]
      ];
    } else if (company.slug === 'helix-hospitality') {
      rows = [
        ['Fixed Contacts'],
        ['Context', 'Name', 'Email', 'Title'],
        ['Always CC', 'HR Group', 'hr@helix.co', 'HR'],
        [],
        ['Store Directory'],
        [
          'State/Region',
          'Store Number',
          'Store Name',
          'District Manager',
          'District Manager Email'
        ],
        ['TX', 1147, 'Test Store', 'Kenneth Sinclair', 'kenneth@helix.co']
      ];
    } else {
      rows = [
        ['Fixed Contacts'],
        ['Name', 'Email'],
        ['Matt Haberman', 'm.haberman@meridian.co'],
        [],
        ['Store Directory'],
        ['Store Number', 'Owner (District Manager)', 'Owner Email'],
        [1091, 'Adam Dahlke', 'a.dahlke@meridian.co']
      ];
    }

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

describe('store-directory.parser', () => {
  it('identifies CHC always-CC rows from Excel markers, not hardcoded emails', () => {
    expect(isHelixAlwaysCcRow('Always CC', 'HR', 'HR Group')).toBe(true);
    expect(isHelixAlwaysCcRow('LEAD inbox', 'LEAD Team', 'LEAD Team')).toBe(true);
    expect(isHelixAlwaysCcRow('', '', 'HR Group email (includes Jocy)')).toBe(true);
    expect(isHelixAlwaysCcRow('Only add for Serious Issues', 'CEO', 'Corbett Harris')).toBe(
      false
    );
    expect(isHelixAlwaysCcRow('', 'Director of Operations', 'Kyle Sinclair')).toBe(false);
  });

  it('normalizes numeric store numbers', () => {
    expect(normalizeStoreNumber('0413')).toBe('413');
    expect(normalizeStoreNumber('413')).toBe('413');
    expect(normalizeStoreNumber(' 1147 ')).toBe('1147');
    expect(normalizeStoreNumber(null)).toBeNull();
  });

  it('parses all three company sheets and finds Store Number header mid-sheet', async () => {
    const parsed = await parseStoreDirectoryWorkbook(buildWorkbookBuffer());

    expect(parsed.missingSheets).toEqual([]);
    expect(parsed.sheetStats).toHaveLength(3);
    expect(parsed.stores).toHaveLength(3);

    const premium = parsed.stores.find((row) => row.storeNumber === '413');
    expect(premium).toMatchObject({
      companySlug: 'northwind-bakery',
      vpEmail: 'pat.quinn@northwind.co',
      directorEmail: 'riley@northwind.co',
      districtManagerEmail: 'kysean@northwind.co'
    });

    const chc = parsed.stores.find((row) => row.storeNumber === '1147');
    expect(chc).toMatchObject({
      companySlug: 'helix-hospitality',
      districtManagerEmail: 'kenneth@helix.co'
    });

    const merc = parsed.stores.find((row) => row.storeNumber === '1091');
    expect(merc).toMatchObject({
      companySlug: 'meridian-holdings',
      ownerEmail: 'a.dahlke@meridian.co'
    });

    expect(parsed.fixedContacts).toEqual(
      expect.arrayContaining([
        {
          companySlug: 'helix-hospitality',
          name: 'HR Group',
          email: 'hr@helix.co',
          role: 'HR'
        },
        {
          companySlug: 'meridian-holdings',
          name: 'Matt Haberman',
          email: 'm.haberman@meridian.co',
          role: null
        }
      ])
    );
    expect(parsed.fixedContacts).toHaveLength(2);
  });

  it('parses CHC escalation contacts with context and title columns', async () => {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ['Helix Hospitality - Full Store Directory'],
      ['Fixed / Escalation Contacts (not store-specific)'],
      ['Context', 'Name', 'Email', 'Title'],
      ['Always CC', 'HR Group', 'hr@helix.co', 'HR'],
      [
        'Only add for Serious Issues',
        'Corbett Harris',
        'corbett@helix.co',
        'CEO'
      ],
      [
        'Oversees all Catering, Marketing Managers',
        'Kenneth Sinclair',
        'kenneth@helix.co',
        'Director of Marketing / LEAD Team'
      ],
      ['LEAD inbox', 'LEAD Team', 'lead@helix.co', 'LEAD Team'],
      [],
      ['Store Directory'],
      ['State/Region', 'Store Number', 'Store Name', 'District Manager', 'District Manager Email'],
      ['TX', 1147, 'Test Store', 'Store DM', 'dm@helix.co']
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      truncateExcelSheetName(STORE_DIRECTORY_COMPANIES[1]!.sheetName)
    );

    const parsed = await parseStoreDirectoryWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    );

    expect(parsed.fixedContacts).toEqual([
      {
        companySlug: 'helix-hospitality',
        name: 'HR Group',
        email: 'hr@helix.co',
        role: 'HR'
      },
      {
        companySlug: 'helix-hospitality',
        name: 'LEAD Team',
        email: 'lead@helix.co',
        role: 'LEAD Team'
      }
    ]);
  });

  it('parses client-style CHC HR row with empty Context/Title from Excel', async () => {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ['Helix Hospitality - Full Store Directory'],
      ['Fixed / Escalation Contacts (not store-specific)'],
      ['Context', 'Name', 'Email', 'Title'],
      ['', 'HR Group email (includes Jocy, Janna, and Charmaine)', 'hr@helix.co', ''],
      ['Only add for Serious Issues:', 'Corbett Harris', 'corbett@helix.co', 'CEO'],
      [],
      ['Store Directory'],
      ['State/Region', 'Store Number', 'Store Name', 'District Manager', 'District Manager Email'],
      ['TX', 1147, 'Test Store', 'Store DM', 'dm@helix.co']
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      truncateExcelSheetName(STORE_DIRECTORY_COMPANIES[1]!.sheetName)
    );

    const parsed = await parseStoreDirectoryWorkbook(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    );

    expect(parsed.fixedContacts).toEqual([
      {
        companySlug: 'helix-hospitality',
        name: 'HR Group email (includes Jocy, Janna, and Charmaine)',
        email: 'hr@helix.co',
        role: null
      }
    ]);
  });
});
