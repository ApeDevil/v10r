import { describe, expect, it } from 'vitest';
import { DEFAULT_NEEDS_MS, DEFAULT_SHED_ABOVE, defineShedder } from './shedding';

const shedder = defineShedder({
	name: 'test',
	shedAbove: DEFAULT_SHED_ABOVE,
	needsMs: DEFAULT_NEEDS_MS,
});

describe('load', () => {
	it('admits every class on an idle system', () => {
		for (const priority of ['critical', 'deferred', 'background'] as const) {
			expect(shedder.admit(priority, { load: 0 }).admit).toBe(true);
		}
	});

	it('sheds background before deferred, and deferred before neither', () => {
		expect(shedder.admit('background', { load: 0.6 }).admit).toBe(false);
		expect(shedder.admit('deferred', { load: 0.6 }).admit).toBe(true);
		expect(shedder.admit('critical', { load: 0.6 }).admit).toBe(true);

		expect(shedder.admit('deferred', { load: 0.9 }).admit).toBe(false);
		expect(shedder.admit('critical', { load: 0.9 }).admit).toBe(true);
	});

	// The one rule that must not be a threshold: at full load critical work is still
	// attempted, and the bulkhead's visible refusal is what stops it if anything does.
	it('never sheds critical work for load alone', () => {
		expect(shedder.admit('critical', { load: 1 }).admit).toBe(true);
	});

	it('names load as the reason so a shed is not mistaken for a bug', () => {
		expect(shedder.admit('background', { load: 0.9 })).toMatchObject({ admit: false, reason: 'load' });
	});
});

describe('budget', () => {
	it('refuses work that cannot finish in the time left', () => {
		expect(shedder.admit('background', { load: 0, remainingMs: 100 })).toMatchObject({
			admit: false,
			reason: 'budget',
		});
	});

	it('admits the same work when the budget allows it', () => {
		expect(shedder.admit('background', { load: 0, remainingMs: 5000 }).admit).toBe(true);
	});

	it('attempts critical work with whatever time is left', () => {
		expect(shedder.admit('critical', { load: 0, remainingMs: 1 }).admit).toBe(true);
	});

	// A caller that forgot to pass a deadline must not silently lose all its optional
	// work — absent means "no budget constraint", never "no budget".
	it('treats a missing deadline as unconstrained', () => {
		expect(shedder.admit('background', { load: 0 })).toMatchObject({
			admit: true,
			remainingMs: Number.POSITIVE_INFINITY,
		});
	});
});

describe('reasons', () => {
	it('reports load before budget when both would shed', () => {
		expect(shedder.admit('background', { load: 1, remainingMs: 0 }).reason).toBe('load');
	});

	it('carries the signals it decided on', () => {
		expect(shedder.admit('deferred', { load: 0.25, remainingMs: 900 })).toEqual({
			admit: true,
			reason: 'admitted',
			load: 0.25,
			remainingMs: 900,
		});
	});
});
