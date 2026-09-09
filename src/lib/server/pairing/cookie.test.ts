/**
 * The debug-owner cookie attributes a (logged-out) phone session to an admin for the live
 * analytics feed. `verifyOwnerCookie` must reject tampering, expiry, malformed input, and a
 * cookie signed under different key material.
 *
 * The cookie is now a `security/ticket`, so the MAC construction and the malformed-shape
 * matrix are proven once in `security/ticket.test.ts` and not restated here. What is left is
 * what this module owns: that it signs and verifies under its OWN subkey purpose, that expiry
 * is enforced through the wrapper, and that it returns `null` rather than a partial payload.
 *
 * Key material comes from `deriveSubkey`, which memoizes per purpose in module scope — hence
 * `resetSubkeyCache()` between cases, the same convention as `security/ticket.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSubkeyCache } from '$lib/server/security';
import { signOwnerCookie, verifyOwnerCookie } from './cookie';

const ROOT = 'test-root-secret-at-least-32-characters-long';

beforeEach(() => {
	process.env.BETTER_AUTH_SECRET = ROOT;
	delete process.env.PAIRING_SECRET;
	resetSubkeyCache();
});

afterEach(() => {
	delete process.env.PAIRING_SECRET;
	resetSubkeyCache();
});

const future = () => Date.now() + 100_000;

describe('verifyOwnerCookie', () => {
	it('round-trips a freshly signed cookie', () => {
		const exp = future();
		expect(verifyOwnerCookie(signOwnerCookie('usr_admin', exp))).toEqual({
			adminUserId: 'usr_admin',
			expiresAt: exp,
		});
	});

	// The old format was `${userId}.${expMs}.${sig}` verified by a 3-part split, so an id
	// containing a dot could never verify. base64url has no '.' in its alphabet.
	it('round-trips an admin id containing the separator', () => {
		const exp = future();
		expect(verifyOwnerCookie(signOwnerCookie('usr.admin.v2', exp))).toEqual({
			adminUserId: 'usr.admin.v2',
			expiresAt: exp,
		});
	});

	it('rejects a tampered payload', () => {
		const [payload, sig] = signOwnerCookie('usr_admin', future()).split('.');
		const forged = Buffer.from(
			JSON.stringify({ p: 'v10r:pairing-owner:v1', e: future(), f: { adminUserId: 'usr_attacker' } }),
			'utf8',
		).toString('base64url');
		expect(forged).not.toBe(payload);
		expect(verifyOwnerCookie(`${forged}.${sig}`)).toBeNull();
	});

	it('rejects a flipped signature character', () => {
		const [payload, sig] = signOwnerCookie('usr_admin', future()).split('.');
		const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
		expect(verifyOwnerCookie(`${payload}.${flipped}`)).toBeNull();
	});

	it('rejects an expired cookie', () => {
		expect(verifyOwnerCookie(signOwnerCookie('usr_admin', Date.now() - 1))).toBeNull();
	});

	it('rejects a cookie signed under a rotated key', () => {
		const cookie = signOwnerCookie('usr_admin', future());
		process.env.PAIRING_SECRET = 'a-different-override-key';
		resetSubkeyCache();
		expect(verifyOwnerCookie(cookie)).toBeNull();
	});

	// A ticket for another purpose derives a different key, so it fails the MAC — this pins
	// that the pairing cookie cannot be minted by any other ticket-issuing subsystem.
	it('rejects a ticket issued for a different purpose', async () => {
		const { signTicket, SUBKEY_PURPOSES } = await import('$lib/server/security');
		const foreign = signTicket(SUBKEY_PURPOSES.blogUploadTicket, { adminUserId: 'usr_admin' }, future());
		expect(verifyOwnerCookie(foreign)).toBeNull();
	});

	it('returns null rather than a partial payload on malformed input', () => {
		for (const raw of ['', '.', 'only-one-part', 'a.b.c', 'not-base64url!.QUJD']) {
			expect(verifyOwnerCookie(raw), raw).toBeNull();
		}
	});
});
