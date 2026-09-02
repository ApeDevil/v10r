/**
 * Feedback submission policy.
 */

/** Public feedback submission rate limit (per IP) */
export const RATE_LIMIT_PREFIX = 'rl:feedback:submit';

export const RATE_LIMIT_MAX = 3;

export const RATE_LIMIT_WINDOW = '1 h' as const;
