/**
 * Salt resolution for visitor pseudonymisation.
 *
 * `hashVisitorId` in `consent.ts` deliberately takes its key as a parameter so
 * it stays a pure function — this is the one place that decides what that key
 * is. Every lane goes through here, so the four write paths (server pageview
 * hook, both SPA beacons, the consent audit log) and the visitor-facing GDPR
 * page cannot drift apart in construction, which is precisely how the previous
 * two-standards situation arose.
 */
import { deriveSubkey, SUBKEY_PURPOSES } from '$lib/server/security/subkey';
import { hashVisitorId } from './consent';

function salt(): string {
	return deriveSubkey(SUBKEY_PURPOSES.analyticsVisitor);
}

/** The pseudonymous visitor id written to `analytics.events` / `analytics.sessions`. */
export function deriveVisitorId(ip: string, userAgent: string): Promise<string> {
	return hashVisitorId(`${ip}:${userAgent}`, salt());
}

/**
 * Hash of the User-Agent alone, for the consent audit trail.
 *
 * Keyed under the same purpose as the visitor id: on its own a UA string has
 * little entropy, so an unkeyed digest of one is a lookup table with a few
 * thousand entries. It records "the browser that granted this" without storing
 * the browser.
 */
export function deriveUaHash(userAgent: string): Promise<string> {
	return hashVisitorId(userAgent, salt());
}
