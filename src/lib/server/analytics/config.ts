/**
 * Analytics policy — cookie identity, session windowing, and confirmation-token lifetime.
 * Retention windows live in `retention/schedule.ts`.
 */

/** Session inactivity timeout (ms, 30 min) */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Analytics session cookie name. Only ever set at `analytics` consent or above —
 * it writes to terminal equipment and is not strictly necessary (TDDDG §25 /
 * ePrivacy Art 5(3)). Read by both the collector hook and the SPA beacon
 * endpoint, which is why it lives here rather than as a literal in either.
 */
export const SESSION_COOKIE = '_v10r_sid';

/**
 * Lifetime of the human-confirmation token (ms, 10 min). One token is minted
 * per document load and the ping fires ~1.5s in, so the window only has to
 * survive a slow connection plus clock drift — a long TTL just widens the
 * replay window of a stateless token for no benefit.
 */
export const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Re-exported, not redeclared: the browser writes this cookie and the hook reads it, so
 * its identity lives in the client-safe `$lib/analytics/consent-cookie` leaf.
 */
export { CONSENT_COOKIE, CONSENT_MAX_AGE } from '$lib/analytics/consent-cookie';

/**
 * Bot lane — buffered in Upstash Redis, flushed into `analytics.bot_hits`.
 *
 * A crawler request must not touch Postgres: hits arrive around the clock and every
 * INSERT woke the Neon endpoint for its 5-minute minimum, which is how ~30 wakes a
 * night cost more compute than the humans did. See `bot-hit-buffer.ts`.
 */

/** Matches the CHECK on `bot_hits.path`. Truncating here keeps the flush from failing. */
export const MAX_BOT_PATH_CHARS = 128;

/** Redis list holding hits that have not reached Postgres yet. */
export const BOT_HIT_BUFFER_KEY = 'analytics:bot-hits:pending';

/**
 * Backlog ceiling. A flood past this loses its OLDEST hits at flush time — a scanner
 * storm is exactly the traffic that should not be allowed to grow a list without bound,
 * and the daily flush drains ~5k rows on a normal day.
 */
export const BOT_HIT_BUFFER_CAP = 100_000;

/** Rows per INSERT while flushing (8 columns × 500 sits well under the 65,535-parameter ceiling). */
export const BOT_HIT_FLUSH_BATCH = 500;

/** Redis key per operator holding the published prefixes the request path verifies against. */
export const BOT_RANGES_PROJECTION_KEY_PREFIX = 'analytics:bot-ranges:';

/**
 * How long a process keeps an operator's prefixes before re-reading Redis (ms, 10 min).
 * The feeds change on the order of weeks; this only bounds staleness after a refresh.
 */
export const BOT_RANGES_CACHE_TTL_MS = 10 * 60 * 1000;
