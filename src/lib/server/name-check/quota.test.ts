import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetLocalQuota, takeDailyQuota } from './quota';

vi.mock('$lib/server/cache/client', () => ({ redis: null }));

afterEach(() => resetLocalQuota());

describe('takeDailyQuota (no Redis)', () => {
	it('allows up to the limit and refuses past it', async () => {
		const day = new Date('2026-09-16T08:00:00Z');
		expect(await takeDailyQuota('web', 2, day)).toBe(true);
		expect(await takeDailyQuota('web', 2, day)).toBe(true);
		expect(await takeDailyQuota('web', 2, day)).toBe(false);
	});

	it('counts each source and each UTC day separately', async () => {
		const monday = new Date('2026-09-14T23:30:00Z');
		const tuesday = new Date('2026-09-15T00:30:00Z');
		expect(await takeDailyQuota('web', 1, monday)).toBe(true);
		expect(await takeDailyQuota('web', 1, monday)).toBe(false);
		expect(await takeDailyQuota('gleif', 1, monday)).toBe(true);
		expect(await takeDailyQuota('web', 1, tuesday)).toBe(true);
	});
});
