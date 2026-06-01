/**
 * Pure, client-safe lexical matcher for the Lane-A static index and the
 * server-side doc corpus. No I/O, no `$lib/server` import, no dependencies —
 * scoped to a few hundred small records, so a hand-rolled token scorer is
 * ample and avoids shipping a search library.
 */
import type { SearchRecord, SearchResult } from './types';

/** Lowercase, Unicode-aware tokenization (keeps Cyrillic / accented letters). */
export function tokenize(input: string): string[] {
	const matched = input.toLowerCase().match(/[\p{L}\p{N}]+/gu);
	return matched ?? [];
}

interface Scored {
	record: SearchRecord;
	score: number;
}

/**
 * Score every record against the query with AND semantics — each query token
 * must appear somewhere (title, keywords, breadcrumb, or body) or the record is
 * dropped. Returns matches sorted by descending score.
 */
export function scoreRecords(records: SearchRecord[], query: string): Scored[] {
	const tokens = tokenize(query);
	if (tokens.length === 0) return [];
	const raw = query.trim().toLowerCase();

	const out: Scored[] = [];
	for (const record of records) {
		const titleLc = record.title.toLowerCase();
		const titleTokens = tokenize(record.title);
		const keywordTokens = record.keywords ? record.keywords.flatMap(tokenize) : [];
		const breadcrumbLc = record.breadcrumb.join(' ').toLowerCase();
		const bodyLc = record.body ? record.body.toLowerCase() : '';

		let score = 0;
		let allMatched = true;
		for (const qt of tokens) {
			let tokenScore = 0;
			if (titleTokens.includes(qt)) tokenScore = 10;
			else if (titleTokens.some((t) => t.startsWith(qt))) tokenScore = 6;
			else if (titleLc.includes(qt)) tokenScore = 3;
			else if (keywordTokens.includes(qt)) tokenScore = 5;
			else if (keywordTokens.some((t) => t.startsWith(qt))) tokenScore = 3;
			else if (breadcrumbLc.includes(qt)) tokenScore = 2;
			else if (bodyLc.includes(qt)) tokenScore = 1;

			if (tokenScore === 0) {
				allMatched = false;
				break;
			}
			score += tokenScore;
		}
		if (!allMatched) continue;

		// Whole-phrase title hit is a strong signal.
		if (raw.length > 0 && titleLc.includes(raw)) score += 5;
		// EN content shown to a de/ru user ranks slightly below native matches.
		if (record.localeFallback) score *= 0.85;

		out.push({ record, score });
	}

	return out.sort((a, b) => b.score - a.score);
}

/** Map a scored record to the wire `SearchResult` shape (optionally with a snippet). */
export function toResult(
	record: SearchRecord,
	score: number,
	extra?: { snippet: string | null; highlight: [number, number][] },
): SearchResult {
	return {
		id: record.id,
		surface: record.surface,
		title: record.title,
		icon: record.icon,
		path: record.path,
		anchor: record.anchor,
		breadcrumb: record.breadcrumb,
		snippet: extra?.snippet ?? null,
		highlight: extra?.highlight ?? [],
		locale: record.locale,
		badge: record.localeFallback ? 'en-fallback' : null,
		score,
	};
}

/** Lane-A entry point: title/keyword/breadcrumb matching, no snippets. */
export function match(records: SearchRecord[], query: string, limit = 20): SearchResult[] {
	return scoreRecords(records, query)
		.slice(0, limit)
		.map(({ record, score }) => toResult(record, score));
}

/**
 * Build a plain-text excerpt around the first query-token hit in `body`, with
 * `[start,end]` highlight ranges (relative to the returned snippet). HTML-free —
 * the client renders the ranges with `<mark>`, never `{@html}`.
 */
export function extractSnippet(
	body: string,
	query: string,
	radius = 80,
): { snippet: string | null; highlight: [number, number][] } {
	const tokens = tokenize(query);
	if (tokens.length === 0 || body.length === 0) return { snippet: null, highlight: [] };

	const bodyLc = body.toLowerCase();
	let hit = -1;
	let hitToken = '';
	for (const qt of tokens) {
		const idx = bodyLc.indexOf(qt);
		if (idx !== -1 && (hit === -1 || idx < hit)) {
			hit = idx;
			hitToken = qt;
		}
	}
	if (hit === -1) return { snippet: null, highlight: [] };

	let start = Math.max(0, hit - radius);
	let end = Math.min(body.length, hit + hitToken.length + radius);
	// Snap to word boundaries so we don't slice mid-word.
	while (start > 0 && /[\p{L}\p{N}]/u.test(body[start - 1])) start--;
	while (end < body.length && /[\p{L}\p{N}]/u.test(body[end])) end++;

	let snippet = body.slice(start, end).trim();
	const prefix = start > 0 ? '… ' : '';
	const suffix = end < body.length ? ' …' : '';
	snippet = prefix + snippet + suffix;

	// Mark every query token occurrence inside the snippet.
	const snippetLc = snippet.toLowerCase();
	const highlight: [number, number][] = [];
	for (const qt of tokens) {
		let from = 0;
		let at = snippetLc.indexOf(qt, from);
		while (at !== -1) {
			highlight.push([at, at + qt.length]);
			from = at + qt.length;
			at = snippetLc.indexOf(qt, from);
		}
	}
	highlight.sort((a, b) => a[0] - b[0]);

	return { snippet, highlight };
}
