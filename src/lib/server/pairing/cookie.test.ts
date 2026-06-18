/**
 * The debug-owner cookie is an HMAC marker that attributes a (logged-out) phone
 * session to an admin for the live analytics feed. verifyOwnerCookie must reject
 * any tampering, expiry, malformed input, or a cookie signed with another secret.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

async function loadWith(secret: string | undefined) {
	vi.doMock('$env/dynamic/private', () => ({ env: { PAIRING_SECRET: secret } }));
	return import('./cookie');
}

const future = () => Date.now() + 100_000;

describe('verifyOwnerCookie', () => {
	it('round-trips a freshly signed cookie', async () => {
		const { signOwnerCookie, verifyOwnerCookie } = await loadWith('secret-a');
		const exp = future();
		const cookie = await signOwnerCookie('usr_admin', exp);
		expect(await verifyOwnerCookie(cookie)).toEqual({ adminUserId: 'usr_admin', expiresAt: exp });
	});

	it('rejects a tampered user id', async () => {
		const { signOwnerCookie, verifyOwnerCookie } = await loadWith('secret-a');
		const cookie = await signOwnerCookie('usr_admin', future());
		const [, exp, sig] = cookie.split('.');
		expect(await verifyOwnerCookie(`usr_attacker.${exp}.${sig}`)).toBeNull();
	});

	it('rejects a flipped signature byte', async () => {
		const { signOwnerCookie, verifyOwnerCookie } = await loadWith('secret-a');
		const cookie = await signOwnerCookie('usr_admin', future());
		const [id, exp, sig] = cookie.split('.');
		const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
		expect(await verifyOwnerCookie(`${id}.${exp}.${flipped}`)).toBeNull();
	});

	it('rejects an expired cookie', async () => {
		const { signOwnerCookie, verifyOwnerCookie } = await loadWith('secret-a');
		const cookie = await signOwnerCookie('usr_admin', Date.now() - 1);
		expect(await verifyOwnerCookie(cookie)).toBeNull();
	});

	it('rejects malformed shapes and non-hex signatures', async () => {
		const { verifyOwnerCookie } = await loadWith('secret-a');
		expect(await verifyOwnerCookie('only.two')).toBeNull();
		expect(await verifyOwnerCookie('a.b.c.d')).toBeNull();
		expect(await verifyOwnerCookie(`usr.${future()}.zzzz`)).toBeNull(); // non-hex
		expect(await verifyOwnerCookie(`usr.${future()}.abc`)).toBeNull(); // odd-length hex
		expect(await verifyOwnerCookie(`usr.notanumber.00`)).toBeNull();
	});
});
