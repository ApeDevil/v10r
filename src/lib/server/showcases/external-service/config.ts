import type { LimiterOptions } from '$lib/server/http/rate-limit';

/**
 * Policy for the External Service Lab's calls. Every number here bounds something a
 * visitor can trigger; none of them is a product limit.
 */

/**
 * Ceiling for one call, inside the request's own deadline (`locals.deadline`, 10 s).
 * Long enough for a warm service across the internet, deliberately far shorter than a
 * free host's cold start (~1 min on Render Free): a page must not hang for a minute.
 * A call that hits it while the host wakes is reported as `timed_out`, honestly.
 */
export const CALL_CEILING_MS = 8_000;

/**
 * Ceiling for a `wake` check — long enough for a free host's cold start (~1 min on Render
 * Free), far inside a Vercel function's 300 s. The route raises its own `maxDuration` to
 * match; only the check action uses it, and only when the visitor asks to wait.
 */
export const WAKE_CEILING_MS = 75_000;

/** Kept back from the call budget for rendering the result. */
export const RENDER_RESERVE_MS = 500;

/**
 * The `deadline` drill's budget: already spent. A 1 ms budget is NOT a reliable drill —
 * a warm loopback round trip measured 0.8 ms (p50), so a local service can win the race.
 * A spent budget is deterministic and is the real path: the adapter refuses to start work
 * that cannot finish. In-flight timeouts are proven by `client.test.ts` (a slow socket)
 * and observed live when a free host is cold.
 */
export const DRILL_DEADLINE_MS = 0;

/** Largest response body read from the service. Its biggest answer is ~5 KiB. */
export const MAX_RESPONSE_BYTES = 64 * 1024;

/** Shortest credential the adapter will send. Mirrors the service's own startup floor. */
export const MIN_TOKEN_LENGTH = 32;

/**
 * Retry policy for idempotent operations, applied only when no response arrived
 * (`unreachable`). A timeout is not retried — on a waking host it would only spend the
 * rest of the budget waiting for the same cold start.
 */
export const RETRY_ATTEMPTS = 2;
export const RETRY_BASE_DELAY_MS = 50;
export const RETRY_MAX_DELAY_MS = 200;

/** Longest service-supplied message passed on to the page. */
export const MAX_SERVICE_MESSAGE_LENGTH = 240;

/**
 * Lab actions per IP. One action is at most two operations × two attempts = four outbound
 * calls, so this bounds one visitor to ~80 calls a minute.
 */
export const RATE_LIMIT_PREFIX = 'rl:external-service';
export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW = '60 s' as const;

/** Lab actions across ALL visitors — the ceiling a botnet of addresses cannot lift. */
export const GLOBAL_RATE_LIMIT_PREFIX = 'rl:external-service:all';
export const GLOBAL_RATE_LIMIT_MAX = 200;

/**
 * A wake check holds a function for up to `WAKE_CEILING_MS` while it keeps the free host
 * running — the costliest action, and one an honest visitor needs once. Its own, far smaller
 * buckets, on top of the ordinary ones.
 */
export const WAKE_RATE_LIMIT_PREFIX = 'rl:external-service:wake';
export const WAKE_RATE_LIMIT_MAX = 2;
export const GLOBAL_WAKE_RATE_LIMIT_PREFIX = 'rl:external-service:wake:all';
export const GLOBAL_WAKE_RATE_LIMIT_MAX = 10;

/**
 * Every lab bucket refuses when its store is slow or unavailable. They all read one store, so
 * a slow store slows every bucket at once: letting one bucket open would only delay the
 * refusal of the next. And these buckets are the only cap on the lab's outbound calls — so on
 * the free host's monthly instance-hours, which anyone could otherwise spend for us. A demo
 * that refuses while its store is unwell loses nothing that matters; one that runs unbounded
 * can exhaust the host for the month. (The visitor then reads "rate limited" — imprecise,
 * and the honest short answer.)
 */
export const LAB_LIMITER_POLICY = { onTimeout: 'closed', onError: 'closed' } as const satisfies LimiterOptions;
