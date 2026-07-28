/**
 * The per-caller correlation key: `HMAC-SHA256(MCP_TELEMETRY_SALT, ip:ua:UTC-date)`.
 *
 * ## Why keyed, and why dated
 *
 * A BARE digest of `ip:ua` is not pseudonymisation, it is obfuscation. The IPv4 space is 2^32 and
 * the set of real User-Agent strings is small, so anyone holding the table can enumerate the whole
 * input space in minutes and recover the IP. Keying with a secret they do not hold is what makes
 * the value actually opaque; the UTC date bounds how long any single key can accumulate behaviour.
 *
 * The salt must ROTATE (monthly is enough) and the old value must be destroyed. A rotating input
 * with a permanent key still lets the key-holder re-derive any past day for a known IP and walk the
 * full retention window — rotation of the key is what closes that.
 *
 * ## What it is not
 *
 * FORGEABLE UPWARD. The User-Agent is free text with no distinctness limit, so one caller can mint
 * unlimited distinct keys by varying a header. Therefore:
 *   - `count(DISTINCT client_key)` must NEVER be labelled "number of consumers";
 *   - a caller who wants to be invisible simply varies its UA and vanishes from any top-N panel;
 *   - this table is not security telemetry and must not be used as such.
 *
 * What the key IS good for is the >=3-distinct-caller threshold that gates display of retained
 * query text. That threshold does double duty — k-anonymity over third-party text, and the
 * anti-poisoning control that stops one caller manufacturing the top "capability gap" with a loop.
 *
 * ## Failure mode
 *
 * FAIL OPEN ON THE COLUMN, NEVER ON THE ROW. A missing salt or a crypto failure yields `null`, and
 * the row still writes. The alternative — a NOT NULL column — would turn an unset environment
 * variable into a write failure on the request path, which is a self-inflicted availability bug in
 * service of an analytics nicety.
 */
import { createHmac } from 'node:crypto';

/** Prefix makes the value self-describing in a query result and un-confusable with other hashes. */
const KEY_PREFIX = 'm_';

/** 128 bits of the digest. Enough to make collisions irrelevant at any volume this will ever see. */
const KEY_HEX_LENGTH = 32;

/** UTC so the rotation boundary does not move with deployment region. */
function utcDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/**
 * Derive the day-scoped caller key, or null when it cannot be derived.
 *
 * Deliberately synchronous and dependency-free: it runs on the request path, and an async hash
 * would be one more thing that can be forgotten to await.
 */
export function deriveClientKey(
	ip: string | null,
	userAgent: string | null,
	salt: string | undefined,
	now: Date,
): string | null {
	if (!salt || !ip) return null;
	try {
		const digest = createHmac('sha256', salt)
			.update(`${ip}:${userAgent ?? ''}:${utcDay(now)}`)
			.digest('hex');
		return `${KEY_PREFIX}${digest.slice(0, KEY_HEX_LENGTH)}`;
	} catch {
		// Fail open on the column. A telemetry key is never worth failing a request over.
		return null;
	}
}
