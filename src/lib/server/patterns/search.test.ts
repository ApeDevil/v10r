import { describe, expect, it } from 'vitest';
import { PATTERNS } from '$lib/server/patterns';
import devQueries from '$patterns/bench/dev-queries.json';
import holdoutQueries from '$patterns/bench/holdout-queries.json';
import holdout2Queries from '$patterns/bench/holdout2-queries.json';
import { scorePatterns, tokenizePatternQuery } from '$patterns/search';

/**
 * Scoring is purely lexical — no embeddings, only crude suffix folding, no synonym table — so a
 * keyword that does not survive tokenization is dead weight that looks like coverage. `n+1` was
 * exactly that for two records, including the one whose whole subject it is.
 */
describe('tokenizePatternQuery', () => {
	it('keeps a `+` that joins two alphanumerics', () => {
		expect(tokenizePatternQuery('N+1')).toEqual(['nplus1']);
		expect(tokenizePatternQuery('cmd+k')).toEqual(['cmdplusk']);
	});

	it('still splits a `+` used as prose conjunction', () => {
		expect(tokenizePatternQuery('Superforms + Valibot')).toEqual(['superforms', 'valibot']);
	});

	it('normalizes query and keyword identically, which is what makes them meet', () => {
		expect(tokenizePatternQuery('N+1 queries')[0]).toBe(tokenizePatternQuery('n+1')[0]);
	});
});

describe('registry recall', () => {
	// The anti-rot rule the `n+1` defect earned: a keyword nobody can match is worse than a
	// missing one, because the registry reads as if the term were covered.
	it('has no keyword that tokenizes to nothing', () => {
		const inert = PATTERNS.flatMap((pattern) =>
			pattern.keywords
				.filter((keyword) => tokenizePatternQuery(keyword).length === 0)
				.map((keyword) => `${pattern.id}: ${keyword}`),
		);
		expect(inert).toEqual([]);
	});

	it('finds the query-budget card from the problem language a developer would type', () => {
		const ids = scorePatterns('N+1', PATTERNS).map((hit) => hit.pattern.id);
		expect(ids).toContain('query-budget');
		expect(ids).toContain('no-waterfall-loading');
	});
});

const top = (query: string) => scorePatterns(query, PATTERNS)[0];

describe('ranking', () => {
	it('weighs a rare term over a common one (IDF), so the distinctive word decides', () => {
		expect(top('cache stampede protection')?.pattern.id).toBe('singleflight');
	});

	it('treats an exact id as a lookup, ranked first whatever the scores', () => {
		// Before: "layered-rag" returned ai-graph-rag first — its title repeats "rag" louder.
		expect(top('layered-rag')?.pattern.id).toBe('layered-rag');
		expect(top('layered-rag')?.strength).toBe('strong');
	});

	it('folds plurals and -ing forms on both sides', () => {
		expect(top('background job')?.pattern.id).toBe(top('background jobs')?.pattern.id);
		expect(scorePatterns('caching', PATTERNS).map((hit) => hit.pattern.id)).toContain('hierarchical-cache');
	});

	it('does not let a category word in light ids bury the deep card', () => {
		const ids = scorePatterns('architecture', PATTERNS)
			.slice(0, 5)
			.map((hit) => hit.pattern.id);
		expect(ids).toContain('multi-client-core');
	});

	it('grades an uncovered capability weak instead of answering it confidently', () => {
		for (const query of ['kubernetes helm chart deployment', 'stripe payment checkout']) {
			const best = top(query);
			expect(best === undefined || best.strength === 'weak', query).toBe(true);
		}
	});

	it('reports the words as typed, not as folded', () => {
		expect(top('background jobs')?.matchedTerms).toContain('jobs');
	});
});

/**
 * Relevance floors — a ratchet, not a target. The numbers are what the engine measured when the
 * floor was set (`bun run mcp:bench`); a change that lowers either fails here, a change that
 * raises them should raise the floor. `holdout` was labelled blind to the engine and must never
 * be tuned against: it is the generalization check, `dev` the regression check.
 */
interface LabelledQuery {
	query: string;
	relevant: string[];
	acceptable: string[];
}

describe('relevance floors', () => {
	function accuracyAt1(queries: LabelledQuery[]) {
		const answerable = queries.filter((q) => q.relevant.length > 0);
		const hits = answerable.filter((q) => {
			const id = top(q.query)?.pattern.id;
			return id !== undefined && [...q.relevant, ...q.acceptable].includes(id);
		});
		return hits.length / answerable.length;
	}
	function recallAt3(queries: LabelledQuery[]) {
		const answerable = queries.filter((q) => q.relevant.length > 0);
		const total = answerable.reduce((sum, q) => {
			const top3 = new Set(
				scorePatterns(q.query, PATTERNS)
					.slice(0, 3)
					.map((hit) => hit.pattern.id),
			);
			return sum + q.relevant.filter((id) => top3.has(id)).length / Math.min(3, q.relevant.length);
		}, 0);
		return total / answerable.length;
	}
	function weakOnMissing(queries: LabelledQuery[]) {
		return queries
			.filter((q) => q.relevant.length === 0)
			.every((q) => {
				const best = top(q.query);
				return best === undefined || best.strength === 'weak';
			});
	}

	it('dev set', () => {
		expect(accuracyAt1(devQueries.queries)).toBeGreaterThanOrEqual(1);
		expect(recallAt3(devQueries.queries)).toBeGreaterThanOrEqual(0.99);
		expect(weakOnMissing(devQueries.queries)).toBe(true);
	});

	it('blind holdout set', () => {
		expect(accuracyAt1(holdoutQueries.queries)).toBeGreaterThanOrEqual(0.76);
		expect(recallAt3(holdoutQueries.queries)).toBeGreaterThanOrEqual(0.88);
		expect(weakOnMissing(holdoutQueries.queries)).toBe(true);
	});

	// Labelled after the ranking work and first scored once, untuned: 52.9% → 79.4% Acc@1 against
	// the previous engine. One of its six uncovered requests still tops out partial, not weak.
	it('second blind holdout set', () => {
		expect(accuracyAt1(holdout2Queries.queries)).toBeGreaterThanOrEqual(0.79);
		expect(recallAt3(holdout2Queries.queries)).toBeGreaterThanOrEqual(0.83);
	});
});

/**
 * Plan precision over the dev plans: every required step present and nothing unrequested — a
 * partial runner-up per capability used to drag its own dependency chain into the plan.
 */
describe('plan precision', () => {
	it('builds every dev plan from exactly its required patterns', async () => {
		const { recommendPlan } = await import('$patterns/query');
		const { REGISTRY } = await import('$lib/server/patterns');
		for (const plan of devQueries.plans) {
			const outcome = recommendPlan(REGISTRY, { capabilities: plan.capabilities });
			const steps = [...outcome.text.matchAll(/^### Step \d+: .*\(`([a-z0-9-]+)`\)/gm)].map((match) => match[1]);
			expect(new Set(steps), plan.id).toEqual(new Set(plan.required));
		}
	});
});
