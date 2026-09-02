/**
 * Confirmation-ping nonce — issue and verify.
 *
 * The confirm endpoint marks a session as JS-corroborated
 * (`sessions.human_confirmed_at`), which is the number the dashboard headlines.
 * Without a nonce, anything that can POST JSON could flood confirmations and
 * quietly inflate the confirmed count — the exact direct-to-endpoint injection
 * that hit Plausible operators. The token makes a confirmation cost a preceding
 * page render.
 *
 * Format: `${issuedAtMs}.${hex(HMAC-SHA256(subkey, `${issuedAtMs}:${visitorId}`))}`.
 *
 * - Bound to the VISITOR HASH, not stored anywhere: a token farmed by fetching
 *   one page cannot confirm sessions from other IPs/UAs, and the token carries
 *   no readable identifier — the hash only exists inside the MAC.
 * - Stateless on purpose: no Redis round-trip on either the layout-load or the
 *   beacon path. The cost is that replay within the TTL is possible — and
 *   idempotent, since `human_confirmed_at` is set once and never advanced.
 *
 * ## Honest threat model
 *
 * This stops BLIND injection. It does not stop an HTML-parsing bot that fetches
 * the page, reads its own token out of the payload, and echoes it — that caller
 * has executed the fetch-and-parse loop the confirmed bucket measures the
 * absence of, and the residue is what the `ip_class` ranking exists to surface.
 * Do not "harden" this into a stored one-time nonce without a reason: the
 * attacker it would add coverage for is already indistinguishable from a
 * headless browser.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { deriveSubkey, SUBKEY_PURPOSES } from '$lib/server/security/subkey';
import { CONFIRM_TOKEN_TTL_MS } from './config';

/** Tolerated forward drift between the issuing and verifying clock. */
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

function mac(issuedAt: string, visitorId: string): string {
	return createHmac('sha256', deriveSubkey(SUBKEY_PURPOSES.analyticsConfirm))
		.update(`${issuedAt}:${visitorId}`)
		.digest('hex');
}

/** Mint the per-document-load token the root layout hands to the client. */
export function issueConfirmToken(visitorId: string): string {
	const issuedAt = Date.now().toString();
	return `${issuedAt}.${mac(issuedAt, visitorId)}`;
}

/**
 * Verify a token against the CURRENT connection's visitor hash. Shape-checks
 * before any crypto so garbage costs nothing; compares timing-safe after.
 */
export function verifyConfirmToken(token: string, visitorId: string): boolean {
	const dot = token.indexOf('.');
	if (dot <= 0) return false;
	const issuedAt = token.slice(0, dot);
	const givenMac = token.slice(dot + 1);
	if (!/^\d{1,16}$/.test(issuedAt) || !/^[0-9a-f]{64}$/.test(givenMac)) return false;

	const age = Date.now() - Number(issuedAt);
	if (age > CONFIRM_TOKEN_TTL_MS) return false;
	if (age < -MAX_CLOCK_SKEW_MS) return false;

	return timingSafeEqual(Buffer.from(givenMac, 'hex'), Buffer.from(mac(issuedAt, visitorId), 'hex'));
}
