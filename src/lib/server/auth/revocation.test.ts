import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The revocation epoch exists to close the `cookieCache` window: deleting
 * session rows is invisible to `getSession()` for up to SESSION_COOKIE_MAX_AGE.
 * These tests pin the decision logic, especially the spared-token carve-out —
 * without it, `revokeSiblings` would sign out the device that just secured the
 * account.
 */

const store = new Map<string, string>();

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$lib/server/config', () => ({ SESSION_EXPIRES_IN: 604800 }));
vi.mock('$lib/server/cache', () => ({
	redis: {
		get: async (k: string) => store.get(k) ?? null,
		set: async (k: string, v: string) => void store.set(k, v),
		del: async (k: string) => void store.delete(k),
	},
}));

const { clearRevocation, isSessionRevoked, stampRevocation } = await import('./revocation');

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

beforeEach(() => store.clear());

describe('revocation epoch', () => {
	it('treats a session as live when no epoch exists', async () => {
		expect(await isSessionRevoked('u1', new Date(), 'tok')).toBe(false);
	});

	it('revokes sessions created before the epoch', async () => {
		const old = new Date(Date.now() - 60_000);
		await stampRevocation('u1');
		expect(await isSessionRevoked('u1', old, 'tok')).toBe(true);
	});

	it('leaves sessions created after the epoch alone', async () => {
		await stampRevocation('u1');
		const fresh = new Date(Date.now() + 60_000);
		expect(await isSessionRevoked('u1', fresh, 'tok')).toBe(false);
	});

	// The carve-out that makes revokeSiblings survivable for the acting device.
	it('spares the kept token even though it predates the epoch', async () => {
		const old = new Date(Date.now() - 60_000);
		await stampRevocation('u1', 'keep-me');
		expect(await isSessionRevoked('u1', old, 'keep-me')).toBe(false);
		expect(await isSessionRevoked('u1', old, 'other-device')).toBe(true);
	});

	it('stores a token hash, never the raw token', async () => {
		await stampRevocation('u1', 'super-secret-token');
		const raw = store.get('authepoch:u1') ?? '';
		expect(raw).not.toContain('super-secret-token');
		expect(raw).toContain(hash('super-secret-token'));
	});

	it('scopes epochs per user', async () => {
		const old = new Date(Date.now() - 60_000);
		await stampRevocation('u1');
		expect(await isSessionRevoked('u2', old, 'tok')).toBe(false);
	});

	it('resolves an unknown creation time to revoked', async () => {
		await stampRevocation('u1');
		expect(await isSessionRevoked('u1', null, 'tok')).toBe(true);
	});

	it('clearRevocation lets the user back in (unban path)', async () => {
		const old = new Date(Date.now() - 60_000);
		await stampRevocation('u1');
		expect(await isSessionRevoked('u1', old, 'tok')).toBe(true);
		await clearRevocation('u1');
		expect(await isSessionRevoked('u1', old, 'tok')).toBe(false);
	});
});
