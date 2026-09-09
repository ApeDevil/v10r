import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, clearLocalCache, definePolicy, LOCAL_MAX_ENTRIES, readTiered, writeTiered } from './tiered';

// No Redis: the local tier and the degradation path are what these assertions are about.
vi.mock('./client', () => ({ redis: null }));

const shared = definePolicy({ namespace: 'showcase-stats', ttl: 60, scope: 'shared' });
const perUser = definePolicy({ namespace: 'inbox', ttl: 60, scope: 'per-user' });

describe('definePolicy', () => {
	it('defaults staleFor to 0 — serving stale is an explicit choice', () => {
		expect(shared.staleFor).toBe(0);
	});

	it('leaves the local tier off for per-user values unless asked', () => {
		expect(shared.local).toBe(true);
		expect(perUser.local).toBe(false);
		expect(definePolicy({ namespace: 'inbox', ttl: 60, scope: 'per-user', local: true }).local).toBe(true);
	});

	it('refuses a namespace that is not kebab-case', () => {
		expect(() => definePolicy({ namespace: 'Showcase Stats', ttl: 60, scope: 'shared' })).toThrow(/kebab-case/);
	});

	it('refuses a policy with no positive ttl', () => {
		expect(() => definePolicy({ namespace: 'x', ttl: 0, scope: 'shared' })).toThrow(/positive ttl/);
	});
});

describe('cacheKey', () => {
	it('refuses a per-user key with no owner', () => {
		// Without this the same key answers every user — a leak, not a miss.
		expect(() => cacheKey(perUser, { id: 'unread' })).toThrow(/read by everyone/);
	});

	it('refuses an owner on a shared policy', () => {
		// The dangerous direction: a personal value parked under a namespace others read.
		expect(() => cacheKey(shared, { id: 'totals', owner: 'u1' })).toThrow(/scope is wrong/);
	});

	it('puts the owner in the key so two users cannot collide', () => {
		expect(cacheKey(perUser, { id: 'unread', owner: 'u1' })).toBe('cache:inbox:u1:unread');
		expect(cacheKey(perUser, { id: 'unread', owner: 'u2' })).toBe('cache:inbox:u2:unread');
	});

	it('namespaces away from the hand-rolled key families', () => {
		expect(cacheKey(shared, { id: 'totals' }).startsWith('cache:')).toBe(true);
	});
});

describe('local tier', () => {
	beforeEach(clearLocalCache);

	it('reads back what it wrote', async () => {
		const key = cacheKey(shared, { id: 'totals' });
		await writeTiered(shared, key, { rows: 3 });

		const hit = await readTiered<{ rows: number }>(shared, key);
		expect(hit).toMatchObject({ value: { rows: 3 }, tier: 'local', fresh: true });
	});

	it('misses for a key that was never written', async () => {
		expect(await readTiered(shared, cacheKey(shared, { id: 'absent' }))).toBeNull();
	});

	it('reports a value past its TTL as stale rather than dropping it', async () => {
		const policy = definePolicy({ namespace: 'feed', ttl: 1, staleFor: 3600, scope: 'shared', jitter: 0 });
		const key = cacheKey(policy, { id: 'latest' });
		await writeTiered(policy, key, 'old');

		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
		const hit = await readTiered<string>(policy, key);
		vi.restoreAllMocks();

		expect(hit).toMatchObject({ value: 'old', fresh: false });
	});

	it('drops a value past TTL + staleFor entirely', async () => {
		const policy = definePolicy({ namespace: 'feed', ttl: 1, staleFor: 1, scope: 'shared', jitter: 0 });
		const key = cacheKey(policy, { id: 'latest' });
		await writeTiered(policy, key, 'old');

		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
		const hit = await readTiered(policy, key);
		vi.restoreAllMocks();

		expect(hit).toBeNull();
	});

	it('evicts the oldest entry rather than growing without bound', async () => {
		for (let i = 0; i < LOCAL_MAX_ENTRIES + 5; i++) {
			await writeTiered(shared, cacheKey(shared, { id: `k${i}` }), i);
		}

		expect(await readTiered(shared, cacheKey(shared, { id: 'k0' }))).toBeNull();
		expect(await readTiered(shared, cacheKey(shared, { id: `k${LOCAL_MAX_ENTRIES + 4}` }))).not.toBeNull();
	});

	it('stays out of memory when the policy says local: false and Redis is absent', async () => {
		const key = cacheKey(perUser, { id: 'unread', owner: 'u1' });
		await writeTiered(perUser, key, 7);

		// Nowhere to store it — and a miss is always correct, only slower.
		expect(await readTiered(perUser, key)).toBeNull();
	});

	it('jitters the freshness horizon so sibling keys do not expire together', async () => {
		// Pinned, not sampled. The obvious version writes N keys and asserts the horizons
		// differ, which passes ~96% of the time and fails the rest — a flake in the gate is
		// worse than no test. Driving Math.random to its two extremes makes the spread an
		// assertion instead of an observation.
		const policy = definePolicy({ namespace: 'feed', ttl: 100, scope: 'shared' });
		const shortest = cacheKey(policy, { id: 'a' });
		const longest = cacheKey(policy, { id: 'b' });

		vi.spyOn(Math, 'random').mockReturnValue(0);
		await writeTiered(policy, shortest, 'a'); // ttl = 100 - 5 + 0 = 95
		vi.spyOn(Math, 'random').mockReturnValue(0.999);
		await writeTiered(policy, longest, 'b'); // ttl = 100 - 5 + ~10 = 105
		vi.restoreAllMocks();

		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 100_000);
		const a = await readTiered(policy, shortest);
		const b = await readTiered(policy, longest);
		vi.restoreAllMocks();

		// Same policy, same instant, different verdicts — which is the whole point: a burst
		// of keys written together does not become a burst of misses together.
		expect(a).toBeNull();
		expect(b).not.toBeNull();
	});
});
