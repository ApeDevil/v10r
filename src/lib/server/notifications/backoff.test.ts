import { describe, expect, it } from 'vitest';
import { backoffMs, decideFailure, jitter } from './backoff';
import {
	DELIVERY_MAX_ATTEMPTS,
	DELIVERY_RETRY_BASE_MS,
	DELIVERY_RETRY_FACTOR,
	DELIVERY_RETRY_JITTER,
	DELIVERY_RETRY_MAX_MS,
} from './config';

describe('backoffMs', () => {
	it('starts at the base delay', () => {
		expect(backoffMs(1)).toBe(DELIVERY_RETRY_BASE_MS);
	});

	it('grows by the factor each attempt', () => {
		expect(backoffMs(2)).toBe(DELIVERY_RETRY_BASE_MS * DELIVERY_RETRY_FACTOR);
		expect(backoffMs(3)).toBe(DELIVERY_RETRY_BASE_MS * DELIVERY_RETRY_FACTOR ** 2);
	});

	it('is strictly increasing until it clamps', () => {
		let prev = 0;
		for (let n = 1; n <= 4; n++) {
			const cur = backoffMs(n);
			expect(cur).toBeGreaterThan(prev);
			prev = cur;
		}
	});

	it('clamps at the ceiling', () => {
		expect(backoffMs(50)).toBe(DELIVERY_RETRY_MAX_MS);
		expect(backoffMs(1000)).toBe(DELIVERY_RETRY_MAX_MS);
	});

	it('treats zero and negative attempts as the first attempt', () => {
		// Guards against a negative exponent producing a fractional delay.
		expect(backoffMs(0)).toBe(DELIVERY_RETRY_BASE_MS);
		expect(backoffMs(-3)).toBe(DELIVERY_RETRY_BASE_MS);
	});

	it('floors fractional attempts', () => {
		expect(backoffMs(2.9)).toBe(backoffMs(2));
	});
});

describe('jitter', () => {
	it('spans the full band deterministically', () => {
		expect(jitter(1000, () => 0)).toBe(Math.round(1000 * (1 - DELIVERY_RETRY_JITTER)));
		expect(jitter(1000, () => 1)).toBe(Math.round(1000 * (1 + DELIVERY_RETRY_JITTER)));
		expect(jitter(1000, () => 0.5)).toBe(1000);
	});

	it('never goes negative', () => {
		expect(jitter(0, () => 0)).toBe(0);
	});
});

describe('decideFailure', () => {
	const rand = () => 0.5; // no jitter offset

	it('is permanently failed when the channel says it is not retryable', () => {
		// Regardless of remaining budget — retrying a blocked bot or a bad address
		// is pointless, so it must NOT land in the retry-button panel.
		expect(decideFailure({ attempts: 1, retryable: false, rand })).toEqual({ status: 'failed' });
		expect(decideFailure({ attempts: DELIVERY_MAX_ATTEMPTS, retryable: false, rand })).toEqual({
			status: 'failed',
		});
	});

	it('requeues with backoff while budget remains', () => {
		const decision = decideFailure({ attempts: DELIVERY_MAX_ATTEMPTS - 1, retryable: true, rand });
		expect(decision.status).toBe('pending');
		expect(decision).toHaveProperty('delayMs', backoffMs(DELIVERY_MAX_ATTEMPTS - 1));
	});

	it('applies the base delay on the first failure', () => {
		expect(decideFailure({ attempts: 1, retryable: true, rand })).toEqual({
			status: 'pending',
			delayMs: DELIVERY_RETRY_BASE_MS,
		});
	});

	it('dead-letters a retryable failure once the budget is spent', () => {
		// attempts is post-increment, so `=== MAX` means the last allowed send just failed.
		expect(decideFailure({ attempts: DELIVERY_MAX_ATTEMPTS, retryable: true, rand })).toEqual({
			status: 'dead',
		});
		expect(decideFailure({ attempts: DELIVERY_MAX_ATTEMPTS + 1, retryable: true, rand })).toEqual({
			status: 'dead',
		});
	});

	it('makes exactly DELIVERY_MAX_ATTEMPTS sends before dying', () => {
		const outcomes = Array.from(
			{ length: DELIVERY_MAX_ATTEMPTS },
			(_, i) => decideFailure({ attempts: i + 1, retryable: true, rand }).status,
		);
		expect(outcomes.slice(0, -1).every((s) => s === 'pending')).toBe(true);
		expect(outcomes.at(-1)).toBe('dead');
	});
});
