/**
 * Style policy — rate limits for rolling, picking and persisting a style, plus the
 * per-user custom-palette cap.
 */

/** Style roll rate limit: requests per window */
export const ROLL_RATE_LIMIT_PREFIX = 'ratelimit:style:roll';

export const ROLL_RATE_LIMIT_MAX = 10;

export const ROLL_RATE_LIMIT_WINDOW = '60 s' as const;

/**
 * Style pick rate limit. Deliberately far looser than the roll bucket: picking a
 * palette, a typography set and a shape is three requests, and comparing eight
 * palettes by clicking through them is eight more. Roll's budget of 10 would
 * reject ordinary browsing of the picker.
 */
export const PICK_RATE_LIMIT_PREFIX = 'ratelimit:style:pick';

export const PICK_RATE_LIMIT_MAX = 60;

export const PICK_RATE_LIMIT_WINDOW = '60 s' as const;

/** Custom palette writes (create/update/delete), keyed per user. */
export const PALETTE_WRITE_RATE_LIMIT_PREFIX = 'ratelimit:style:palettes';

export const PALETTE_WRITE_RATE_LIMIT_MAX = 20;

export const PALETTE_WRITE_RATE_LIMIT_WINDOW = '60 s' as const;

/**
 * Per-user custom palette cap. Any signed-in user can craft a palette, so this
 * bounds row growth.
 */
export const MAX_CUSTOM_PALETTES_PER_USER = 20;
