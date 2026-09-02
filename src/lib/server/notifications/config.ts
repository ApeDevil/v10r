/**
 * Notification policy — page size, SSE limits, and the delivery worker's claim/backoff
 * schedule. Retention windows live in `retention/schedule.ts`.
 */

export const PAGE_SIZE = 20;

/** SSE heartbeat interval (ms) */
export const SSE_HEARTBEAT_MS = 25_000;

/** Max SSE connections per user */
export const SSE_MAX_PER_USER = 3;

/** Delivery worker interval (ms) */
export const DEFAULT_DELIVERY_INTERVAL_MS = 15_000;

/**
 * Max delivery attempts before the row is dead-lettered.
 *
 * 5 rather than 3 because attempts are spaced by exponential backoff: 3 covers
 * only ~2.5 minutes of channel downtime, 5 covers ~42 minutes.
 */
export const DELIVERY_MAX_ATTEMPTS = 5;

/** Deliveries claimed per drain tick. */
export const DELIVERY_BATCH_SIZE = 25;

/**
 * First retry delay (ms). MUST exceed DEFAULT_DELIVERY_INTERVAL_MS — a backoff
 * shorter than the poll interval is not a backoff, it is a rounding error.
 */
export const DELIVERY_RETRY_BASE_MS = 30_000;

/** Exponential growth factor per attempt: 30s → 2m → 8m → 32m. */
export const DELIVERY_RETRY_FACTOR = 4;

/** Backoff ceiling (ms). */
export const DELIVERY_RETRY_MAX_MS = 60 * 60_000;

/** Retry-delay jitter band (±fraction) so a recovered channel isn't hit by a herd. */
export const DELIVERY_RETRY_JITTER = 0.15;

/**
 * How long a claim is valid before the reaper may reclaim it.
 *
 * INVARIANT: must exceed the worst-case time to drain a whole claimed batch.
 * `attempted_at` is stamped once for the entire batch, so the last row of a batch
 * of DELIVERY_BATCH_SIZE does not begin sending until the previous 24 finished —
 * its lease clock has been running that whole time. With a 10s per-channel
 * timeout: 25 × 10s = 250s < 300s. Channels have no timeout yet, so this
 * invariant is currently aspirational — see the follow-ups in the workers doc.
 */
export const DELIVERY_CLAIM_LEASE_MS = 5 * 60_000;

/** Notification mark-as-read rate limit: requests per window */
export const RATE_LIMIT_MAX = 60;

/** Notification mark-as-read rate limit: window duration */
export const RATE_LIMIT_WINDOW = '60 s';

/** SSE connection attempt rate limit: requests per window */
export const SSE_RATE_LIMIT_MAX = 10;

/** SSE connection attempt rate limit: window duration */
export const SSE_RATE_LIMIT_WINDOW = '60 s';
