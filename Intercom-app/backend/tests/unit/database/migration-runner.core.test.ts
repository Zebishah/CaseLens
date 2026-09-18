import { runOrderedMigrations, type MigrationAdapter, type OrderedMigration } from '../../../scripts/migration-runner.core.js';
import { describe, expect, jest, test } from '@jest/globals';

describe('ordered migration runner', () => {
  test('applies pending migrations in registry order and skips recorded migrations', async () => {
    const completed = new Set(['001-base']);
    const applied: string[] = [];
    const adapter: MigrationAdapter = {
      async isApplied(id) {
        return completed.has(id);
      },
      async apply(migration) {
        applied.push(migration.id);
        completed.add(migration.id);
      }
    };
    const registry: OrderedMigration[] = [
      { id: '001-base', sql: 'base' },
      { id: '002-cases', sql: 'cases' },
      { id: '003-auth', sql: 'auth' }
    ];

    await expect(runOrderedMigrations(registry, adapter)).resolves.toEqual(['002-cases', '003-auth']);
    expect(applied).toEqual(['002-cases', '003-auth']);
    await expect(runOrderedMigrations(registry, adapter)).resolves.toEqual([]);
  });

  test('rejects duplicate migration IDs before applying any SQL', async () => {
    const adapter: MigrationAdapter = {
      isApplied: jest.fn().mockResolvedValue(false),
      apply: jest.fn().mockResolvedValue(undefined)
    };
    const registry = [
      { id: 'same', sql: 'one' },
      { id: 'same', sql: 'two' }
    ];
    await expect(runOrderedMigrations(registry, adapter)).rejects.toThrow('duplicate IDs');
    expect(adapter.apply).not.toHaveBeenCalled();
  });
});
