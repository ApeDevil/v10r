/**
 * Query budgets — the declared round-trip cost of the operations worth defending.
 *
 * A budget here is the same kind of promise as a ceiling in `perf/budgets.json`: a
 * measured number, accepted deliberately, that a gate stops from growing. The subject
 * differs — that file budgets metrics, this one budgets *operations* — which is why
 * it is a separate declaration rather than another section of the same JSON: these
 * are keyed by a function, asserted by naming it, and meaningless without it.
 *
 * The number that matters is not the size of the budget. It is that the budget is
 * CONSTANT: every operation below makes the same number of round trips whether it
 * returns three rows or thirty. That is the whole definition of "no N+1", and
 * `query-budget.gate.pglite.test.ts` proves it by running each operation over two
 * data sizes and requiring the counts to match.
 *
 * Registration is deliberate and partial. An operation listed here is one somebody
 * decided to defend; the absence of an operation means nobody has measured it, never
 * that it is fine. `docs/blueprint/velocity/data.md` records which is which.
 */

import type { QueryCensus } from './query-census';

export interface QueryBudget {
	/** Round trips this operation may make, at ANY row count. */
	maxQueries: number;
	/** The evidence: what those round trips are, so a change to the number is arguable. */
	note: string;
}

/**
 * The registered operations, keyed `<domain>.<function>`.
 *
 * Keep this small. A registry that lists everything is a registry nobody re-measures,
 * and the value is entirely in the re-measuring.
 */
export const QUERY_BUDGETS = {
	'blog.listPosts': {
		maxQueries: 5,
		note: 'Two waves: count + page, then revisions + tags + domains batched by the fetched ids.',
	},
	'desk.listFiles': {
		maxQueries: 2,
		note: 'One page read and one count, issued together — the count is not a second wave.',
	},
	'desk.listFolders': {
		maxQueries: 1,
		note: 'A single capped read; the tree is assembled in memory, not by walking parents.',
	},
} as const satisfies Record<string, QueryBudget>;

export type BudgetedOperation = keyof typeof QUERY_BUDGETS;

export const budgetedOperations = Object.keys(QUERY_BUDGETS) as BudgetedOperation[];

/**
 * Round trips one HTTP request may make before it is worth a log line.
 *
 * Generous on purpose. This is not a budget anyone is held to; it is the tripwire for
 * the request that suddenly makes ninety queries, which is always a bug and is
 * otherwise invisible until someone reads a database bill.
 */
export const REQUEST_QUERY_CEILING = 40;

export interface QueryVerdict {
	operation: string;
	count: number;
	maxQueries: number;
	overBudget: boolean;
}

export function scoreQueryCensus(operation: BudgetedOperation, census: QueryCensus): QueryVerdict {
	const { maxQueries } = QUERY_BUDGETS[operation];
	return {
		operation,
		count: census.count,
		maxQueries,
		overBudget: census.count > maxQueries,
	};
}
