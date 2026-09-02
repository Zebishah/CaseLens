import { customType } from 'drizzle-orm/pg-core';

/** pgvector column; nullable until Milestone 5 embedding generation. */
export const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value !== 'string') {
      return [];
    }
    const trimmed = value.replace(/^\[|\]$/g, '');
    if (!trimmed) {
      return [];
    }
    return trimmed.split(',').map((part) => Number.parseFloat(part.trim()));
  }
});
