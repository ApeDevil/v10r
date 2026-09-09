import { describe, expect, it } from 'vitest';
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
