/**
 * Universal search — the single framework-free domain entry point.
 *
 * `searchContent()` powers BOTH the palette's `GET /api/search` (server lane:
 * full-body docs + live blog FTS) and the `/search` page load — never a self-
 * fetch. `buildSearchIndex()` produces the per-locale Lane-A static shard.
 *
 * The instant client lane (page/showcase/section/doc titles) is served from the
 * prerendered shard and matched in-browser; it is NOT re-run here, so Neon
 * cold-start never blocks instant results.
 */
import { getLocale, overwriteGetLocale } from '$lib/paraglide/runtime';
import type { SearchLocale, SearchRecord, SearchResult } from '$lib/search/types';
import { searchBlog } from './adapters/blog';
import { docTitleRecords, searchDocs } from './adapters/docs';
import { pageRecords } from './adapters/pages';
import { showcaseRecords } from './adapters/showcases';

export interface SearchContext {
	locale: SearchLocale;
	limit?: number;
	scope?: 'all' | 'docs' | 'blog';
}

/** Server lane: full-body docs + live blog FTS, each internally ranked. Lanes
 * are isolated — a failing blog query (e.g. before the FTS column is created)
 * never takes down doc search. */
export async function searchContent(query: string, ctx: SearchContext): Promise<SearchResult[]> {
	const q = query.trim();
	if (!q) return [];
	const limit = ctx.limit ?? 8;
	const scope = ctx.scope ?? 'all';

	const tasks: Array<Promise<SearchResult[]>> = [];
	if (scope === 'all' || scope === 'docs') {
		tasks.push(
			Promise.resolve()
				.then(() => searchDocs(q, ctx.locale, limit))
				.catch((err) => {
					console.error('[search] docs lane failed:', err instanceof Error ? err.message : err);
					return [];
				}),
		);
	}
	if (scope === 'all' || scope === 'blog') {
		tasks.push(
			searchBlog(q, ctx.locale, limit).catch((err) => {
				console.error('[search] blog lane failed:', err instanceof Error ? err.message : err);
				return [];
			}),
		);
	}

	const lanes = await Promise.all(tasks);
	return lanes.flat();
}

/**
 * Build the Lane-A static index for one locale (titles only, no bodies).
 * Pins the Paraglide locale while resolving nav labels so prerendered shards
 * carry the right language.
 */
export function buildSearchIndex(locale: SearchLocale): SearchRecord[] {
	const original = getLocale;
	overwriteGetLocale(() => locale);
	try {
		return [...pageRecords(locale), ...showcaseRecords(locale), ...docTitleRecords(locale)];
	} finally {
		overwriteGetLocale(original);
	}
}
