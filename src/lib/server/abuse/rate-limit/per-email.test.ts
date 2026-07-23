import { beforeEach, describe, expect, it, vi } from 'vitest';

const { peek, limit } = vi.hoisted(() => ({ peek: vi.fn(), limit: vi.fn() }));

vi.mock('$lib/server/api/rate-limit', () => ({
	createLimiter: () => ({ peek, limit }),
}));

import { checkEmailRateLimit, recordEmailSend } from './per-email';

beforeEach(() => {
	peek.mockReset();
	limit.mockReset();
});

describe('checkEmailRateLimit', () => {
	it('allows when quota remains — without consuming a slot', async () => {
		peek.mockResolvedValue({ remaining: 3, reset: Date.now() + 60_000 });
		const decision = await checkEmailRateLimit('user@example.com');
		expect(decision.allowed).toBe(true);
		expect(limit).not.toHaveBeenCalled();
	});

	it('denies 429 when exhausted — still without consuming a slot', async () => {
		// Regression pin: counting denied attempts refills the sliding window,
		// so a user retrying while limited could never escape the lockout.
		peek.mockResolvedValue({ remaining: 0, reset: Date.now() + 30 * 60_000 });
		const decision = await checkEmailRateLimit('user@example.com');
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) {
			expect(decision.status).toBe(429);
			expect(decision.retryAfterMs).toBeGreaterThan(0);
		}
		expect(limit).not.toHaveBeenCalled();
	});

	it('denies an empty email without touching the limiter', async () => {
		const decision = await checkEmailRateLimit('   ');
		expect(decision.allowed).toBe(false);
		expect(peek).not.toHaveBeenCalled();
		expect(limit).not.toHaveBeenCalled();
	});
});

describe('recordEmailSend', () => {
	it('consumes a slot under the same key the check peeks', async () => {
		peek.mockResolvedValue({ remaining: 5, reset: 0 });
		limit.mockResolvedValue({ success: true, reset: 0 });

		await checkEmailRateLimit('  User@Example.COM ');
		await recordEmailSend('user@example.com');

		expect(limit).toHaveBeenCalledTimes(1);
		// Normalization (trim + lowercase) must agree between peek and record,
		// or sends would count against a different bucket than the one enforced.
		expect(limit.mock.calls[0][0]).toBe(peek.mock.calls[0][0]);
	});
});
