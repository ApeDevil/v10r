/**
 * Consent cookie identity — shared by the client banner that writes it and the server
 * hook that reads it.
 *
 * Dependency-free and outside `$lib/server/` on purpose: `state/consent.svelte.ts` runs in
 * the browser and cannot import server-only code, so before this existed the name and the
 * six-month max-age were literals in one file and named constants in another. A cookie
 * whose name is written in two places is a cookie that gets renamed in one.
 */

/** Consent cookie name. */
export const CONSENT_COOKIE = 'v10r_consent';

/** Consent cookie max-age (seconds, 6 months). */
export const CONSENT_MAX_AGE = 15_552_000;
