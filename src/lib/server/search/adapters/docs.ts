/**
 * Docs adapter — indexes the build-time markdown corpus.
 *
 * The static shard gets title + description records (no bodies, to stay small).
 * The server lane scans the FULL body in-memory (the 132 docs are already eager-
 * globbed into the server bundle), so full-text doc search costs no DB round-trip
 * and is always fresh on deploy.
 *
 * Docs are English-only today; for de/ru they surface as `localeFallback`
 * records. The corpus is built once (EN) and stamped with the request locale —
 * when native de/ru markdown is authored later, only the manifest needs a locale
 * dimension; this adapter and the query layer are unchanged.
 */
import { extractSnippet, scoreRecords, toResult } from '$lib/search/match';
import type { SearchLocale, SearchRecord, SearchResult } from '$lib/search/types';
import { getManifest, getRawMarkdown } from '$lib/server/docs/manifest';

const SECTION_LABEL: Record<string, string> = {
	foundation: 'Foundation',
	blueprint: 'Blueprint',
	stack: 'Stack',
};

/** Strip frontmatter + common markdown syntax down to searchable plain text. */
function markdownToText(raw: string): string {
	let text = raw;
	// Frontmatter
	if (text.startsWith('---\n')) {
		const end = text.indexOf('\n---', 4);
		if (end !== -1) text = text.slice(end + 4);
	}
	text = text
		.replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
		.replace(/`([^`]+)`/g, '$1') // inline code
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
		.replace(/<[^>]+>/g, ' ') // html tags
		.replace(/^[#>\-*+\s]+/gm, ' ') // heading / quote / list markers
		.replace(/[*_~]/g, '') // emphasis
		.replace(/\|/g, ' ') // table pipes
		.replace(/\s+/g, ' ')
		.trim();
	return text;
}

let corpusCache: SearchRecord[] | null = null;

/** EN corpus with full bodies, built once per server instance. */
function buildCorpus(): SearchRecord[] {
	if (corpusCache) return corpusCache;
	const manifest = getManifest();
	const out: SearchRecord[] = [];

	for (const section of ['foundation', 'blueprint', 'stack'] as const) {
		for (const entry of manifest[section]) {
			const raw = getRawMarkdown(entry.sourcePath) ?? '';
			const sub = entry.layer ?? entry.group;
			out.push({
				id: `doc:en:${entry.section}/${entry.slug}`,
				surface: 'doc',
				locale: 'en',
				localeFallback: false,
				title: entry.title,
				icon: 'i-lucide-book-open',
				path: `/docs/${entry.section}/${entry.slug}`,
				anchor: null,
				breadcrumb: ['Docs', SECTION_LABEL[section] ?? section, ...(sub ? [sub] : [])],
				keywords: entry.description ? [entry.description] : undefined,
				body: markdownToText(raw),
				authScope: 'public',
			});
		}
	}

	corpusCache = out;
	return out;
}

/** Static-shard records: title + description, NO body. */
export function docTitleRecords(locale: SearchLocale): SearchRecord[] {
	const fallback = locale !== 'en';
	return buildCorpus().map((r) => ({ ...r, locale, localeFallback: fallback, body: undefined }));
}

/** Server lane: full-body lexical search with snippets. */
export function searchDocs(query: string, locale: SearchLocale, limit = 10): SearchResult[] {
	const fallback = locale !== 'en';
	return scoreRecords(buildCorpus(), query)
		.slice(0, limit)
		.map(({ record, score }) => {
			const { snippet, highlight } = extractSnippet(record.body ?? '', query);
			const result = toResult(record, score, { snippet, highlight });
			return { ...result, locale, badge: fallback ? ('en-fallback' as const) : null };
		});
}
