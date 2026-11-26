/**
 * Feedback policy: submission limits and the storage bounds that keep the feature inside the
 * allowances it shares with everything else (Neon, Upstash, Vercel).
 */

/** Public feedback submission rate limit (per IP) */
export const RATE_LIMIT_PREFIX = 'rl:feedback:submit';

export const RATE_LIMIT_MAX = 3;

export const RATE_LIMIT_WINDOW = '1 h' as const;

/** Signed-in submitters, keyed by user id, so rotating IPs buys an account nothing. */
export const USER_RATE_LIMIT_PREFIX = 'rl:feedback:submit:user';

export const USER_RATE_LIMIT_MAX = 10;

export const USER_RATE_LIMIT_WINDOW = '24 h' as const;

/**
 * The inbox stops accepting new feedback while this many items wait untriaged in `received`.
 * Bounds storage growth from a flood the rate limits let through (many IPs), at the cost of
 * one indexed count per submission.
 */
export const INBOX_CAPACITY = 500;

/**
 * The hard ceiling on stored feedback in every state. Triage moves items out of `received`,
 * so INBOX_CAPACITY alone lets the table grow without bound; this stops new submissions at
 * a size that stays negligible (about 1 KB a row, so ~5 MB). The admin inbox warns from
 * STORAGE_WARNING_SHARE on, so purging closed items can come first.
 */
export const STORAGE_CEILING = 5000;

export const STORAGE_WARNING_SHARE = 0.8;

/** "Delete closed feedback older than…" in the admin inbox. On demand, never scheduled. */
export const CLOSED_PURGE_DAYS = 180;

export const INBOX_PAGE_SIZE = 50;

/** Possibly-related items shown beside one item. */
export const RELATED_LIMIT = 5;

/** How many of the most recent items the related search reads: bounds its cost per view. */
export const RELATED_WINDOW = 200;
