/**
 * Consent-tier filtering for analytics data.
 * Fields are masked based on the visitor's consent level.
 */

const CONSENT_LEVELS = { necessary: 0, analytics: 1 } as const;
export type ConsentTier = keyof typeof CONSENT_LEVELS;

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

/**
 * Hash a visitor identifier (e.g. IP + User-Agent) for privacy.
 * Uses a simple non-reversible hash suitable for counting uniques.
 */
export async function hashVisitorId(raw: string): Promise<string> {
	const data = new TextEncoder().encode(raw);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const hex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return `v_${hex.slice(0, 16)}`;
}

/**
 * Derive a cookieless session id for visitors WITHOUT analytics consent.
 *
 * TDDDG §25 / ePrivacy Art 5(3): a session cookie writes to terminal equipment
 * and is not strictly necessary, so it requires prior consent. Without consent
 * we store nothing on the device — the id is recomputed from the visitor hash
 * + UTC day, so page views within one day still group into one session
 * (Plausible/Fathom pattern). Rotates at UTC midnight.
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
