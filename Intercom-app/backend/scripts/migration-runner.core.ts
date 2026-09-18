export type OrderedMigration = { id: string; sql: string };

export type MigrationAdapter = {
  isApplied(id: string): Promise<boolean>;
  apply(migration: OrderedMigration): Promise<void>;
};

export const runOrderedMigrations = async (
  migrations: readonly OrderedMigration[],
  adapter: MigrationAdapter
): Promise<string[]> => {
  const ids = migrations.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Migration registry contains duplicate IDs.');
  }

  const applied: string[] = [];
  for (const migration of migrations) {
    if (await adapter.isApplied(migration.id)) continue;
    await adapter.apply(migration);
    applied.push(migration.id);
  }
  return applied;
};
