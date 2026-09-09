/**
 * Retry — bounded by the request's budget, never by its own optimism.
 *
 * A retry is the easiest resilience mechanism to add and the easiest to get wrong,
 * and both mistakes have the same shape: it multiplies. Three attempts at a
 * "reasonable" 30-second timeout is a 90-second request. Three clients each retrying
 * three times is nine calls at the exact moment the dependency is least able to take
 * them — the retry storm, where the recovery mechanism is the load that prevents
 * recovery.
 *
 * Two rules stop both, and they are why this function takes a `Deadline` as its first
 * argument rather than a timeout as its third:
 *
 *   A retry spends the SAME budget as the attempt it replaces. There is one clock for
 *   the whole operation, so attempts and the waits between them draw it down together
 *   and the request's bound is what it was before retrying was added.
 *
 *   Backoff carries FULL jitter — `random() * capped_delay`, not `capped_delay` and
 *   not `capped_delay ± a bit`. Clients that failed together retry together unless
 *   something spreads them, and a fixed backoff spreads nothing: it reproduces the
 *   synchronised burst one delay later. Jitter is the part that does the work.
 *
 * ## Only for idempotent work
 *
 * This cannot check that for you. Retrying a charge, a send or a non-idempotent
 * append does the thing twice, and a network timeout is precisely the case where the
 * first attempt may well have succeeded unseen. Retry reads, retry pure computation,
 * retry writes that carry an idempotency key — and nothing else.
 *
 * A refusal from `breaker.ts` or `bulkhead.ts` is deliberately NOT retryable: those
 * say the system already decided not to try, and asking again inside the same request
 * spends budget to receive the same answer.
 */
import { type Deadline, DeadlineExceededError } from '$lib/server/http/deadline';
import { ResilienceError } from './errors';

export interface RetryPolicy {
	/** Total attempts, including the first. `1` disables retrying. */
	attempts: number;
	/** First backoff before jitter. Doubles per attempt, capped by `maxDelayMs`. */
	baseDelayMs: number;
	maxDelayMs: number;
	/**
	 * Ceiling on a single attempt.
	 *
	 * Omit and one attempt may consume the entire remaining budget — correct when
	 * there is nothing to fall back to, useless when the point is to try again. A
	 * retry policy without this is a policy that retries only fast failures.
	 */
	attemptMaxMs?: number;
}

export interface RetryOptions {
	/** Which failures are worth repeating. Defaults to everything a retry could fix. */
	retryable?: (error: unknown) => boolean;
	/** Called before each wait, for logs and metrics. */
	onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/**
 * A refusal will not become a success by being asked again.
 *
 * An EXPIRY will, and this is the distinction that makes `attemptMaxMs` mean anything:
 * a slow attempt hitting its own ceiling is the ordinary case a retry exists for, and
 * treating it as terminal would turn the per-attempt bound into a one-attempt policy.
 * The request's own budget running out is caught by the loop guard below instead —
 * where it belongs, because that is a fact about the request, not about the error.
 */
function retryableByDefault(error: unknown): boolean {
	return !(error instanceof ResilienceError);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithin<T>(
	deadline: Deadline,
	policy: RetryPolicy,
	work: (signal: AbortSignal, attempt: number) => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const retryable = options.retryable ?? retryableByDefault;
	const attempts = Math.max(1, policy.attempts);
	let lastError: unknown;

	for (let attempt = 0; attempt < attempts; attempt++) {
		if (deadline.expired()) break;

		const scope = policy.attemptMaxMs === undefined ? deadline : deadline.child(policy.attemptMaxMs);
		try {
			return await scope.run((signal) => work(signal, attempt));
		} catch (error) {
			lastError = error;
			if (!retryable(error) || attempt === attempts - 1) break;

			// Full jitter: anywhere in [0, capped), so clients that failed at the same
			// instant do not come back at the same instant.
			const capped = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
			const delayMs = Math.random() * capped;
			// Sleeping past the deadline is a slower way to arrive at the same failure.
			if (delayMs >= deadline.remainingMs()) break;

			options.onRetry?.(attempt + 1, delayMs, error);
			await sleep(delayMs);
		}
	}

	throw lastError ?? new DeadlineExceededError('no budget left to attempt the operation');
}
