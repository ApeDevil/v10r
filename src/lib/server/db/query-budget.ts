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
	'desk.countFolderContents': {
		maxQueries: 2,
		note: 'Subfolder count and file count in one wave; neither iterates the children.',
	},
} as const satisfies Record<string, QueryBudget>;

export type BudgetedOperation = keyof typeof QUERY_BUDGETS;

export const budgetedOperations = Object.keys(QUERY_BUDGETS) as BudgetedOperation[];

/**
 * Repeats of one shape inside a single operation that stop being plausible.
 *
 * Three is where a coincidence becomes a pattern: a read plus its ownership check
 * plus a re-read is defensible, a fourth identical statement is a loop. This is a
 * SUSPICION threshold for the runtime census, not a proof — see `query-census.ts`.
 */
export const SUSPECTED_N_PLUS_ONE_REPEATS = 3;

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
	/** The most-repeated shape and its count, when it passed the suspicion threshold. */
	suspectedNPlusOne: { shape: string; times: number } | null;
}

export function scoreQueryCensus(operation: BudgetedOperation, census: QueryCensus): QueryVerdict {
	const { maxQueries } = QUERY_BUDGETS[operation];
	const worst = census.worst();
	return {
		operation,
		count: census.count,
		maxQueries,
		overBudget: census.count > maxQueries,
		suspectedNPlusOne: worst && worst.times > SUSPECTED_N_PLUS_ONE_REPEATS ? worst : null,
	};
}
