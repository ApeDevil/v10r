/**
 * Default rate limits for API routes that have no domain-specific budget of their own.
 * A limit used by exactly one endpoint belongs at that endpoint, not here.
 */

/** API write operations rate limit: requests per window */
export const WRITE_RATE_LIMIT_MAX = 10;

/** API write operations rate limit: window duration */
export const WRITE_RATE_LIMIT_WINDOW = '60 s';

/** API read operations rate limit: requests per window */
export const READ_RATE_LIMIT_MAX = 30;

/** API read operations rate limit: window duration */
export const READ_RATE_LIMIT_WINDOW = '60 s';
