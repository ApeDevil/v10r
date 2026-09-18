/**
 * Deadline propagation — one budget for the whole request, divided rather than repeated.
 *
 * The failure this prevents is not a slow dependency. It is arithmetic: every layer
 * picks a timeout that looks reasonable on its own, and the request's real bound is
 * their SUM. Three sequential calls at "a generous 30 seconds each" is a ninety-second
 * worst case that nobody chose and nobody can find, because no single number in the
 * code is wrong.
 *
 * So a deadline is stamped once, at the edge, and every downstream operation receives
 * what is LEFT of it instead of a fresh window of its own:
 *
 *     request budget ──▶ remaining ──▶ operation ──▶ remaining ──▶ next operation
 *
 * `child()` is where the rule lives: a child is bounded by `min(what it asked for,
 * what the parent has left)`, so a child can never outlive its parent no matter what
 * it requests. That single clamp is what makes retry-plus-timeout composable rather
 * than multiplicative — a retry drawing from the same budget cannot extend the
 * request, which is why `resilience/retry.ts` takes a deadline and not an attempt
 * count alone.
 *
 * What this does NOT do is cancel work. `run()` stops WAITING at the deadline; an
 * operation that ignores its `AbortSignal` keeps running to completion somewhere
 * behind the rejection. Its promise is given a `.catch` before the race so that
 * late rejection cannot take the serverless process down (SvelteKit #9785) — the
 * same rule `platform/after-response.ts` follows, for the same reason.
 *
 * A deadline states a bound. Honouring it is still each leaf's job, and every leaf
 * decides for itself what to return when the budget runs out: a fallback, stale data,
 * or a 504. That decision is domain knowledge and cannot be inherited.
 */
import { ServerError } from '$lib/server/errors';

/**
 * Default request budget, in milliseconds.
 *
 * Matched to the `maxDuration: 10` most route handlers declare, minus nothing: this
 * is a budget for the WORK, and a request that spends its entire function allowance
 * inside one deadline has already lost. Routes that declare `maxDuration: 60` (AI
 * streaming, ingest) are long by design and should start their own wider deadline
 * rather than inherit a number chosen for ordinary pages.
 */
export const DEFAULT_REQUEST_BUDGET_MS = 10_000;

export class DeadlineExceededError extends ServerError {
	constructor(message: string) {
		super('deadline', message);
		this.name = 'DeadlineExceededError';
	}

	/** 504: the work did not fail, it ran out of time — a distinction the caller can act on. */
	override toStatus(): number {
		return 504;
	}
}

export interface Deadline {
	/** What this deadline was granted when it started. Never changes. */
	readonly budgetMs: number;
	/** Milliseconds left, floored at 0. */
	remainingMs(): number;
	expired(): boolean;
	/**
	 * A sub-budget for one downstream operation.
	 *
	 * `maxMs` is a ceiling, not a grant — the child gets the smaller of it and what
	 * this deadline has left. `reserveMs` holds time back for work that has to happen
	 * AFTER the child (writing the response, a compensating delete), so the caller is
	 * not left with a completed dependency call and no budget to use the result.
	 */
	child(maxMs: number, options?: { reserveMs?: number }): Deadline;
	/**
	 * An `AbortSignal` that fires when this deadline does.
	 *
	 * A fresh one per call: `AbortSignal.timeout()` is single-use, so a retry or a
	 * fallback attempt must mint its own or it starts already-aborted.
	 */
	signal(): AbortSignal;
	/**
	 * Run `work` under this deadline, rejecting with `DeadlineExceededError` when the
	 * budget runs out first. Rejects immediately, without starting anything, when
	 * there is no budget left — the point of a deadline is not paying for work that
	 * cannot be used.
	 */
	run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T>;
}

function deadlineFrom(expiresAt: number, budgetMs: number): Deadline {
	const remainingMs = () => Math.max(0, expiresAt - performance.now());

	return {
		budgetMs,
		remainingMs,
		expired: () => remainingMs() === 0,

		child(maxMs, options) {
			const allowed = Math.max(0, Math.min(maxMs, remainingMs() - (options?.reserveMs ?? 0)));
			return deadlineFrom(performance.now() + allowed, allowed);
		},

		// Whole milliseconds: Node's `AbortSignal.timeout()` throws RangeError on the fraction
		// `performance.now()` carries (Bun accepts it, which is how this reached production).
		// Ceil, never floor — a signal must not fire before the deadline it stands for.
		signal: () => AbortSignal.timeout(Math.ceil(remainingMs())),

		async run(work) {
			const budget = remainingMs();
			if (budget === 0) throw new DeadlineExceededError('deadline passed before the operation started');

			const controller = new AbortController();
			const expired = new DeadlineExceededError(`operation exceeded its ${Math.round(budget)}ms budget`);
			let timer: ReturnType<typeof setTimeout> | undefined;

			const running = work(controller.signal);
			// Attached BEFORE the race, not after: once the race rejects on the timer,
			// nothing is listening to `running`, and an unhandled rejection can take the
			// serverless process down (SvelteKit #9785).
			running.catch(() => {});

			try {
				return await Promise.race([
					running,
					new Promise<never>((_, reject) => {
						// Whole milliseconds, rounded UP: the timer floors a fractional delay and
						// `remainingMs()` does not, so a budget of 18.7 ms fired at 18 ms rejected
						// with the deadline still reporting 0.7 ms left — an expired run whose
						// deadline said it had not expired (flaky `retryWithin` budget test).
						timer = setTimeout(() => {
							controller.abort(expired);
							reject(expired);
						}, Math.ceil(budget));
					}),
				]);
			} finally {
				clearTimeout(timer);
			}
		},
	};
}

/** Start a budget. The edge does this once per request; a job does it once per run. */
export function startDeadline(budgetMs: number = DEFAULT_REQUEST_BUDGET_MS): Deadline {
	return deadlineFrom(performance.now() + Math.max(0, budgetMs), Math.max(0, budgetMs));
}
