import { describe, expect, test } from '@jest/globals';
import { parseDirectoryCsv } from '../../../src/modules/directory/directory.import.js';

describe('directory CSV import', () => {
  test('parses valid rows and rejects unknown company slugs', () => {
    const csv = `company_slug,store_number,store_name,district_manager_name,district_manager_email
northwind-bakery,1042,Harbor Street,Sam Patel,sam.patel@northwind.co
northwind-bakery,1088,Riverside,Sam Patel,sam.patel@northwind.co`;

    const stores = parseDirectoryCsv(csv);
    expect(stores).toHaveLength(2);
    expect(stores[0]?.storeNumber).toBe('1042');
    expect(stores[0]?.storeName).toBe('Harbor Street');
  });

  test('requires header columns', () => {
    expect(() => parseDirectoryCsv('name,email\nfoo,bar')).toThrow();
  });

  test('rejects unknown company_slug', () => {
    const csv = `company_slug,store_number
acme-corp,1`;
    expect(() => parseDirectoryCsv(csv)).toThrow(/Unknown company_slug/);
  });
});
