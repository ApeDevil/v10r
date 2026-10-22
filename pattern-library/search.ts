/**
 * Pattern search: the ONE tokenizer and scorer behind every reader of the registry — the
 * stdio MCP (relative import, bare Bun), the hosted MCP and Vely's `search_pattern_library`
 * (through `$patterns`). Pure and deterministic: same query, same registry → same ranking.
 * Framework-free and filesystem-free, like `schema.ts`.
 *
 * The ranking is lexical, sized for a corpus of a few hundred short records — no embeddings,
 * no network, nothing to deploy. Each query term earns the weight of the BEST field it appears
 * in (a term repeated across title, keywords and summary is one match, not three), scaled by
 * its rarity across the registry (IDF: "data" in sixty records says little, "stampede" in two
 * says a lot), and the sum is scaled by COVERAGE — the IDF-weighted share of the query that
 * matched at all — so a record answering the whole question outranks one answering a word of
 * it loudly. Coverage also grades every hit `strong | partial | weak`, which is how a query the
 * registry does not cover reads as "weak" instead of as a confident answer.
 * `pattern-library/bench/` holds the relevance sets this was measured against.
 */
import type { PatternRecord } from './schema.ts';

/** Query noise: function words and the filler of a typed request ("should", "want", "using"). */
const STOPWORDS = new Set(
	(
		'the a an of for to and with in on is how what i my we our you your it its this that these those ' +
		'be are was were can could should would will do does did not no but or if so at by from into out up ' +
		'when where which who whom why there their them they me us than then too very just also only any all some ' +
		'each every one two get make use using used want need like without over under about via per own other ' +
		'more most such same both either neither'
	).split(' '),
);

export function tokenizePatternQuery(input: string): string[] {
	return (
		input
			.toLowerCase()
			// A `+` BETWEEN two alphanumerics belongs to the term — `n+1`, `cmd+k`. Splitting on
			// it left two one-character tokens that the length filter then discarded, so the
			// registry's `n+1` keywords matched nothing and a search for "N+1" returned zero
			// rows. A spaced `+` is prose conjunction ("Superforms + Valibot") and still splits.
			.replace(/(?<=[a-z0-9])\+(?=[a-z0-9])/g, 'plus')
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length >= 2 && !STOPWORDS.has(token))
	);
}

/**
 * Light suffix folding so "jobs" meets "job" and "caching" meets "cache". Deliberately crude —
 * applied identically to query and registry, so it only has to be consistent, not linguistic.
 */
function stem(token: string): string {
	let term = token;
	if (term.length > 4 && term.endsWith('ies')) term = `${term.slice(0, -3)}y`;
	else if (term.length > 4 && term.endsWith('sses')) term = term.slice(0, -2);
	else if (term.length > 3 && term.endsWith('s') && !/(ss|us|is)$/.test(term)) term = term.slice(0, -1);
	if (term.length > 5 && term.endsWith('ing')) term = term.slice(0, -3);
	else if (term.length > 4 && term.endsWith('ed')) term = term.slice(0, -2);
	if (term.length > 3 && term.endsWith('e')) term = term.slice(0, -1);
	return term;
}

/** Below this share of the query matched, a hit is an incidental overlap, not an answer. */
const STRONG_COVERAGE = 0.6;
const PARTIAL_COVERAGE = 0.35;
/** A query term this long may also match as a prefix ("virtual" → "virtualized"), at half weight. */
const MIN_PREFIX_LENGTH = 4;

export type MatchStrength = 'strong' | 'partial' | 'weak';

export interface Scored {
	pattern: PatternRecord;
	score: number;
	/** The query's own words that matched, as typed (before suffix folding). */
	matchedTerms: string[];
	matchedFields: string[];
	/** IDF-weighted share of the query that matched, 0-1. */
	coverage: number;
	strength: MatchStrength;
}

/**
 * Field → weight. A term scores the weight of the best field it occurs in. The id is indexed
 * WITHOUT its `<category>-` prefix: that prefix is a namespace, and indexing it let every light
 * `architecture-*` row outrank the deep card for "architecture" — while the rest of the id is
 * often the pattern's canonical name where the title paraphrases it ("layered RAG" is
 * `layered-rag`, titled "Grounded retrieval with a corpus map").
 */
const FIELD_WEIGHTS: Array<[string, number, (p: PatternRecord) => string[]]> = [
	['id', 4, (p) => [p.id.startsWith(`${p.category}-`) ? p.id.slice(p.category.length + 1) : p.id]],
	['title', 5, (p) => [p.title]],
	['keywords', 4, (p) => p.keywords],
	['capabilities', 4, (p) => p.capabilities],
	['category', 2, (p) => [p.category]],
	['summary', 2, (p) => [p.summary]],
	// The problem-language field: "Use when you need …" is how a developer phrases the need.
	['when_to_use', 2, (p) => [p.when_to_use]],
	['invariants', 1, (p) => p.invariants],
];

interface FieldHit {
	weight: number;
	field: string;
}

interface SearchIndex {
	terms: Array<Map<string, FieldHit>>;
	idf: (term: string) => number;
	vocabulary: string[];
}

/** Built once per corpus array and reused: query cost is a lookup, not a re-tokenization. */
const indexes = new WeakMap<readonly PatternRecord[], SearchIndex>();

function indexOf(patterns: readonly PatternRecord[]): SearchIndex {
	const cached = indexes.get(patterns);
	if (cached) return cached;
	const terms = patterns.map((pattern) => {
		const best = new Map<string, FieldHit>();
		for (const [field, weight, getter] of FIELD_WEIGHTS) {
			for (const term of getter(pattern).flatMap(tokenizePatternQuery).map(stem)) {
				if ((best.get(term)?.weight ?? 0) < weight) best.set(term, { weight, field });
			}
		}
		return best;
	});
	const documentFrequency = new Map<string, number>();
	for (const map of terms) {
		for (const term of map.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
	}
	const total = patterns.length;
	const index: SearchIndex = {
		terms,
		// BM25's IDF with Lucene's +1 inside the log: never negative, even for a term in every record.
		idf: (term) => {
			const df = documentFrequency.get(term) ?? 0;
			return Math.log(1 + (total - df + 0.5) / (df + 0.5));
		},
		vocabulary: [...documentFrequency.keys()].sort(),
	};
	indexes.set(patterns, index);
	return index;
}

function strengthOf(coverage: number): MatchStrength {
	if (coverage >= STRONG_COVERAGE) return 'strong';
	return coverage >= PARTIAL_COVERAGE ? 'partial' : 'weak';
}

/**
 * Rank `patterns` (the corpus — pass the whole registry and filter the result, so IDF and the
 * cached index stay stable) for `query`. Records that match nothing are absent.
 */
export function scorePatterns(query: string, patterns: readonly PatternRecord[]): Scored[] {
	const typed = tokenizePatternQuery(query);
	const byStem = new Map<string, string>();
	for (const token of typed) if (!byStem.has(stem(token))) byStem.set(stem(token), token);
	if (byStem.size === 0) return [];
	const index = indexOf(patterns);
	const queryTerms = [...byStem.keys()].map((term) => ({
		term,
		prefixes: term.length >= MIN_PREFIX_LENGTH ? index.vocabulary.filter((v) => v !== term && v.startsWith(term)) : [],
	}));
	const queryWeight = queryTerms.reduce((sum, { term }) => sum + index.idf(term), 0);
	const phrase = query.trim().toLowerCase();
	const asId = phrase.replace(/\s+/g, '-');
	const results: Array<Scored & { exact: boolean }> = [];
	patterns.forEach((pattern, position) => {
		const terms = index.terms[position];
		let score = 0;
		let covered = 0;
		const matchedTerms: string[] = [];
		const matchedFields = new Set<string>();
		for (const { term, prefixes } of queryTerms) {
			const exact = terms.get(term);
			let best = exact ? exact.weight * index.idf(term) : 0;
			let field = exact?.field;
			for (const candidate of prefixes) {
				const hit = terms.get(candidate);
				if (hit && 0.5 * hit.weight * index.idf(candidate) > best) {
					best = 0.5 * hit.weight * index.idf(candidate);
					field = hit.field;
				}
			}
			if (best > 0 && field) {
				score += best;
				covered += index.idf(term);
				matchedTerms.push(byStem.get(term) ?? term);
				matchedFields.add(field);
			}
		}
		if (score === 0) return;
		const coverage = covered / queryWeight;
		const title = pattern.title.toLowerCase();
		// An exact identifier or title is a lookup, not a search: it ranks first regardless of score.
		const exact = pattern.id === asId || title === phrase;
		const titlePhrase = !exact && phrase.length > 3 && title.includes(phrase);
		results.push({
			pattern,
			score: score * coverage * (titlePhrase ? 1.5 : 1),
			matchedTerms,
			matchedFields: [...matchedFields],
			coverage,
			strength: exact ? 'strong' : strengthOf(coverage),
			exact,
		});
	});
	// Tier breaks exact score ties only (deep before light) — a deep card that
	// LOSES to its own index row on score is a curation defect to fix in the data.
	const tierRank = (p: PatternRecord) => (p.tier === 'deep' ? 0 : 1);
	return results
		.sort(
			(a, b) =>
				Number(b.exact) - Number(a.exact) ||
				b.score - a.score ||
				tierRank(a.pattern) - tierRank(b.pattern) ||
				a.pattern.id.localeCompare(b.pattern.id),
		)
		.map(({ exact: _exact, ...hit }) => hit);
}
