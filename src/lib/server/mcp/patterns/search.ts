/**
 * Pure scoring + dependency-ordering over the pattern registry. Deterministic: same query,
 * same registry → same ranking (ties break by registry order). No I/O, no framework.
 *
 * This mirrors the algorithm in the stdio server's `mcp/tools.ts` / `mcp/registry.ts`. The
 * duplication is deliberate — the two runtimes cannot safely share one module (the container
 * server has no `$lib` alias and no bundler), so the stdio copy stays self-contained and this
 * copy serves the hosted transport. `patterns/parity.test.ts` guards the two against drift.
 */
import type { PatternRecord } from '$lib/server/patterns';
import { PATTERNS } from '$lib/server/patterns';

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'and', 'with', 'in', 'on', 'is', 'how', 'what']);

export function tokenizePatternQuery(input: string): string[] {
	return input
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export interface Scored {
	pattern: PatternRecord;
	score: number;
	matchedTerms: string[];
	matchedFields: string[];
}

const FIELD_WEIGHTS: Array<[string, number, (p: PatternRecord) => string[]]> = [
	['title', 5, (p) => [p.title]],
	['keywords', 4, (p) => p.keywords],
	['capabilities', 4, (p) => p.capabilities],
	['category', 3, (p) => [p.category]],
	['summary', 2, (p) => [p.summary]],
	['invariants', 1, (p) => p.invariants],
];

export function scorePatterns(query: string, patterns: PatternRecord[] = PATTERNS): Scored[] {
	const queryTokens = tokenizePatternQuery(query);
	const fullQuery = query.trim().toLowerCase();
	const results: Scored[] = [];
	for (const pattern of patterns) {
		let score = 0;
		const matchedTerms = new Set<string>();
		const matchedFields = new Set<string>();
		for (const [field, weight, getter] of FIELD_WEIGHTS) {
			const fieldTokens = getter(pattern).flatMap(tokenizePatternQuery);
			for (const token of queryTokens) {
				if (fieldTokens.includes(token)) {
					score += weight;
					matchedTerms.add(token);
					matchedFields.add(field);
				} else if (fieldTokens.some((candidate) => candidate.startsWith(token))) {
					score += weight / 2;
					matchedTerms.add(token);
					matchedFields.add(field);
				}
			}
		}
		if (fullQuery.length > 3 && pattern.title.toLowerCase().includes(fullQuery)) {
			score += 3;
			matchedFields.add('title');
		}
		if (score > 0) {
			results.push({ pattern, score, matchedTerms: [...matchedTerms], matchedFields: [...matchedFields] });
		}
	}
	// Tier breaks exact score ties only (deep before light) — a deep card that
	// LOSES to its own index row on score is a curation defect to fix in the data.
	const tierRank = (p: PatternRecord) => (p.tier === 'deep' ? 0 : 1);
	return results.sort(
		(a, b) =>
			b.score - a.score || tierRank(a.pattern) - tierRank(b.pattern) || a.pattern.id.localeCompare(b.pattern.id),
	);
}

/**
 * Kahn topological sort over depends_on edges, restricted to the selected id set.
 * Deterministic: ties break by registry order. On a cycle, remaining nodes are appended in
 * registry order and `cyclic` is flagged.
 */
export function topoSort(
	selected: string[],
	byId: Map<string, PatternRecord>,
	registryOrder: string[],
): { order: string[]; cyclic: boolean } {
	const inSet = new Set(selected);
	const rank = new Map(registryOrder.map((id, index) => [id, index]));
	const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
	const indegree = new Map<string, number>();
	for (const id of inSet) {
		const deps = byId.get(id)?.depends_on.filter((dep) => inSet.has(dep)) ?? [];
		indegree.set(id, deps.length);
	}
	const order: string[] = [];
	let ready = [...inSet].filter((id) => indegree.get(id) === 0).sort(byRank);
	while (ready.length > 0) {
		const next = ready.shift();
		if (next === undefined) break;
		order.push(next);
		const unlocked: string[] = [];
		for (const id of inSet) {
			if (order.includes(id) || ready.includes(id)) continue;
			const deps = byId.get(id)?.depends_on.filter((dep) => inSet.has(dep)) ?? [];
			if (deps.every((dep) => order.includes(dep))) unlocked.push(id);
		}
		ready = [...ready, ...unlocked.filter((id) => !ready.includes(id))].sort(byRank);
	}
	const cyclic = order.length < inSet.size;
	if (cyclic) {
		const remaining = [...inSet].filter((id) => !order.includes(id)).sort(byRank);
		order.push(...remaining);
	}
	return { order, cyclic };
}
