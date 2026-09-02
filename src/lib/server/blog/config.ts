/**
 * Blog policy — rate limits for authoring writes and the CPU-intensive preview render.
 */

/** Blog write operations rate limit: requests per window */
export const WRITE_RATE_LIMIT_PREFIX = 'ratelimit:blog:write';

export const WRITE_RATE_LIMIT_MAX = 30;

export const WRITE_RATE_LIMIT_WINDOW = '60 s' as const;

/** Blog preview rate limit (CPU-intensive): requests per window */
export const PREVIEW_RATE_LIMIT_PREFIX = 'ratelimit:blog:preview';

export const PREVIEW_RATE_LIMIT_MAX = 10;

export const PREVIEW_RATE_LIMIT_WINDOW = '60 s' as const;
