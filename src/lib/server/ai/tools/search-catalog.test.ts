/**
 * search_catalog tool — merge/dedupe, surface facet → scope mapping, authScope gate,
 * sink capture, and never-throws. The coordinator (`$lib/server/search`) is mocked;
 * the real lexical `match()` runs over the mocked records.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRecord, SearchResult } from '$lib/search/types';

const mocks = vi.hoisted(() => ({
	buildSearchIndex: vi.fn(),
	searchContent: vi.fn(),
}));

vi.mock('$lib/server/search', () => ({
	buildSearchIndex: mocks.buildSearchIndex,
	searchContent: mocks.searchContent,
}));

import { type CatalogSink, createSearchCatalogTool } from './search-catalog';

function rec(o: {
	surface: SearchRecord['surface'];
	path: string;
	title: string;
	authScope?: SearchRecord['authScope'];
	anchor?: string | null;
}): SearchRecord {
	return {
		id: `${o.surface}:en:${o.path}${o.anchor ?? ''}`,
		surface: o.surface,
		locale: 'en',
		localeFallback: false,
		title: o.title,
		path: o.path,
		anchor: o.anchor ?? null,
		breadcrumb: [],
		authScope: o.authScope ?? 'public',
	};
}

function result(o: { surface: SearchResult['surface']; path: string; title: string; snippet: string }): SearchResult {
	return {
		id: `${o.surface}:en:${o.path}`,
		surface: o.surface,
		title: o.title,
		path: o.path,
		anchor: null,
		breadcrumb: [],
		snippet: o.snippet,
		highlight: [],
		locale: 'en',
		badge: null,
		score: 1,
	};
}

type ToolArgs = { query: string; surface?: SearchRecord['surface'] | null; limit?: number };
// biome-ignore lint/suspicious/noExplicitAny: invoking the AI SDK tool's execute directly in a unit test
function exec(tool: any, args: ToolArgs) {
	return tool.search_catalog.execute(args, {}) as Promise<{ results: Array<Record<string, unknown>>; error?: string }>;
}

beforeEach(() => {
	mocks.buildSearchIndex.mockReset();
	mocks.searchContent.mockReset();
	mocks.searchContent.mockResolvedValue([]);
});

describe('search_catalog tool', () => {
	it('merges static + server lanes, server hit wins on dedupe', async () => {
		mocks.buildSearchIndex.mockReturnValue([
			rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' }),
			rec({ surface: 'doc', path: '/docs/x', title: 'Button Doc' }),
		]);
		mocks.searchContent.mockResolvedValue([
			result({ surface: 'doc', path: '/docs/x', title: 'Button Doc', snippet: 'server snippet' }),
		]);

		const { results } = await exec(createSearchCatalogTool('en', 'admin'), { query: 'button' });

		expect(results).toHaveLength(2); // doc deduped across lanes
		expect(results.find((r) => r.path === '/docs/x')?.snippet).toBe('server snippet');
		expect(mocks.buildSearchIndex).toHaveBeenCalledWith('en');
	});

	it('gates admin surfaces by authCeiling', async () => {
		const records = [
			rec({ surface: 'showcase', path: '/showcases/button', title: 'Button', authScope: 'public' }),
			rec({ surface: 'showcase', path: '/admin/secret', title: 'Button Admin', authScope: 'admin' }),
		];
		mocks.buildSearchIndex.mockReturnValue(records);

		const asUser = await exec(createSearchCatalogTool('en', 'user'), { query: 'button' });
		expect(asUser.results.some((r) => r.path === '/admin/secret')).toBe(false);

		const asAdmin = await exec(createSearchCatalogTool('en', 'admin'), { query: 'button' });
		expect(asAdmin.results.some((r) => r.path === '/admin/secret')).toBe(true);
	});

	it('maps a doc surface facet to scope:docs and excludes other surfaces', async () => {
		mocks.buildSearchIndex.mockReturnValue([
			rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' }),
			rec({ surface: 'doc', path: '/docs/x', title: 'Button Doc' }),
		]);

		const { results } = await exec(createSearchCatalogTool('en', 'public'), { query: 'button', surface: 'doc' });

		expect(results.every((r) => r.surface === 'doc')).toBe(true);
		expect(mocks.searchContent).toHaveBeenCalledWith('button', expect.objectContaining({ scope: 'docs' }));
	});

	it('skips the server lane for page/showcase/section facets', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' })]);

		await exec(createSearchCatalogTool('en', 'public'), { query: 'button', surface: 'showcase' });

		expect(mocks.searchContent).not.toHaveBeenCalled();
	});

	it('records surfaced rows into the sink', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' })]);
		const captured: SearchResult[] = [];
		const sink: CatalogSink = { record: (rows) => captured.push(...rows) };

		await exec(createSearchCatalogTool('en', 'public', sink), { query: 'button' });

		expect(captured.map((r) => r.path)).toContain('/showcases/button');
	});

	it('never throws — returns an error envelope when a lane fails', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'doc', path: '/docs/x', title: 'Button Doc' })]);
		mocks.searchContent.mockRejectedValue(new Error('neon down'));

		const out = await exec(createSearchCatalogTool('en', 'public'), { query: 'button' });

		expect(out.results).toEqual([]);
		expect(out.error).toBeTruthy();
	});

	it('returns empty for a blank query without hitting the lanes', async () => {
		mocks.buildSearchIndex.mockReturnValue([]);
		const out = await exec(createSearchCatalogTool('en', 'public'), { query: '   ' });
		expect(out.results).toEqual([]);
		expect(mocks.buildSearchIndex).not.toHaveBeenCalled();
	});
});
