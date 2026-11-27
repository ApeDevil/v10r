/**
 * Authentication policy — session lifetimes, one-time-code expiry, step-up freshness,
 * and the rate limits that protect the auth endpoints.
 */

// ADMIN_USER_ID gates admin access — a comma-separated list of admin user ids
// (one per admin; immutable, so admin can't be transferred by re-claiming an
// email). Read from $app/env/private at usage sites to avoid top-level env
// access during build. See src/lib/server/http/guards.ts (isAdmin).

/** Session lifetime in seconds (7 days) */
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7;

/** Refresh session if older than this (24 hours, seconds) */
export const SESSION_UPDATE_AGE = 60 * 60 * 24;

/** Cookie cache revalidation interval (5 minutes, seconds) */
export const SESSION_COOKIE_MAX_AGE = 60 * 5;

/** Magic link token expiry (seconds) */
export const MAGIC_LINK_EXPIRES_IN = 300;

/** Email OTP expiry (seconds) */
export const EMAIL_OTP_EXPIRES_IN = 300;

/** Email OTP max attempts before invalidation */
export const EMAIL_OTP_MAX_ATTEMPTS = 3;

/** Auth endpoint rate limit: requests per window */
export const RATE_LIMIT_MAX = 5;

/** Auth endpoint rate limit: window duration */
export const RATE_LIMIT_WINDOW = '60 s';

/**
 * OAuth callback rate limit: requests per window (per IP). More generous than
 * RATE_LIMIT_MAX — a single login burns a callback GET on top of the
 * sign-in POST, and callbacks are already protected by Better Auth's one-time
 * OAuth state validation. This bucket is DoS hygiene, not brute-force defense.
 */
export const CALLBACK_RATE_LIMIT_MAX = 10;

/** OAuth callback rate limit: window duration */
export const CALLBACK_RATE_LIMIT_WINDOW = '60 s';

/**
 * Sign-in ceremony rate limit: requests per window (per IP). For the steps that start or
 * resume a sign-in without checking a secret or sending an email — the OAuth authorization
 * navigation and the passkey challenge. One MCP connect plus one passkey sign-in already
 * spends four to six of these (production, 2026-11-27), so sharing RATE_LIMIT_MAX with the
 * credential checks locked people out of their first attempt.
 */
export const SIGN_IN_CEREMONY_RATE_LIMIT_MAX = 30;

/** Sign-in ceremony rate limit: window duration */
export const SIGN_IN_CEREMONY_RATE_LIMIT_WINDOW = '60 s';

/** Issuer label shown in authenticator apps for TOTP enrollment */
export const TWO_FACTOR_ISSUER = 'Velociraptor';

/** Step-up freshness window: a TOTP/backup-code check satisfies gated actions for this long (seconds) */
export const STEPUP_TTL = 600;

/** Per-account 2FA verify rate limit: attempts per window */
export const STEPUP_VERIFY_RATE_LIMIT_MAX = 5;

/** Per-account 2FA verify rate limit: window duration */
export const STEPUP_VERIFY_RATE_LIMIT_WINDOW = '300 s';

/**
 * Per-IP limit for the OAuth endpoints MCP hosts call server-to-server (token, register,
 * revoke, jwks). Hosts share egress across all their users, so this is a host-wide ceiling,
 * not a per-person one — see hooks.server.ts.
 */
export const OAUTH_MACHINE_RATE_LIMIT_MAX = 300;

/** OAuth machine-endpoint rate limit: window duration */
export const OAUTH_MACHINE_RATE_LIMIT_WINDOW = '60 s';
