import { describe, expect, test } from '@jest/globals';
import { normalizePostgresUrl } from '../../../src/database/postgres-url.util.js';

describe('normalizePostgresUrl', () => {
  test('strips Neon channel_binding from a pooled ssl URL', () => {
    expect(
      normalizePostgresUrl(
        'postgresql://user:pass@host/db?sslmode=require&channel_binding=require'
      )
    ).toBe('postgresql://user:pass@host/db?sslmode=require');
  });

  test('strips channel_binding when it is the only query param', () => {
    expect(normalizePostgresUrl('postgresql://user:pass@host/db?channel_binding=require')).toBe(
      'postgresql://user:pass@host/db'
    );
  });

  test('leaves URLs without channel_binding unchanged', () => {
    expect(normalizePostgresUrl('postgresql://user:pass@localhost:5432/db_name')).toBe(
      'postgresql://user:pass@localhost:5432/db_name'
    );
  });
});
