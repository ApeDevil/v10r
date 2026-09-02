/**
 * Delivery retry policy — pure arithmetic. No DB, no clock, no I/O.
 *
 * The impure shell is outbox.ts, which anchors the computed delay to the DATABASE
 * clock rather than this process's, so a skewed app server cannot shift the queue.
 * Same pure-core/impure-shell split as $lib/pwa/sw-policy.ts.
 */
import {
	DELIVERY_MAX_ATTEMPTS,
	DELIVERY_RETRY_BASE_MS,
	DELIVERY_RETRY_FACTOR,
	DELIVERY_RETRY_JITTER,
	DELIVERY_RETRY_MAX_MS,
} from './config';

/** Deterministic delay before the next attempt, given `attempts` already burned. */
export function backoffMs(attempts: number): number {
	const n = Math.max(1, Math.floor(attempts));
	return Math.min(DELIVERY_RETRY_BASE_MS * DELIVERY_RETRY_FACTOR ** (n - 1), DELIVERY_RETRY_MAX_MS);
}

/** Spread simultaneous failures. `rand` is injected so tests are deterministic. */
export function jitter(ms: number, rand: () => number = Math.random): number {
	const span = ms * DELIVERY_RETRY_JITTER;
	return Math.max(0, Math.round(ms - span + rand() * span * 2));
}

export type FailureDecision = { status: 'pending'; delayMs: number } | { status: 'failed' } | { status: 'dead' };

/**
 * Terminal-state policy. The 'failed' / 'dead' split is what makes the admin
 * "Needs Attention" panel useful rather than merely non-empty:
 *
 *   not retryable        → 'failed'  the channel told us this will never work
 *                                    (403 blocked, no recipient, no channel,
 *                                    invalid address). Retrying is pointless, so
 *                                    it does NOT belong in a panel whose only
 *                                    affordance is a Retry button.
 *   retryable, budget    → 'pending' + exponential backoff
 *   retryable, exhausted → 'dead'    a transient fault outlived the budget. This
 *                                    IS worth a human look and a manual retry.
 *
 * `attempts` is the POST-increment count (the claim bumps it before the send), so
 * the comparison is `>=`: exactly DELIVERY_MAX_ATTEMPTS sends are made.
 */
export function decideFailure(input: { attempts: number; retryable: boolean; rand?: () => number }): FailureDecision {
	if (!input.retryable) return { status: 'failed' };
	if (input.attempts >= DELIVERY_MAX_ATTEMPTS) return { status: 'dead' };
	return { status: 'pending', delayMs: jitter(backoffMs(input.attempts), input.rand) };
}
