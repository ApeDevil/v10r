/**
 * Circuit breaker — stop asking a dependency that has already said no.
 *
 * The cost of a failing dependency is rarely the failures. It is that every request
 * still pays the full timeout to discover the same answer, so one unhealthy provider
 * makes every request slow rather than some requests fail. A breaker converts that
 * into an immediate, cheap refusal and gives the dependency room to recover instead
 * of holding it under load while it tries.
 *
 * Two ways to open, and the difference matters:
 *
 *   `trip()` — the dependency TOLD us to back off. A 429 with `Retry-After` is not a
 *   signal to be inferred from a threshold; it is an instruction, and honouring it
 *   immediately is both faster and politer than counting to five first.
 *
 *   `recordFailure()` — we inferred it. Failures are counted inside a window, and the
 *   breaker opens when the count reaches the threshold. The window is what stops a
 *   slow drip of unrelated errors over an hour from ever adding up to an outage.
 *
 * ## State lives in Redis, and mirrors in memory
 *
 * On serverless there is no single process to hold breaker state: every cold instance
 * would independently re-discover that a provider is down, which is exactly the
 * hammering the breaker exists to prevent. So the record is shared.
 *
 * The in-process `Map` is written FIRST and read as the fallback, because the failure
 * mode of the alternative is silent: a Redis write that fails after the dependency
 * refused us would leave the breaker closed and the retry storm intact. On a Redis
 * READ failure this falls through to memory rather than reporting "closed" — when the
 * shared record is unreadable, the safe assumption is that the dependency is still
 * struggling, since a wrongly-open breaker costs one fallback and a wrongly-closed one
 * costs the outage it was meant to stop.
 *
 * ## No half-open state
 *
 * The first caller after `retryAt` IS the probe: the breaker simply closes and lets
 * traffic through, and one more failure reopens it. A true half-open — admit exactly
 * one request and hold the rest — needs a second lock and another round trip to
 * coordinate, and would buy nothing here: a handful of simultaneous probes costs a
 * handful of failed calls, and that is cheaper than the coordination it replaces.
 * This is the same trade `singleflight.ts` makes when it refuses to let a cold caller
 * wait on a lock.
 */
import { redis } from '$lib/server/cache';

export interface BreakerPolicy {
	/** Key namespace, and the prefix on every log line. One per dependency class. */
	name: string;
	/** How long the breaker stays open once tripped. */
	openForSeconds: number;
	/** Failures within `failureWindowSeconds` before the breaker opens itself. */
	failureThreshold: number;
	/**
	 * Window the failures are counted in.
	 *
	 * Without it the count is cumulative and every dependency eventually trips — one
	 * failure an hour for a day is a healthy dependency, not a broken one.
	 */
	failureWindowSeconds: number;
}

export interface BreakerState {
	open: boolean;
	/** Epoch ms the breaker admits traffic again, or `null` when it is closed. */
	retryAt: number | null;
}

export interface Breaker {
	readonly name: string;
	state(subject: string): Promise<BreakerState>;
	isOpen(subject: string): Promise<boolean>;
	/** Open it now — for a dependency that asked us to stop. Non-blocking on Redis failure. */
	trip(subject: string, openForSeconds?: number): Promise<void>;
	/** Count one failure. Resolves `true` when this failure is the one that opened the breaker. */
	recordFailure(subject: string): Promise<boolean>;
	/** Clear the failure count. Does NOT close an open breaker — only its expiry does that. */
	recordSuccess(subject: string): Promise<void>;
	/** Forget everything about `subject`. Admin recovery and tests. */
	reset(subject: string): Promise<void>;
}

/** Open-until times, by `${name}:${subject}`. Fallback store when Redis is unavailable. */
const openUntil = new Map<string, number>();
/** Failure counts, by `${name}:${subject}`, with their own window expiry. */
const failures = new Map<string, { count: number; expiresAt: number }>();

/** Drop the in-process fallback state. Test cleanup only — a no-op against Redis. */
export function resetBreakers(): void {
	openUntil.clear();
	failures.clear();
}

export function defineBreaker(policy: BreakerPolicy): Breaker {
	const openKey = (subject: string) => `breaker:${policy.name}:${subject}`;
	const failKey = (subject: string) => `breaker:${policy.name}:${subject}:failures`;
	const localKey = (subject: string) => `${policy.name}:${subject}`;

	function localRetryAt(subject: string): number | null {
		const retryAt = openUntil.get(localKey(subject));
		if (retryAt === undefined) return null;
		if (Date.now() >= retryAt) {
			openUntil.delete(localKey(subject));
			return null;
		}
		return retryAt;
	}

	async function open(subject: string, openForSeconds: number): Promise<void> {
		const retryAt = Date.now() + openForSeconds * 1000;
		// Memory first: a Redis write that fails here must not leave the breaker closed.
		openUntil.set(localKey(subject), retryAt);
		if (!redis) return;
		try {
			await redis.set(openKey(subject), retryAt, { ex: openForSeconds });
		} catch (err) {
			console.error(`[resilience:breaker] ${policy.name} could not record open state for ${subject}:`, err);
		}
	}

	async function readState(subject: string): Promise<BreakerState> {
		if (redis) {
			try {
				const retryAt = await redis.get<number>(openKey(subject));
				// The shared record is authoritative when it is readable, in BOTH directions:
				// a missing key means another instance reset it or the expiry lapsed, and the
				// local mirror saying otherwise is just stale.
				if (retryAt === null || retryAt === undefined) return { open: false, retryAt: null };
				return Date.now() < retryAt ? { open: true, retryAt } : { open: false, retryAt: null };
			} catch (err) {
				console.error(`[resilience:breaker] ${policy.name} could not read state for ${subject}:`, err);
				// Fall through to the local mirror rather than reporting "closed" — see the
				// module comment on which way an unreadable breaker should fail.
			}
		}
		const retryAt = localRetryAt(subject);
		return { open: retryAt !== null, retryAt };
	}

	return {
		name: policy.name,

		state: readState,

		async isOpen(subject) {
			return (await readState(subject)).open;
		},

		async trip(subject, openForSeconds = policy.openForSeconds) {
			await open(subject, openForSeconds);
		},

		async recordFailure(subject) {
			const window = policy.failureWindowSeconds;
			let count: number;

			if (redis) {
				try {
					count = await redis.incr(failKey(subject));
					// Only the first failure sets the window. Refreshing it on every failure
					// would make a steady trickle look like a burst and eventually trip.
					if (count === 1) await redis.expire(failKey(subject), window);
				} catch (err) {
					console.error(`[resilience:breaker] ${policy.name} could not count failure for ${subject}:`, err);
					count = countLocally(localKey(subject), window);
				}
			} else {
				count = countLocally(localKey(subject), window);
			}

			if (count < policy.failureThreshold) return false;
			console.error(
				`[resilience:breaker] ${policy.name} OPEN for ${subject} — ` +
					`${count} failures in ${window}s, backing off for ${policy.openForSeconds}s.`,
			);
			await open(subject, policy.openForSeconds);
			return true;
		},

		async recordSuccess(subject) {
			failures.delete(localKey(subject));
			if (!redis) return;
			try {
				await redis.del(failKey(subject));
			} catch (err) {
				console.error(`[resilience:breaker] ${policy.name} could not clear failures for ${subject}:`, err);
			}
		},

		async reset(subject) {
			openUntil.delete(localKey(subject));
			failures.delete(localKey(subject));
			if (!redis) return;
			try {
				await redis.del(openKey(subject));
				await redis.del(failKey(subject));
			} catch (err) {
				console.error(`[resilience:breaker] ${policy.name} could not reset ${subject}:`, err);
			}
		},
	};
}

function countLocally(key: string, windowSeconds: number): number {
	const now = Date.now();
	const existing = failures.get(key);
	if (!existing || now >= existing.expiresAt) {
		failures.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
		return 1;
	}
	existing.count++;
	return existing.count;
}
