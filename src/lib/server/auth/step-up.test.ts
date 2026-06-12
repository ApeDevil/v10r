/**
 * Step-up freshness contracts:
 * 1. A stamp makes the gate pass; absence makes it fail.
 * 2. Redis unavailable → dev passes (warn), prod FAILS CLOSED.
 * 3. requireStepUp bypasses entirely for users without TOTP enrolled.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

async function loadWith(opts: { redis: unknown; dev: boolean }) {
	vi.doMock('$lib/server/cache', () => ({ redis: opts.redis }));
	vi.doMock('$app/environment', () => ({ dev: opts.dev, building: false, browser: false }));
	return import('./step-up');
}

function fakeRedis(store = new Map<string, unknown>()) {
	return {
		store,
		set: vi.fn(async (key: string, value: unknown) => {
			store.set(key, value);
			return 'OK';
		}),
		exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
	};
}

describe('step-up freshness', () => {
	it('passes after a stamp and fails without one', async () => {
		const redis = fakeRedis();
		const { stampStepUp, isStepUpFresh } = await loadWith({ redis, dev: false });

		expect(await isStepUpFresh('usr_1')).toBe(false);

		await stampStepUp('usr_1');
		expect(redis.set).toHaveBeenCalledWith('stepup:usr_1', expect.any(Number), { ex: expect.any(Number) });
		expect(await isStepUpFresh('usr_1')).toBe(true);

		// Other users remain unstamped
		expect(await isStepUpFresh('usr_2')).toBe(false);
	});

	it('fails CLOSED in prod when Redis is unavailable', async () => {
		const { isStepUpFresh, stampStepUp } = await loadWith({ redis: null, dev: false });

		await expect(stampStepUp('usr_1')).resolves.toBeUndefined();
		expect(await isStepUpFresh('usr_1')).toBe(false);
	});

	it('passes through in dev when Redis is unavailable', async () => {
		const { isStepUpFresh } = await loadWith({ redis: null, dev: true });
		expect(await isStepUpFresh('usr_1')).toBe(true);
	});
});

describe('requireStepUp', () => {
	it('bypasses the gate for users without TOTP enrolled', async () => {
		const redis = fakeRedis();
		const { requireStepUp } = await loadWith({ redis, dev: false });

		expect(await requireStepUp({ id: 'usr_1', twoFactorEnabled: false })).toBe(true);
		expect(await requireStepUp({ id: 'usr_1', twoFactorEnabled: null })).toBe(true);
		expect(await requireStepUp({ id: 'usr_1' })).toBe(true);
		expect(redis.exists).not.toHaveBeenCalled();
	});

	it('requires a fresh stamp for enrolled users', async () => {
		const redis = fakeRedis();
		const { requireStepUp, stampStepUp } = await loadWith({ redis, dev: false });

		expect(await requireStepUp({ id: 'usr_1', twoFactorEnabled: true })).toBe(false);

		await stampStepUp('usr_1');
		expect(await requireStepUp({ id: 'usr_1', twoFactorEnabled: true })).toBe(true);
	});
});
