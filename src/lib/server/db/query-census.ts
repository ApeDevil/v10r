/**
 * Query census — how many times one request went to the database, and how many of
 * those were the same question asked again.
 *
 * Latency work stalls at "the page is slow" until the round trips are countable.
 * A census is the counting half: it observes every statement Drizzle sends inside a
 * scope and reports the total plus the repeated shapes. It deliberately does NOT
 * time individual statements — Drizzle's `Logger` fires before execution and carries
 * no duration, and a wrapper around the driver would buy a wall clock around a
 * network call when `EXPLAIN ANALYZE` already answers "why is this query slow"
 * better. The question this answers is the one the driver can answer honestly:
 * *how many times did we ask?*
 *
 * Two things are load-bearing.
 *
 *   Free when nobody is counting. Outside a scope `observeQuery` is one
 *   `AsyncLocalStorage.getStore()` and a return. Drizzle has already built the SQL
 *   string it hands us, so nothing is serialized for the census's benefit.
 *
 *   A repeat is a suspicion, not a verdict. Two identical statements may be two
 *   legitimate lookups. N+1 is not "this shape repeated" — it is "the count grows
 *   with the row count", and a single request cannot see that: it has one row count.
 *   The runtime census reports the suspicion; `query-budget.gate.pglite.test.ts`
 *   proves the scaling by running the same operation over two data sizes. Do not
 *   promote the heuristic into an assertion here.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from 'drizzle-orm';

/** A statement shape and how many times it was sent. */
export interface RepeatedShape {
	shape: string;
	times: number;
}

/**
 * Ceiling on DISTINCT shapes retained. Reached only by a request that generates
 * unbounded query variety — which is the bug, not the budget — so overflow stops
 * recording shapes while `count` keeps counting truthfully.
 */
export const MAX_OBSERVED_SHAPES = 128;

/** Statement shapes are stored, compared and printed; an unbounded one is a memory leak in a log line. */
const MAX_SHAPE_CHARS = 300;

/**
 * Reduce a statement to its shape, so the same question asked about different rows
 * counts as one shape.
 *
 * The parameter-list collapse is the rule that matters: `id IN ($1, $2, $3)` and
 * `id IN ($1, $2, ..., $30)` are one batched read, and a normalizer that told them
 * apart would report every batch as a new shape — which is precisely backwards,
 * since batching is the fix for the thing this measures.
 */
export function queryShape(statement: string): string {
	return statement
		.replace(/\s+/g, ' ')
		.replace(/'[^']*'/g, "'?'")
		.replace(/\$\d+(?:\s*,\s*\$\d+)+/g, '$…')
		.replace(/\$\d+/g, '$?')
		.replace(/\b\d+\b/g, 'N')
		.trim()
		.slice(0, MAX_SHAPE_CHARS);
}

export interface QueryCensus {
	/** Round trips observed, including any whose shape was dropped past the cap. */
	readonly count: number;
	/** Distinct shapes with their send counts, most repeated first. */
	repeats(): RepeatedShape[];
	/** The most repeated shape, or `null` when nothing was sent twice. */
	worst(): RepeatedShape | null;
	/** Run `work` with this census collecting every query made inside it, at any depth. */
	run<T>(work: () => T): T;
}

interface CensusRecorder {
	total: number;
	shapes: Map<string, number>;
}

const scope = new AsyncLocalStorage<CensusRecorder>();

function viewOf(recorder: CensusRecorder): QueryCensus {
	const repeats = (): RepeatedShape[] =>
		[...recorder.shapes.entries()].map(([shape, times]) => ({ shape, times })).sort((a, b) => b.times - a.times);

	return {
		get count() {
			return recorder.total;
		},
		repeats,
		worst() {
			const [first] = repeats();
			return first && first.times > 1 ? first : null;
		},
		run: (work) => scope.run(recorder, work),
	};
}

export function startQueryCensus(): QueryCensus {
	return viewOf({ total: 0, shapes: new Map() });
}

/** Record one round trip against the census in scope. A no-op when nobody is counting. */
export function observeQuery(statement: string): void {
	const recorder = scope.getStore();
	if (!recorder) return;

	recorder.total += 1;
	const shape = queryShape(statement);
	const seen = recorder.shapes.get(shape);
	if (seen === undefined && recorder.shapes.size >= MAX_OBSERVED_SHAPES) return;
	recorder.shapes.set(shape, (seen ?? 0) + 1);
}

/**
 * The Drizzle seam. Passed as the driver's `logger`, which is why nothing else in the
 * codebase has to remember to call `observeQuery` — every statement any domain sends
 * goes through here, including the ones inside Better Auth's session lookup.
 */
export const queryCensusLogger: Logger = {
	logQuery(query) {
		observeQuery(query);
	},
};
