/**
 * Showcase guard-rails. These bound demo data written by anonymous visitors; they are not
 * product limits.
 */

/** Max rows per showcase table */
export const MAX_SHOWCASE_ROWS = 50;

/** Username check endpoint rate limit: requests per window */
export const USERNAME_CHECK_RATE_LIMIT_MAX = 20;

/** Username check endpoint rate limit: window duration */
export const USERNAME_CHECK_RATE_LIMIT_WINDOW = '60 s' as const;
