/**
 * Blog adapter — wraps the live Postgres FTS query and maps hits to the shared
 * `SearchResult` shape. Blog content is genuinely per-locale, so results are
 * native (no fallback badge). Snippets come from `ts_headline`; we strip its
 * non-printing sentinels into plain text + highlight ranges (HTML-free).
 */
import type { SearchResult } from '$lib/search/types';
import { HL_START, HL_STOP, searchPublishedRevisions } from '$lib/server/blog';

/** Convert a `ts_headline` string (with STX/ETX markers) → plain text + ranges. */
function parseHeadline(headline: string): { snippet: string; highlight: [number, number][] } {
	let snippet = '';
	const highlight: [number, number][] = [];
	let open = -1;
	for (const ch of headline) {
		if (ch === HL_START) {
			open = snippet.length;
		} else if (ch === HL_STOP) {
			if (open >= 0) {
				highlight.push([open, snippet.length]);
				open = -1;
			}
		} else {
			snippet += ch;
		}
	}
	return { snippet, highlight };
}

export async function searchBlog(query: string, locale: string, limit = 10): Promise<SearchResult[]> {
	const hits = await searchPublishedRevisions(query, locale, limit);
	return hits.map((hit) => {
		const { snippet, highlight } = parseHeadline(hit.headline);
		return {
			id: `blog:${hit.locale}:${hit.slug}`,
			surface: 'blog' as const,
			title: hit.title,
			icon: 'i-lucide-newspaper',
			path: `/blog/${hit.slug}`,
			anchor: null,
			breadcrumb: ['Blog'],
			snippet: snippet || hit.summary || null,
			highlight: snippet ? highlight : [],
			locale: hit.locale,
			badge: null,
			score: hit.rank,
		};
	});
}
