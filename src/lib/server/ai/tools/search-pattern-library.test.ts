/**
 * search_pattern_library tool — ranking over the REAL registry (a static,
 * deterministic import: no mocks needed), tier-conditional depth fields,
 * category filter/browse, limit clamp, sink capture, and never-throws.
 */

import { describe, expect, it } from 'vitest';
import type { SearchResult } from '$lib/search/types';
import type { CatalogSink } from './search-catalog';
import { createSearchPatternLibraryTool } from './search-pattern-library';

type ToolArgs = { query: string; category?: string; limit?: number };

// biome-ignore lint/suspicious/noExplicitAny: invoking the AI SDK tool's execute directly in a unit test
function exec(toolSet: any, args: ToolArgs): Promise<any> {
	return toolSet.search_pattern_library.execute(args, {});
}

function collectingSink(): { sink: CatalogSink; rows: SearchResult[] } {
	const rows: SearchResult[] = [];
	return { sink: { record: (r) => rows.push(...r) }, rows };
}

describe('search_pattern_library', () => {
	it('ranks a matching pattern and returns its citable page path', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: 'background jobs cron' });
		expect(out.results.length).toBeGreaterThan(0);
		expect(out.results[0].id).toBe('jobs-scheduler');
		expect(out.results[0].path).toBe('/docs/pattern-library/jobs-scheduler');
	});

	it('carries invariants/emulation notes on deep rows only', async () => {
		const deep = await exec(createSearchPatternLibraryTool('en'), { query: 'background jobs cron' });
		expect(deep.results[0].tier).toBe('deep');
		expect(deep.results[0].invariants.length).toBeGreaterThan(0);
		expect(deep.results[0].emulation_notes.length).toBeGreaterThan(0);

		const light = await exec(createSearchPatternLibraryTool('en'), { query: 'proof-of-work captcha altcha' });
		expect(light.results[0].id).toBe('anti-abuse-captcha');
		expect(light.results[0].tier).toBe('light');
		expect(light.results[0]).not.toHaveProperty('invariants');
		expect(light.results[0]).not.toHaveProperty('emulation_notes');
	});

	it('rejects an unknown category with a helpful error instead of throwing', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: 'anything', category: 'nope' });
		expect(out.results).toEqual([]);
		expect(out.error).toContain('Unknown category "nope"');
		expect(out.error).toContain('ai');
	});

	it('browses a category in registry order with a total count', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: '*', category: 'viz', limit: 8 });
		expect(out.results.length).toBeGreaterThanOrEqual(6);
		expect(out.total).toBe(out.results.length);
		expect(out.results.every((row: { category: string }) => row.category === 'viz')).toBe(true);
	});

	it('browse with an empty query starts at the registry head (deep-first)', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: '' });
		expect(out.results[0].id).toBe('multi-client-core');
		expect(out.results[0].tier).toBe('deep');
	});

	it('clamps limit to the cap', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: '*', limit: 99 });
		expect(out.results.length).toBeLessThanOrEqual(8);
	});

	it('feeds the sink citable doc-surface rows with locale-aware badges', async () => {
		const en = collectingSink();
		await exec(createSearchPatternLibraryTool('en', en.sink), { query: 'background jobs cron', limit: 2 });
		expect(en.rows.length).toBeGreaterThan(0);
		expect(en.rows[0].surface).toBe('doc');
		expect(en.rows[0].path.startsWith('/docs/pattern-library/')).toBe(true);
		expect(en.rows[0].id.startsWith('pattern:')).toBe(true);
		expect(en.rows[0].badge).toBeNull();

		const de = collectingSink();
		await exec(createSearchPatternLibraryTool('de', de.sink), { query: 'background jobs cron', limit: 2 });
		expect(de.rows[0].badge).toBe('en-fallback');
	});

	it('returns empty results (not an error) for a no-match query', async () => {
		const out = await exec(createSearchPatternLibraryTool('en'), { query: 'quantum teleportation blockchain' });
		expect(out.results).toEqual([]);
		expect(out.error).toBeUndefined();
	});
});
