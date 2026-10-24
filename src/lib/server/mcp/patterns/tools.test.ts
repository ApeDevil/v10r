import { describe, expect, it } from 'vitest';
import { PATTERNS } from '#lib/server/patterns/index.ts';
import { PATTERN_TOOLS, publicPatternRegistry } from './tools';

function textOf(result: { content: { text: string }[] }): string {
	return result.content.map((c) => c.text).join('\n');
}

describe('PATTERN_TOOLS definitions', () => {
	it('declares exactly the six read-only tools', () => {
		expect(PATTERN_TOOLS.map((t) => t.name)).toEqual([
			'search_patterns',
			'get_pattern',
			'get_file_excerpt',
			'trace_capability',
			'recommend_emulation_plan',
			'validate_snippet',
		]);
	});

	it('has no outputSchema/title/annotations (Claude Code tool-drop guard)', () => {
		for (const tool of PATTERN_TOOLS) {
			expect(tool).not.toHaveProperty('outputSchema');
			expect(tool).not.toHaveProperty('title');
			expect(tool).not.toHaveProperty('annotations');
		}
	});
});

describe('publicPatternRegistry.dispatch', () => {
	it('search_patterns returns ranked matches for a known term', () => {
		const res = publicPatternRegistry.dispatch('search_patterns', { query: 'architecture' });
		expect(res).not.toBeInstanceOf(Promise);
		const result = res as { isError?: boolean; content: { text: string }[] };
		expect(result.isError).toBeFalsy();
		expect(textOf(result)).toMatch(/multi-client-core/);
	});

	it('get_pattern returns the full card for a valid id', () => {
		const result = publicPatternRegistry.dispatch('get_pattern', { id: 'multi-client-core' }) as {
			content: { text: string }[];
		};
		expect(textOf(result)).toMatch(/Multi-client core/);
		expect(textOf(result)).toMatch(/Invariants/);
	});

	it('get_pattern rejects an unknown id', () => {
		const result = publicPatternRegistry.dispatch('get_pattern', { id: 'no-such-pattern' }) as { isError?: boolean };
		expect(result.isError).toBe(true);
	});

	it('trace_capability walks concept → docs → code → tests → proof', () => {
		const result = publicPatternRegistry.dispatch('trace_capability', { capability: 'rag' }) as {
			content: { text: string }[];
		};
		expect(textOf(result)).toMatch(/Docs:/);
		expect(textOf(result)).toMatch(/Invariants:/);
	});

	it('recommend_emulation_plan assembles a dependency-ordered plan', () => {
		const result = publicPatternRegistry.dispatch('recommend_emulation_plan', {
			capabilities: ['layered rag', 'background jobs'],
		}) as { content: { text: string }[] };
		expect(textOf(result)).toMatch(/Emulation plan/);
		expect(textOf(result)).toMatch(/Step 1/);
	});

	// "Dependency-ordered" is the tool's whole promise, and the title above asserted only
	// that a Step 1 exists. The velocity family is the first set of records with real
	// depends_on chains, so it is the first case where a wrong order is visible: an agent
	// told to build singleflight before the cache tier it locks against would follow it.
	it('recommend_emulation_plan puts a dependency before the pattern that needs it', () => {
		const result = publicPatternRegistry.dispatch('recommend_emulation_plan', {
			capabilities: ['caching', 'singleflight', 'stale-while-revalidate', 'query budget', 'scenario testing'],
		}) as { content: { text: string }[] };
		const text = textOf(result);
		const precedes = (first: string, second: string) => {
			expect(text).toContain(first);
			expect(text).toContain(second);
			expect(text.indexOf(first)).toBeLessThan(text.indexOf(second));
		};
		precedes('hierarchical-cache', 'singleflight');
		precedes('hierarchical-cache', 'stale-while-revalidate');
		precedes('performance-budget-ratchet', 'query-budget');
		precedes('performance-budget-ratchet', 'scenario-harness');
	});

	it('reports an uncovered capability as a no-match that still names the closest overlaps', () => {
		const result = publicPatternRegistry.dispatch('search_patterns', { query: 'stripe billing webhooks' }) as {
			content: { text: string }[];
			isError?: boolean;
			diag?: string;
		};
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('empty');
		expect(textOf(result)).toContain('read the closest before concluding it is absent');
		expect(textOf(result)).toMatch(/`get_pattern` \{"id":"[a-z0-9-]+"\}/);
	});

	it('rejects an unknown tool name', () => {
		const result = publicPatternRegistry.dispatch('drop_tables', {}) as { isError?: boolean };
		expect(result.isError).toBe(true);
	});

	it('is deterministic — identical queries yield identical output', () => {
		const a = publicPatternRegistry.dispatch('search_patterns', { query: 'ai tools' }) as {
			content: { text: string }[];
		};
		const b = publicPatternRegistry.dispatch('search_patterns', { query: 'ai tools' }) as {
			content: { text: string }[];
		};
		expect(textOf(a)).toEqual(textOf(b));
	});
});

type Answer = { content: { text: string }[]; isError?: boolean; diag?: string };
const call = (tool: string, args: Record<string, unknown>) => publicPatternRegistry.dispatch(tool, args) as Answer;

describe('progressive disclosure — search_patterns', () => {
	it('grades the detail: ids < compact < summary, all naming the same hits', () => {
		const sizes = (['ids', 'compact', 'summary'] as const).map((detail) => {
			const result = call('search_patterns', { query: 'cache stampede protection', detail, limit: 3 });
			expect(result.isError).toBeFalsy();
			expect(textOf(result)).toContain('`singleflight`');
			return textOf(result).length;
		});
		expect(sizes[0]).toBeLessThan(sizes[1]);
		expect(sizes[1]).toBeLessThan(sizes[2]);
	});

	it('puts the rule-out facts on the row: dependencies, requirements, headline contraindication', () => {
		const text = textOf(call('search_patterns', { query: 'layered rag', detail: 'compact', limit: 1 }));
		expect(text).toContain('requires postgres, pgvector, ai-provider');
		expect(text).toContain('avoid when: ');
	});

	it('browses: "*" alone is the category map, every category with counts', () => {
		const text = textOf(call('search_patterns', { query: '*' }));
		for (const id of ['architecture', 'velocity-data', 'integrity-execution']) expect(text).toContain(`\`${id}\``);
		expect(text).toMatch(/175 patterns in 29 categories|\d+ patterns in \d+ categories/);
	});

	it('browses a facet: "*" plus filters lists exactly the matching records', () => {
		const text = textOf(
			call('search_patterns', { query: '*', category: 'velocity-data', tier: 'deep', detail: 'ids' }),
		);
		expect(text).toContain('`singleflight`');
		expect(text).not.toContain('`velocity-screen-read-model`'); // light
		expect(text).not.toContain('`jobs-scheduler`'); // other category
	});

	it('filters a ranked search by tier and maturity', () => {
		const text = textOf(call('search_patterns', { query: 'cache', tier: 'light', detail: 'ids', limit: 20 }));
		expect(text).toContain('`databases-cache`');
		expect(text).not.toContain('`hierarchical-cache`');
	});

	it('the universal recovery step really lists the whole library now', () => {
		const empty = call('search_patterns', { query: 'quantum teleportation zebra' });
		expect(textOf(empty)).toContain('`search_patterns` {"query":"*"}');
	});
});

describe('progressive disclosure — get_pattern', () => {
	it('fetches several cards in one call, in the order asked', () => {
		const text = textOf(call('get_pattern', { ids: ['singleflight', 'deadline-propagation'] }));
		expect(text.indexOf('(`singleflight`)')).toBeLessThan(text.indexOf('(`deadline-propagation`)'));
		expect(text.split('\n---\n')).toHaveLength(2);
	});

	it('returns only the requested sections, and NAMES what it left out — invariants loudest', () => {
		const text = textOf(call('get_pattern', { id: 'singleflight', sections: ['code'] }));
		expect(text).toContain('## Code entry points');
		expect(text).not.toContain('## Invariants');
		expect(text).toMatch(/Not shown: .*invariants \(\d+\)/);
		expect(text).toContain('MUST hold when emulating');
	});

	it('always keeps the header: dependencies and required infrastructure are never filtered away', () => {
		const text = textOf(call('get_pattern', { id: 'layered-rag', sections: ['invariants'] }));
		expect(text).toContain('**Depends on:** multi-client-core');
		expect(text).toContain('**Requires:** postgres, pgvector, ai-provider');
	});

	it('a full card announces nothing withheld', () => {
		expect(textOf(call('get_pattern', { id: 'singleflight' }))).not.toContain('Not shown');
	});

	it('rejects ambiguous or malformed requests as invalid_args', () => {
		for (const args of [
			{ id: 'singleflight', ids: ['singleflight'] },
			{ ids: [] },
			{ ids: ['a', 'b', 'c', 'd', 'e', 'f'] },
			{ id: 'singleflight', sections: ['nope'] },
			{ id: 'singleflight', sections: [] },
			{},
		]) {
			const result = call('get_pattern', args);
			expect(result.isError, JSON.stringify(args)).toBe(true);
			expect(result.diag, JSON.stringify(args)).toBe('invalid_args');
		}
	});

	it('names every unknown id in a batch as a registry gap', () => {
		const result = call('get_pattern', { ids: ['singleflight', 'no-such-a', 'no-such-b'] });
		expect(result.diag).toBe('not_found');
		expect(textOf(result)).toContain('"no-such-a", "no-such-b"');
	});
});

describe('evidence navigation — get_file_excerpt', () => {
	it('reads the #fragment form a card prints as that section', () => {
		const result = call('get_file_excerpt', {
			path: 'docs/blueprint/velocity/data.md#singleflight--stampede-protection',
		});
		expect(result.isError).toBeFalsy();
		expect(textOf(result)).toContain('§ Singleflight / stampede protection');
		expect(textOf(result)).not.toContain('## Hierarchical cache');
	});

	it('reads one code declaration by name', () => {
		const text = textOf(
			call('get_file_excerpt', { path: 'src/lib/server/cache/singleflight.ts', section: 'coalesce' }),
		);
		expect(text).toContain('export function coalesce');
		expect(text).not.toContain('export async function claimRefresh');
	});

	it('answers an unknown section as not_found, listing the real ones', () => {
		const result = call('get_file_excerpt', { path: 'src/lib/server/cache/singleflight.ts', section: 'nope' });
		expect(result.diag).toBe('not_found');
		expect(textOf(result)).toContain('claimRefresh (L');
	});

	it('still refuses a fragment on a file outside the allowlist', () => {
		const result = call('get_file_excerpt', { path: '.env#secrets' });
		expect(result.isError).toBe(true);
	});
});

describe('applicability — what adopting a pattern really takes', () => {
	it('carries requirements through dependencies, naming where they come from', () => {
		// singleflight requires nothing itself; its dependency hierarchical-cache requires Redis.
		const card = textOf(call('get_pattern', { id: 'singleflight', sections: ['overview'] }));
		expect(card).toContain('**Requires:** redis (via hierarchical-cache)');
		const row = textOf(call('search_patterns', { query: 'cache stampede protection', detail: 'compact', limit: 1 }));
		expect(row).toContain('requires redis (via hierarchical-cache)');
	});

	it('marks plan steps against a declared target, keeping unknown and missing apart', () => {
		const capabilities = ['background jobs', 'layered RAG'];
		const unknown = textOf(call('recommend_emulation_plan', { capabilities }));
		expect(unknown).not.toContain('Fits the target');
		expect(unknown).not.toContain('Target lacks');
		const declared = textOf(call('recommend_emulation_plan', { capabilities, target_infra: ['postgres'] }));
		expect(declared).toContain('**Target lacks pgvector, ai-provider — drop or replace this step');
		expect(declared).toContain('Fits the target.');
		expect(declared).toContain('The target lacks pgvector, ai-provider');
		const complete = textOf(
			call('recommend_emulation_plan', { capabilities, target_infra: ['postgres', 'pgvector', 'ai-provider'] }),
		);
		expect(complete).toContain('the target has all of it');
	});

	it('refuses a target_infra word outside the vocabulary', () => {
		const result = call('recommend_emulation_plan', { capabilities: ['jobs'], target_infra: ['mysql'] });
		expect(result.diag).toBe('invalid_args');
		expect(textOf(result)).toContain('postgres, pgvector');
	});

	it('outlines a plan without dropping the count of what it withholds', () => {
		const outline = textOf(call('recommend_emulation_plan', { capabilities: ['background jobs'], detail: 'outline' }));
		expect(outline).not.toContain('Invariants:\n');
		expect(outline).toMatch(/Not shown: \d+ invariant\(s\) that MUST hold/);
		expect(outline).toContain('Next: get_pattern with ids');
	});
});

/**
 * Claude Code warns above 10k tokens per tool result. The bounds that keep every answer under it
 * are structural (row, card and line caps), so the worst cases the caps allow are asserted, at a
 * conservative 4 characters per token.
 */
describe('bounded output', () => {
	const WARNING_CHARS = 10_000 * 4;
	const longest = (ids: string[]) =>
		ids
			.map((id) => ({ id, size: textOf(call('get_pattern', { id })).length }))
			.sort((a, b) => b.size - a.size)
			.slice(0, 5)
			.map(({ id }) => id);

	it('stays under the warning at every cap', () => {
		const worst = [
			call('get_pattern', { ids: longest(PATTERNS.map((pattern) => pattern.id)) }),
			call('search_patterns', { query: '*', tier: 'light', limit: 50 }),
			call('search_patterns', { query: 'data cache state ui page api', limit: 50 }),
			call('recommend_emulation_plan', {
				capabilities: PATTERNS.filter((pattern) => pattern.tier === 'deep')
					.slice(0, 20)
					.map((pattern) => pattern.title),
			}),
		];
		for (const result of worst) expect(textOf(result).length).toBeLessThan(WARNING_CHARS);
	});

	it('outlines an oversized plan and says so, rather than cutting it', () => {
		const text = textOf(
			call('recommend_emulation_plan', {
				capabilities: PATTERNS.filter((pattern) => pattern.tier === 'deep')
					.slice(0, 20)
					.map((pattern) => pattern.title),
			}),
		);
		expect(text).toMatch(/— outlined: full detail would be ≈\d+k tokens/);
		expect(text).toMatch(/Not shown: \d+ invariant\(s\) that MUST hold/);
	});
});
