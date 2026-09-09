import { describe, expect, it, vi } from 'vitest';
import { startRequestTiming } from '$lib/server/http/request-timing';
import { isVelocityMeasurementId, VELOCITY_MEASUREMENT_IDS } from '$lib/showcases/velocity/measurement';
import {
	BREAKER_CALLERS,
	BREAKER_THRESHOLD,
	CHAIN_STEPS,
	ORIGIN_MS,
	runVelocityMeasurement,
	SLOW_CALLERS,
	STAMPEDE_CALLERS,
} from './measurements';

/** Every measurement records into the request's tracer; tests supply a standalone one. */
const run = (id: Parameters<typeof runVelocityMeasurement>[0]) => runVelocityMeasurement(id, startRequestTiming());

vi.mock('$lib/server/cache/client', () => ({ redis: null }));
vi.mock('$lib/server/http/after-response', () => ({ deferAfterResponse: vi.fn() }));

describe('isVelocityMeasurementId', () => {
	it('accepts every declared id and nothing else', () => {
		for (const id of VELOCITY_MEASUREMENT_IDS) expect(isVelocityMeasurementId(id)).toBe(true);
		expect(isVelocityMeasurementId('drop-table')).toBe(false);
		expect(isVelocityMeasurementId(7)).toBe(false);
	});
});

describe('runVelocityMeasurement', () => {
	it('removes the waiting from independent work without changing the work', async () => {
		const result = await run('waterfall');

		// The claim the page makes: ~4x on the clock, identical cost upstream.
		expect(result.naive.ms).toBeGreaterThan(result.velocity.ms * 2);
		expect(result.naive.originCalls).toBe(4);
		expect(result.velocity.originCalls).toBe(4);
	});

	it('computes once for three cached reads', async () => {
		const result = await run('cache');

		expect(result.naive.originCalls).toBe(3);
		expect(result.velocity.originCalls).toBe(1);
		expect(result.velocity.ms).toBeLessThan(result.naive.ms);
		expect(result.detail.join(' ')).toContain('origin');
	});

	it('collapses a stampede to a single rebuild', async () => {
		const result = await run('stampede');

		expect(result.naive.originCalls).toBe(STAMPEDE_CALLERS);
		expect(result.velocity.originCalls).toBe(1);
	});

	it('measures only what the caller waited for on the deferred arm', async () => {
		const result = await run('tail');

		expect(result.velocity.originCalls).toBe(1);
		expect(result.naive.originCalls).toBe(4);
		// One dependency call, so the critical arm cannot be much above one unit.
		expect(result.velocity.ms).toBeLessThan(ORIGIN_MS * 2);
	});

	it('serves a stale value without touching the origin, and defers the refresh', async () => {
		const result = await run('swr');

		// The caller waited for nothing: no origin call on the velocity arm.
		expect(result.velocity.originCalls).toBe(0);
		expect(result.naive.originCalls).toBe(1);
		expect(result.velocity.ms).toBeLessThan(ORIGIN_MS);
		expect(result.detail.join(' ')).toContain('stale: true');
	});

	it('reports the tracer spans that produced its numbers', async () => {
		const result = await run('waterfall');

		// The page's two figures and the response's Server-Timing header are one
		// measurement, not two clocks that happen to agree.
		expect(result.spans?.map((s) => s.name)).toEqual(['naive', 'velocity']);
		expect(result.spans?.[0].ms).toBe(result.naive.ms);
		expect(result.spans?.[1].ms).toBe(result.velocity.ms);
	});

	it('stops calling a dependency that has already failed', async () => {
		const result = await run('breaker');

		expect(result.naive.originCalls).toBe(BREAKER_CALLERS);
		// Three failures to learn it is down, then nobody else pays to relearn it.
		expect(result.velocity.originCalls).toBe(BREAKER_THRESHOLD);
		expect(result.velocity.ms).toBeLessThan(result.naive.ms);
	});

	it("keeps a fast capability out of a slow one's queue", async () => {
		const result = await run('bulkhead');

		// Same calls, same work — the isolation changes who waits, not what runs.
		expect(result.naive.originCalls).toBe(SLOW_CALLERS + 1);
		expect(result.velocity.originCalls).toBe(SLOW_CALLERS + 1);
		expect(result.velocity.ms).toBeLessThan(result.naive.ms);
	});

	it('bounds a chain by one budget instead of the sum of its timeouts', async () => {
		const result = await run('deadline');

		expect(result.naive.originCalls).toBe(CHAIN_STEPS);
		// The last step never started: there was no time left to use its result.
		expect(result.velocity.originCalls).toBeLessThan(CHAIN_STEPS);
		expect(result.velocity.ms).toBeLessThan(result.naive.ms);
	});

	it('always reports both arms and a caveat', async () => {
		// Concurrently, the way the page's "run everything" does: run in series this sums
		// past half the 5s unit budget once `swr` has to wait out a real TTL, and a test
		// that flakes under load is worse than no test.
		const results = await Promise.all(VELOCITY_MEASUREMENT_IDS.map((id) => run(id)));

		for (const [i, result] of results.entries()) {
			expect(result.id).toBe(VELOCITY_MEASUREMENT_IDS[i]);
			expect(result.naive.label).toBeTruthy();
			expect(result.velocity.label).toBeTruthy();
			// A measurement with no stated limits is a claim, not evidence.
			expect(result.detail.length).toBeGreaterThanOrEqual(2);
		}
	});
});
