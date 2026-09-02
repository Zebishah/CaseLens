/** Milliseconds since `startedAt` (from `Date.now()`). */
export const elapsedMs = (startedAt: number): number => Date.now() - startedAt;
