/**
 * Stateless signed tickets — bind a set of server-chosen facts to a principal
 * for a bounded time, with no row to write and nothing to clean up.
 *
 * The motivating case is presigned upload issuance: the server hands a client a
 * key it will present back later, and needs to know at that later moment that
 * THIS caller is the one the key was issued to, and that the constraints
 * decided at issuance still apply. A database table would work; a MAC over the
 * facts works without DDL and without a second thing to keep consistent.
 *
 * Format: `base64url(payload).base64url(hmac)` where
 * `hmac = HMAC-SHA256(subkey(purpose), payloadBytes)`.
 *
 * Two properties are load-bearing:
 *
 *  1. **The separator cannot occur inside a field.** base64url's alphabet has
 *     no `.`, so `split('.')` yielding exactly two parts is unambiguous for any
 *     field content whatsoever. `pairing/cookie.ts` deliberately is NOT reused
 *     here: its format is `${userId}.${expMs}.${sig}` verified by a 3-part
 *     split, so any id containing a dot fails to verify. That is safe for the
 *     ids it actually sees and not a property worth inheriting into a general
 *     primitive.
 *
 *  2. **The signature covers the received bytes, not a re-serialization.** We
 *     verify first and `JSON.parse` second, so no canonicalization question
 *     arises and untrusted structure is never parsed before it is authenticated.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { deriveSubkey, type SubkeyPurpose } from './subkey';

export type TicketFields = Record<string, string | number>;

export type TicketCheck<T extends TicketFields = TicketFields> =
	| { ok: true; fields: T; expiresAt: number }
	| { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_purpose' };

/** SHA-256 output width. A signature of any other length is malformed, not merely wrong. */
const SIG_BYTES = 32;

function sign(purpose: SubkeyPurpose, payload: Buffer): Buffer {
	return createHmac('sha256', deriveSubkey(purpose)).update(payload).digest();
}

/**
 * Issue a ticket. `expiresAt` is epoch milliseconds and is signed along with
 * the fields, so a client cannot extend its own validity.
 */
export function signTicket(purpose: SubkeyPurpose, fields: TicketFields, expiresAt: number): string {
	const payload = Buffer.from(JSON.stringify({ p: purpose, e: expiresAt, f: fields }), 'utf8');
	return `${payload.toString('base64url')}.${sign(purpose, payload).toString('base64url')}`;
}

/**
 * Verify a ticket and return its fields.
 *
 * `now` is injectable so expiry is testable without touching the clock — the
 * suite runs PGlite in-process on the host clock, so a real-time-dependent
 * assertion here would be untestable rather than merely awkward.
 */
export function verifyTicket<T extends TicketFields = TicketFields>(
	purpose: SubkeyPurpose,
	raw: string,
	now: number = Date.now(),
): TicketCheck<T> {
	const parts = raw.split('.');
	if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };

	const payload = Buffer.from(parts[0], 'base64url');
	const signature = Buffer.from(parts[1], 'base64url');
	// base64url decoding is lenient about stray characters, so length is the
	// real structural check. A short signature would otherwise reach
	// timingSafeEqual, which throws on a length mismatch.
	if (payload.length === 0 || signature.length !== SIG_BYTES) return { ok: false, reason: 'malformed' };

	if (!timingSafeEqual(sign(purpose, payload), signature)) return { ok: false, reason: 'bad_signature' };

	// Authenticated — only now is this safe to interpret as structure.
	let decoded: unknown;
	try {
		decoded = JSON.parse(payload.toString('utf8'));
	} catch {
		return { ok: false, reason: 'malformed' };
	}
	if (typeof decoded !== 'object' || decoded === null) return { ok: false, reason: 'malformed' };

	const { p, e, f } = decoded as { p?: unknown; e?: unknown; f?: unknown };
	// A ticket for another purpose already fails the signature check, since each
	// purpose derives its own key. This is the second lock on the same door.
	if (p !== purpose) return { ok: false, reason: 'wrong_purpose' };
	if (typeof e !== 'number' || !Number.isFinite(e)) return { ok: false, reason: 'malformed' };
	if (typeof f !== 'object' || f === null || Array.isArray(f)) return { ok: false, reason: 'malformed' };
	for (const value of Object.values(f as Record<string, unknown>)) {
		if (typeof value !== 'string' && typeof value !== 'number') return { ok: false, reason: 'malformed' };
	}

	if (e <= now) return { ok: false, reason: 'expired' };

	return { ok: true, fields: f as T, expiresAt: e };
}
