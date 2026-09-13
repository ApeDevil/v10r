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

import { type CatalogSink, createSearchCatalogTool, searchCatalogRecords } from './search-catalog';

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
function exec(tool: any, args: ToolArgs, options: { toolCallId?: string } = {}) {
	return tool.search_catalog.execute(args, options) as Promise<{
		results: Array<Record<string, unknown>>;
		error?: string;
	}>;
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

	it('records surfaced rows into the sink, attributed to the tool call that surfaced them', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' })]);
		const captured: SearchResult[] = [];
		const calls: Array<string | undefined> = [];
		const sink: CatalogSink = {
			record: (rows, toolCallId) => {
				captured.push(...rows);
				calls.push(toolCallId);
			},
		};

		await exec(createSearchCatalogTool('en', 'public', sink), { query: 'button' }, { toolCallId: 'call_1' });

		expect(captured.map((r) => r.path)).toContain('/showcases/button');
		expect(calls).toEqual(['call_1']);
	});

	it('never throws — returns an error envelope when a lane fails', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'doc', path: '/docs/x', title: 'Button Doc' })]);
		mocks.searchContent.mockRejectedValue(new Error('neon down'));

		const out = await exec(createSearchCatalogTool('en', 'public'), { query: 'button' });

		expect(out.results).toEqual([]);
		expect(out.error).toBeTruthy();
	});

	it('browses the static index for a blank query, bypassing the FTS server lane', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' })]);
		const out = await exec(createSearchCatalogTool('en', 'public'), { query: '   ' });
		expect(out.results.map((r) => r.path)).toEqual(['/showcases/button']);
		expect(mocks.searchContent).not.toHaveBeenCalled();
	});

	it('enumerates a surface for a wildcard query (browse mode), filtering by surface', async () => {
		mocks.buildSearchIndex.mockReturnValue([
			rec({ surface: 'showcase', path: '/showcases/button', title: 'Button' }),
			rec({ surface: 'showcase', path: '/showcases/switch', title: 'Switch' }),
			rec({ surface: 'doc', path: '/docs/x', title: 'Doc X' }),
		]);
		const out = await exec(createSearchCatalogTool('en', 'public'), { query: '*', surface: 'showcase' });
		expect(out.results.map((r) => r.path)).toEqual(['/showcases/button', '/showcases/switch']);
		expect(out.results.every((r) => r.surface === 'showcase')).toBe(true);
		expect(mocks.searchContent).not.toHaveBeenCalled();
	});
});

/**
 * The search itself — ONE DOOR: the tool's `execute` and the context assembly's navigation
 * grounding both call it, so the rows put in the prompt before generation are the same
 * verified rows a tool call would surface.
 */
describe('searchCatalogRecords', () => {
	it('returns the merged, ranked rows themselves and records them into the sink', async () => {
		mocks.buildSearchIndex.mockReturnValue([
			rec({ surface: 'showcase', path: '/showcases/auth/authn', title: 'AuthN' }),
			rec({ surface: 'showcase', path: '/showcases/forms/auth', title: 'Auth' }),
			rec({ surface: 'doc', path: '/docs/stack/better-auth', title: 'Better Auth' }),
		]);
		const captured: SearchResult[] = [];
		const sink: CatalogSink = { record: (rows) => captured.push(...rows) };

		const rows = await searchCatalogRecords('auth', {
			locale: 'en',
			authCeiling: null,
			surface: 'showcase',
			limit: 5,
			sink,
		});

		// A facet restricts the static lane and skips the server lane entirely.
		expect(rows.map((r) => r.path)).toEqual(['/showcases/forms/auth', '/showcases/auth/authn']);
		expect(rows[0]).toMatchObject({ surface: 'showcase', title: 'Auth', score: expect.any(Number) });
		expect(captured).toEqual(rows);
		expect(mocks.searchContent).not.toHaveBeenCalled();
	});

	it('throws when a lane fails — the caller owns the degrade', async () => {
		mocks.buildSearchIndex.mockReturnValue([rec({ surface: 'doc', path: '/docs/x', title: 'X' })]);
		mocks.searchContent.mockRejectedValue(new Error('neon down'));

		await expect(searchCatalogRecords('x', { locale: 'en', authCeiling: null, surface: null })).rejects.toThrow(
			'neon down',
		);
	});
});
