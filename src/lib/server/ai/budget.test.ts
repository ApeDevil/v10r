/**
 * The daily token budget's Redis shape: the charge is ONE pipelined round trip (INCRBY +
 * EXPIRE) — it runs on the answer path, between the last token and `finish` — and the
 * gate is one GET. Redis and `$app/environment` are mocked; nothing leaves the process.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
	const chain = { incrby: vi.fn(), expire: vi.fn(), exec: vi.fn(async () => [1, 1]) };
	chain.incrby.mockReturnValue(chain);
	chain.expire.mockReturnValue(chain);
	return { chain, redis: { get: vi.fn(), pipeline: vi.fn(() => chain) } };
});

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$lib/server/cache', () => ({ redis: fake.redis }));

const { chargeTokens, checkUserBudget } = await import('./budget');
const { DAILY_TOKEN_CAP } = await import('./config');

const today = new Date().toISOString().slice(0, 10);

describe('chargeTokens', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('charges the day key with one pipelined INCRBY + EXPIRE', async () => {
		await chargeTokens('user-1', 150);

		expect(fake.redis.pipeline).toHaveBeenCalledTimes(1);
		expect(fake.chain.incrby).toHaveBeenCalledWith(`ai:budget:user-1:${today}`, 150);
		expect(fake.chain.expire).toHaveBeenCalledWith(`ai:budget:user-1:${today}`, 25 * 60 * 60);
		expect(fake.chain.exec).toHaveBeenCalledTimes(1);
	});

	it('spends no round trip on a zero charge', async () => {
		await chargeTokens('user-1', 0);
		expect(fake.redis.pipeline).not.toHaveBeenCalled();
	});
});

describe('checkUserBudget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('allows under the cap and denies at it, from one GET', async () => {
		fake.redis.get.mockResolvedValueOnce(DAILY_TOKEN_CAP - 1);
		expect((await checkUserBudget('user-1')).allowed).toBe(true);
		fake.redis.get.mockResolvedValueOnce(DAILY_TOKEN_CAP);
		expect((await checkUserBudget('user-1')).allowed).toBe(false);
		expect(fake.redis.get).toHaveBeenCalledTimes(2);
	});
});
