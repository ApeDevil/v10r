import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineBreaker, resetBreakers } from './breaker';

// Force the in-memory fallback: deterministic, and a test that tripped a real breaker
// would cool a dependency for the running app and leak across runs. Everything asserted
// here is therefore the NO-REDIS path — which is also the path a misconfigured
// deployment runs, so it is the one worth pinning.
vi.mock('$lib/server/cache', () => ({ redis: null }));

const policy = {
	name: 'test-dependency',
	openForSeconds: 60,
	failureThreshold: 3,
	failureWindowSeconds: 60,
};

afterEach(() => {
	resetBreakers();
	vi.useRealTimers();
});

describe('trip', () => {
	it('opens immediately, without waiting for a threshold', async () => {
		const breaker = defineBreaker(policy);
		expect(await breaker.isOpen('groq')).toBe(false);

		await breaker.trip('groq');
		expect(await breaker.isOpen('groq')).toBe(true);
	});

	it('reports when it will admit traffic again', async () => {
		const breaker = defineBreaker(policy);
		const before = Date.now();
		await breaker.trip('groq', 30);

		const { open, retryAt } = await breaker.state('groq');
		expect(open).toBe(true);
		expect(retryAt).toBeGreaterThanOrEqual(before + 30_000);
	});

	it('keeps subjects independent', async () => {
		const breaker = defineBreaker(policy);
		await breaker.trip('groq');

		expect(await breaker.isOpen('openai')).toBe(false);
	});

	it('keeps breakers with different names independent', async () => {
		const ai = defineBreaker(policy);
		const search = defineBreaker({ ...policy, name: 'other-dependency' });
		await ai.trip('shared-subject');

		expect(await search.isOpen('shared-subject')).toBe(false);
	});

	it('closes once the open window lapses', async () => {
		vi.useFakeTimers();
		const breaker = defineBreaker(policy);
		await breaker.trip('groq', 30);
		expect(await breaker.isOpen('groq')).toBe(true);

		vi.setSystemTime(Date.now() + 31_000);
		expect(await breaker.isOpen('groq')).toBe(false);
		// The first caller through IS the probe — there is no half-open state to wait in.
		expect((await breaker.state('groq')).retryAt).toBeNull();
	});
});

describe('recordFailure', () => {
	it('stays closed below the threshold', async () => {
		const breaker = defineBreaker(policy);
		expect(await breaker.recordFailure('neo4j')).toBe(false);
		expect(await breaker.recordFailure('neo4j')).toBe(false);

		expect(await breaker.isOpen('neo4j')).toBe(false);
	});

	it('opens on the failure that reaches the threshold, and says so', async () => {
		const breaker = defineBreaker(policy);
		await breaker.recordFailure('neo4j');
		await breaker.recordFailure('neo4j');

		expect(await breaker.recordFailure('neo4j')).toBe(true);
		expect(await breaker.isOpen('neo4j')).toBe(true);
	});

	// A trickle of unrelated errors over hours is a healthy dependency. Without a
	// window every dependency eventually trips, which is the classic wrong breaker.
	it('forgets failures older than the window', async () => {
		vi.useFakeTimers();
		const breaker = defineBreaker(policy);
		await breaker.recordFailure('neo4j');
		await breaker.recordFailure('neo4j');

		vi.setSystemTime(Date.now() + 61_000);
		expect(await breaker.recordFailure('neo4j')).toBe(false);
		expect(await breaker.isOpen('neo4j')).toBe(false);
	});

	it('counts a success as clearing the run of failures', async () => {
		const breaker = defineBreaker(policy);
		await breaker.recordFailure('neo4j');
		await breaker.recordFailure('neo4j');
		await breaker.recordSuccess('neo4j');

		expect(await breaker.recordFailure('neo4j')).toBe(false);
	});

	// Success is evidence the count should restart, not evidence the backoff is over —
	// the open window is a promise to the dependency and closing early breaks it.
	it('does not let a success close an open breaker', async () => {
		const breaker = defineBreaker(policy);
		await breaker.trip('neo4j');
		await breaker.recordSuccess('neo4j');

		expect(await breaker.isOpen('neo4j')).toBe(true);
	});
});

describe('reset', () => {
	it('forgets both the open state and the failure count', async () => {
		const breaker = defineBreaker(policy);
		await breaker.recordFailure('neo4j');
		await breaker.trip('neo4j');

		await breaker.reset('neo4j');
		expect(await breaker.isOpen('neo4j')).toBe(false);
		expect(await breaker.recordFailure('neo4j')).toBe(false);
	});
});
