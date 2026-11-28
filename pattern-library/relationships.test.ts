/**
 * Negative validation of the relationship graph (target-ontology §C.3): every malformed graph
 * the schema must refuse, each against the committed registry with one change. Only the adoption
 * relationships (builds_on, composes, specializes) enter the acyclicity check; references may cycle.
 * The positive semantics are in `pattern-graph.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../src/lib/server/patterns/registry.ts';
import { parseRegistry } from './schema.ts';

type Raw = { assumptions: Record<string, unknown>[]; patterns: Record<string, unknown>[] } & Record<string, unknown>;

/** Errors of the committed registry after `change`, which edits a deep copy in place. */
function errorsAfter(change: (registry: Raw, byId: (id: string) => Record<string, unknown>) => void): string[] {
	const registry = structuredClone(REGISTRY) as unknown as Raw;
	const byId = (id: string) => {
		const found = registry.patterns.find((pattern) => pattern.id === id);
		if (!found) throw new Error(`fixture: no record ${id}`);
		return found;
	};
	change(registry, byId);
	return parseRegistry(registry).errors;
}

const ofKind = (kind: string) => REGISTRY.patterns.find((pattern) => pattern.kind === kind)?.id as string;
const PRINCIPLE = ofKind('principle');
const WORKFLOW = ofKind('workflow');
const why = 'a fixture relationship with a rationale';

describe('relationship validation refuses malformed graphs', () => {
	it('accepts the committed registry', () => {
		expect(parseRegistry(REGISTRY).errors).toEqual([]);
	});

	it('a missing target', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('hosted-mcp').builds_on as unknown[]).push({ id: 'no-such-record', why });
		});
		expect(errors).toContain("hosted-mcp: builds_on 'no-such-record' does not exist");
	});

	it('a relationship to itself', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('hosted-mcp').references as unknown[]).push({ id: 'hosted-mcp', why });
		});
		expect(errors).toContain('hosted-mcp: references itself');
	});

	it('a pair related twice, even under different types', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('hosted-mcp').references as unknown[]).push({ id: 'rate-limiting', why });
		});
		expect(errors.some((error) => error.includes("'rate-limiting' is related twice (builds_on and references)"))).toBe(
			true,
		);
	});

	it('a relationship without a rationale, and a malformed target id', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('hosted-mcp').builds_on as unknown[]).push({ id: 'Not An Id', why: '' });
		});
		expect(errors.some((error) => error.endsWith('.why: every relationship states its rationale'))).toBe(true);
		expect(errors.some((error) => error.endsWith('.id: must be a kebab-case record id'))).toBe(true);
	});

	it('a conditional or optional constituent without its condition, and a required one with a condition', () => {
		const composing = (entry: Record<string, unknown>) =>
			errorsAfter((_, byId) => {
				byId('notification-outbox').composes = [{ id: 'notification-channels', why, ...entry }];
			});
		expect(
			composing({ level: 'conditional' }).some((error) =>
				error.endsWith('a conditional constituent states its governing condition in "when"'),
			),
		).toBe(true);
		expect(
			composing({ level: 'optional' }).some((error) =>
				error.endsWith('an optional constituent states its governing condition in "when"'),
			),
		).toBe(true);
		expect(
			composing({ level: 'required', when: 'always' }).some((error) =>
				error.endsWith('a required constituent is unconditional — "when" belongs to conditional and optional ones'),
			),
		).toBe(true);
		expect(
			composing({ level: 'sometimes', when: 'x' }).some((error) =>
				error.endsWith('.level: must be one of required|conditional|optional'),
			),
		).toBe(true);
	});

	it('the retired depends_on field', () => {
		const errors = errorsAfter((_, byId) => {
			byId('hosted-mcp').depends_on = ['rate-limiting'];
		});
		expect(
			errors.some((error) =>
				error.endsWith('.depends_on: retired — use builds_on, composes, specializes or references'),
			),
		).toBe(true);
	});

	it('an adoption cycle through builds_on and composes', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('rate-limiting').composes as unknown[]).push({ id: 'hosted-mcp', level: 'optional', when: 'x', why });
		});
		expect(
			errors.some((error) => error.startsWith('adoption relationships form a cycle:') && error.includes('hosted-mcp')),
		).toBe(true);
	});

	it('an adoption cycle through specializes', () => {
		const errors = errorsAfter((_, byId) => {
			byId('state-management').specializes = { id: 'url-search-state', why };
		});
		expect(errors.some((error) => error.startsWith('adoption relationships form a cycle:'))).toBe(true);
	});

	it('a reference cycle is allowed', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('rate-limiting').references as unknown[]).push({ id: 'hosted-mcp', why });
		});
		expect(errors.filter((error) => error.includes('cycle'))).toEqual([]);
	});

	it('building on or composing a principle, and a principle that adopts anything', () => {
		const adopting = errorsAfter((_, byId) => {
			(byId('hosted-mcp').builds_on as unknown[]).push({ id: PRINCIPLE, why });
		});
		expect(adopting).toContain(
			`hosted-mcp: builds_on '${PRINCIPLE}', a principle — principles apply through a scoped assumption, never as a step`,
		);
		const adopted = errorsAfter((_, byId) => {
			(byId(PRINCIPLE).builds_on as unknown[]).push({ id: 'rate-limiting', why });
		});
		expect(
			adopted.some((error) =>
				error.endsWith('.builds_on: a principle is applied to the work — it builds on and composes nothing'),
			),
		).toBe(true);
	});

	it('building on or composing a workflow', () => {
		const errors = errorsAfter((_, byId) => {
			(byId('hosted-mcp').composes as unknown[]).push({ id: WORKFLOW, level: 'required', why });
		});
		expect(errors).toContain(
			`hosted-mcp: composes '${WORKFLOW}', a workflow — a procedure is performed, nothing builds on or composes it`,
		);
	});

	it('a specialization across kinds', () => {
		const errors = errorsAfter((_, byId) => {
			byId('hosted-mcp').specializes = { id: PRINCIPLE, why };
		});
		expect(errors).toContain(
			`hosted-mcp: specializes '${PRINCIPLE}', a principle — a specialization stays inside one kind`,
		);
	});

	it('an alternative that is also adopted, and an alternative pattern that does not exist', () => {
		const errors = errorsAfter((_, byId) => {
			const alternatives = byId('hosted-mcp').alternatives as Record<string, unknown>[];
			alternatives.push({ approach: 'Skip the limiter', prefer_when: 'never', pattern: 'rate-limiting' });
			alternatives.push({ approach: 'Something else', prefer_when: 'never', pattern: 'no-such-record' });
		});
		expect(errors.some((error) => error.includes("'rate-limiting' is both an alternative and adopted"))).toBe(true);
		expect(errors).toContain("hosted-mcp: alternative pattern 'no-such-record' does not exist");
	});

	it('assumptions: unconditional, unknown, duplicated, a workflow, or matching nothing', () => {
		const assuming = (assumption: Record<string, unknown>) =>
			errorsAfter((registry) => {
				registry.assumptions.push({ why, ...assumption });
			});
		expect(
			assuming({ id: 'rate-limiting', applies_to: {} }).some((error) =>
				error.includes('an unconditional assumption is not allowed (D-05)'),
			),
		).toBe(true);
		expect(assuming({ id: 'no-such-record', applies_to: { ids: ['hosted-mcp'] } })).toContain(
			"assumption 'no-such-record' does not exist",
		);
		expect(assuming({ id: 'multi-client-core', applies_to: { ids: ['hosted-mcp'] } })).toContain(
			"assumption 'multi-client-core' is declared twice — merge the scopes",
		);
		expect(assuming({ id: WORKFLOW, applies_to: { ids: ['hosted-mcp'] } })).toContain(
			`assumption '${WORKFLOW}' is a workflow — a procedure is performed, not assumed`,
		);
		const nowhere = assuming({ id: 'rate-limiting', applies_to: { categories: ['no-such-category'] } });
		expect(nowhere).toContain("assumption 'rate-limiting': scope category 'no-such-category' does not exist");
		expect(nowhere).toContain("assumption 'rate-limiting': its scope matches no record");
	});
});
