import { describe, expect, it } from 'vitest';
import { parseRegistry } from '#patterns/schema.ts';
import { DEEP_PATTERNS, REGISTRY } from './registry';

/**
 * The fitness fields (`avoid_when`, `alternatives`, `needs`) are what lets a reader rule a
 * pattern OUT. They are enforced structurally in `pattern-library/schema.ts`; these cases pin
 * the rules that would otherwise rot silently: a deep card without a contraindication, and a
 * need outside the closed vocabulary (which would make the plan-wide union useless), and a need
 * level that does not say what it must (a condition, a reason, a substitutable pin).
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

	it('rejects a need outside the closed vocabulary', () => {
		const { errors } = parseRegistry(withPattern({ needs: ['relational-db', 'kafka' as never] }));
		expect(errors.some((error) => error.includes("needs[1].need: 'kafka' is not one of"))).toBe(true);
	});

	it('makes each need level state what it must: a condition, a reason, a substitutable pin', () => {
		const { errors } = parseRegistry(
			withPattern({
				needs: [
					{ need: 'key-value-store', level: 'conditional' },
					{ need: 'graph-db', level: 'implementation' },
					{ need: 'relational-db', level: 'required', pinned: 'oracle', why: 'locks' },
					{ need: 'scheduler', level: 'optional', why: 'nightly', when: 'never' },
				],
			}),
		);
		expect(errors.some((error) => error.includes('needs[0]: a conditional need states its condition'))).toBe(true);
		expect(errors.some((error) => error.includes('needs[1]: an implementation need states its reason'))).toBe(true);
		expect(errors.some((error) => error.includes("needs[2].pinned: must be one of relational-db's technologies"))).toBe(
			true,
		);
		expect(errors.some((error) => error.includes('needs[3]: "when" belongs to conditional needs only'))).toBe(true);
	});

	it('refuses a need declared twice', () => {
		const { errors } = parseRegistry(
			withPattern({ needs: ['relational-db', { need: 'relational-db', level: 'optional', why: 'x' }] }),
		);
		expect(errors.some((error) => error.includes("'relational-db' is declared twice"))).toBe(true);
	});

	it('refuses a registry format this reader does not understand', () => {
		const { errors } = parseRegistry({ ...REGISTRY, format: 2 });
		expect(errors.some((error) => error.includes('this reader understands registry format 3'))).toBe(true);
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
