/**
 * Consent-tier filtering for analytics data.
 * Fields are masked based on the visitor's consent level.
 */

import type { ConsentTier } from '$lib/types/db-enums';

export type { ConsentTier };

const CONSENT_LEVELS: Record<ConsentTier, number> = { necessary: 0, analytics: 1 };

/**
 * Parse a raw cookie value into a valid ConsentTier (defaults to 'necessary').
 *
 * Anything unrecognised denies by default, so a typo or a tampered cookie can
 * never escalate. The retired `full` value is deliberately NOT special-cased:
 * it falls through to `necessary`, which means a visitor holding an old cookie
 * is asked again rather than being silently credited with consent they gave to
 * a different, now-nonexistent description of the processing.
 */
export function parseConsentTier(raw: string | undefined): ConsentTier {
	if (raw === 'necessary' || raw === 'analytics') return raw;
	return 'necessary';
}

/** Check if a consent tier meets the required minimum */
export function hasConsent(actual: ConsentTier, required: ConsentTier): boolean {
	return CONSENT_LEVELS[actual] >= CONSENT_LEVELS[required];
}

/** Visitor-id width in hex chars. 128 bits — the previous 64 was brute-forceable on its own. */
const VISITOR_HEX_LENGTH = 32;

/**
 * Derive a pseudonymous visitor identifier from IP + User-Agent.
 *
 * KEYED, deliberately. The previous construction was a bare SHA-256 truncated
 * to 64 bits, which this repository had already ruled against in writing for a
 * lower-volume subsystem — `docs/blueprint/architecture/hosted-mcp.md`: "A bare
 * digest over the IPv4 space plus real UA strings inverts on a laptop — that is
 * obfuscation, not pseudonymisation." The IPv4 space is 2^32 and the population
 * of real UA strings is small, so an unkeyed digest is a lookup table away from
 * plaintext on a read-only database leak. Two subsystems, two standards, and
 * the weaker one carried orders of magnitude more rows.
 *
 * The salt is a parameter rather than an env read so this stays a pure function
 * and the caller owns the resolution — the same shape as the MCP sibling in
 * `mcp/telemetry/client-key.ts`. There is no unsalted fallback: `visitor_id` is
 * NOT NULL, and a degradation branch would make the shipped default the exact
 * construction this replaces.
 *
 * NOT rotated per day, unlike that sibling — and this is the one place the two
 * deliberately diverge. `aggregations.ts` counts distinct visitors across a
 * user-chosen range of up to 90 days; daily rotation would multiply that count
 * by the number of days and break the `visitor_dims` CTE, which exists
 * precisely to stop one visitor being counted under two countries. Retention is
 * 60 days, so rotating the salt at or above that cadence costs at most one
 * boundary inside any reporting window — that is what `ANALYTICS_VISITOR_SALT`
 * is for. Rotation stays possible without being automatic.
 */
export async function hashVisitorId(raw: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	]);
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(raw));
	const hex = Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	// `v1_` marks the construction, not a version to migrate between. Rows under
	// the old `v_` prefix are unlinkable to any subject and age out with the
	// 60-day retention window.
	return `v1_${hex.slice(0, VISITOR_HEX_LENGTH)}`;
}

/**
 * Derive a cookieless session id for visitors WITHOUT analytics consent.
 *
 * TDDDG §25 / ePrivacy Art 5(3): a session cookie writes to terminal equipment
 * and is not strictly necessary, so it requires prior consent. Without consent
 * we store nothing on the device — the id is recomputed from the visitor hash
 * + UTC day, so page views within one day still group into one session
 * (Plausible/Fathom pattern). Rotates at UTC midnight.
 *
 * A plain digest is still right here: its input is already a keyed 128-bit
 * value, so there is no low-entropy preimage space to sweep. Keying it a second
 * time would add ceremony, not strength.
 */
export async function deriveCookielessSessionId(visitorId: string): Promise<string> {
	const day = new Date().toISOString().slice(0, 10);
	const data = new TextEncoder().encode(`${visitorId}:${day}`);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const hex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return `s_${hex.slice(0, 16)}`;
}
