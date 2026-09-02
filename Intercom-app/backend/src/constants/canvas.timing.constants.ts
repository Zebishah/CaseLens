import { env } from '../config/env.config.js';

/** Intercom inbox initialize must finish in ~3s total. */
export const CANVAS_INITIALIZE_WAIT_MS = process.env.NODE_ENV === 'test' ? 0 : 2_700;
/**
 * After Refresh / Re-analyze — poll DB until ready or this budget (~3s).
 * Keep total response under Intercom Canvas submit timeout so the spinner never hangs forever.
 */
export const CANVAS_REFRESH_WAIT_MS = process.env.NODE_ENV === 'test' ? 0 : 3_000;
/** Soft Refresh must always respond before Intercom abandons the submit spinner. */
export const CANVAS_REFRESH_TOTAL_BUDGET_MS = process.env.NODE_ENV === 'test' ? 0 : 3_500;
/** Cap Intercom API sync during Refresh so a slow/hung API cannot freeze the sidebar. */
export const CANVAS_REFRESH_SYNC_TIMEOUT_MS = process.env.NODE_ENV === 'test' ? 0 : 1_200;
/** Remove related case — DB update + render only; must stay well under Intercom submit timeout. */
export const CANVAS_DISMISS_TOTAL_BUDGET_MS = process.env.NODE_ENV === 'test' ? 0 : 2_500;
/** Brief poll after domain search — same fast-return pattern as refresh. */
export const CANVAS_DOMAIN_SEARCH_WAIT_MS = process.env.NODE_ENV === 'test' ? 0 : 5_000;
/** How often to re-check DB while waiting for intelligence. */
export const CANVAS_INTELLIGENCE_POLL_MS = process.env.NODE_ENV === 'test' ? 0 : 250;

/**
 * Max wait for BullMQ queue.add. Upstash from Render often needs 2–5s on cold connections.
 * Override on Render: REDIS_ENQUEUE_TIMEOUT_MS=5000
 */
export const REDIS_ENQUEUE_TIMEOUT_MS =
  process.env.NODE_ENV === 'test'
    ? 0
    : (env.REDIS_ENQUEUE_TIMEOUT_MS ?? (env.NODE_ENV === 'production' ? 8_000 : 1_000));
