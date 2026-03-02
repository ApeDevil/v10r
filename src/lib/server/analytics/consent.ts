/**
 * Consent-tier filtering for analytics data.
 * Fields are masked based on the visitor's consent level.
 */

const CONSENT_LEVELS = { necessary: 0, analytics: 1, full: 2 } as const;
type ConsentTier = keyof typeof CONSENT_LEVELS;

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
