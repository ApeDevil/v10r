import { describe, expect, it } from 'vitest';
import { parseRegistry } from '#patterns/schema.ts';
import { DEEP_PATTERNS, REGISTRY } from './registry';

/**
 * The fitness fields (`avoid_when`, `alternatives`, `requires`) are what lets a reader rule a
 * pattern OUT. They are enforced structurally in `pattern-library/schema.ts`; these cases pin
 * the rules that would otherwise rot silently: a deep card without a contraindication, and a
 * requirement outside the closed vocabulary (which would make the plan-wide union useless).
 */
function withPattern(patch: Record<string, unknown>) {
	const base = DEEP_PATTERNS[0];
	return { ...REGISTRY, patterns: [{ ...base, ...patch }] };
}

describe('registry fitness fields', () => {
	it('accepts the committed registry', () => {
		expect(parseRegistry(REGISTRY).errors).toEqual([]);
	});

	it('rejects a deep card with no avoid_when entry', () => {
		const { errors } = parseRegistry(withPattern({ avoid_when: [] }));
		expect(errors.some((error) => error.includes('avoid_when: deep records must have at least one entry'))).toBe(true);
	});

	it('rejects a requirement outside the closed vocabulary', () => {
		const { errors } = parseRegistry(withPattern({ requires: ['postgres', 'kafka'] }));
		expect(errors.some((error) => error.includes("requires: 'kafka' is not one of"))).toBe(true);
	});

	it('rejects an alternative with no approach', () => {
		const { errors } = parseRegistry(withPattern({ alternatives: [{ approach: '', prefer_when: 'always' }] }));
		expect(errors.some((error) => error.includes('alternatives[0]'))).toBe(true);
	});

	it('rejects an alternative without the condition under which it wins', () => {
		const { errors } = parseRegistry(withPattern({ alternatives: [{ approach: 'a plain cache', prefer_when: '' }] }));
		expect(errors.some((error) => error.includes('alternatives[0]'))).toBe(true);
	});

	it('gives every deep card a one-clause index headline', () => {
		// The generated Pattern Index prints avoid_when[0] inline; a paragraph there breaks the table.
		for (const pattern of DEEP_PATTERNS) {
			expect(pattern.avoid_when[0].length, pattern.id).toBeLessThanOrEqual(160);
		}
	});
});
