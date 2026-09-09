/**
 * Resilience — what keeps the fast path fast when a dependency is not.
 *
 * Four mechanisms that answer four different questions, and the value is in keeping
 * them separate rather than in any one of them:
 *
 *   `breaker`   — should we call this at all right now?
 *   `bulkhead`  — how much of the pool may this dependency hold?
 *   `shedding`  — is this work worth doing under the current pressure?
 *   `retry`     — is this failure worth repeating, and out of whose budget?
 *
 * They compose in that order and none of them is a substitute for another: a breaker
 * without a bulkhead still lets a merely-slow dependency exhaust the instance, and a
 * retry without a deadline (`$lib/server/http/deadline`) is the thing that turns a
 * dependency's bad minute into an outage.
 *
 * Every one of them degrades rather than throws when Redis is missing, and each says
 * in its own header which way it fails and why that direction is the safe one.
 */
export { type Breaker, type BreakerPolicy, type BreakerState, defineBreaker, resetBreakers } from './breaker';
export { type Bulkhead, type BulkheadPolicy, defineBulkhead } from './bulkhead';
export { ResilienceError, type ResilienceErrorKind } from './errors';
export { type RetryOptions, type RetryPolicy, retryWithin } from './retry';
export {
	DEFAULT_NEEDS_MS,
	DEFAULT_SHED_ABOVE,
	defineShedder,
	type Shedder,
	type SheddingDecision,
	type SheddingPolicy,
	type ShedReason,
	type WorkPriority,
} from './shedding';
