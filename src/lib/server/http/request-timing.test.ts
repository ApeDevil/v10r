import { describe, expect, it } from 'vitest';
import { MAX_SPANS, type RequestTiming, startRequestTiming, toServerTimingHeader } from './request-timing';

/** Spans record real elapsed time, so a test that asserts a number needs a real gap. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('startRequestTiming', () => {
	it('returns the work result and records a span for it', async () => {
		const timing = startRequestTiming();
		const result = await timing.span('db', async () => {
			await sleep(5);
			return 'rows';
		});

		expect(result).toBe('rows');
		expect(timing.spans).toHaveLength(1);
		expect(timing.spans[0].name).toBe('db');
		expect(timing.spans[0].duration).toBeGreaterThan(0);
	});

	it('records the span even when the work throws', async () => {
		const timing = startRequestTiming();

		await expect(
			timing.span('redis', async () => {
				throw new Error('down');
			}),
		).rejects.toThrow('down');

		// The point of the finally: a failing dependency is exactly the one whose
		// duration you need, and an early return would drop it.
		expect(timing.spans.map((s) => s.name)).toEqual(['redis']);
	});

	it('accepts a duration measured elsewhere', () => {
		const timing = startRequestTiming();
		timing.record('neo4j', 12.5);

		expect(timing.spans).toEqual([{ name: 'neo4j', duration: 12.5 }]);
	});

	it('stops recording at MAX_SPANS instead of growing without bound', () => {
		const timing = startRequestTiming();
		for (let i = 0; i < MAX_SPANS + 10; i++) timing.record(`row-${i}`, 1);

		expect(timing.spans).toHaveLength(MAX_SPANS);
	});

	it('reports elapsed wall clock', async () => {
		const timing = startRequestTiming();
		await sleep(5);

		expect(timing.elapsed()).toBeGreaterThan(0);
	});
});

describe('toServerTimingHeader', () => {
	function timingWith(spans: Array<[string, number]>): RequestTiming {
		const timing = startRequestTiming();
		for (const [name, duration] of spans) timing.record(name, duration);
		return timing;
	}

	it('emits the total alone without detail', () => {
		const header = toServerTimingHeader(timingWith([['db', 10]]), { detail: false });

		expect(header).toMatch(/^total;dur=[\d.]+$/);
		expect(header).not.toContain('db');
	});

	it('emits every span plus unattributed with detail', () => {
		const header =
			toServerTimingHeader(
				timingWith([
					['db', 1],
					['redis', 2],
				]),
				{ detail: true },
			) ?? '';

		expect(header).toContain('db;dur=1');
		expect(header).toContain('redis;dur=2');
		expect(header).toContain('unattributed;dur=');
		expect(header).toContain('total;dur=');
	});

	it('clamps unattributed at zero when concurrent spans outrun the wall clock', () => {
		// Two 500ms spans that ran in parallel inside a request that took ~0ms here.
		// The honest answer is "spans covered it", not a negative number.
		const header =
			toServerTimingHeader(
				timingWith([
					['a', 500],
					['b', 500],
				]),
				{ detail: true },
			) ?? '';

		expect(header).toContain('unattributed;dur=0');
	});

	it('reduces a span name to a Server-Timing token', () => {
		const header = toServerTimingHeader(timingWith([['pg: select "user"', 1]]), { detail: true }) ?? '';

		// A raw name would inject a delimiter and corrupt every field after it.
		expect(header).not.toContain('"');
		expect(header).toContain('pg__select__user_;dur=1');
	});
});
