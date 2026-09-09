/**
 * Bulkhead — one saturated dependency must not sink the capabilities beside it.
 *
 * Named after the compartments in a ship's hull: a breach floods one section rather
 * than the vessel. The failure it prevents is the indirect one. A dependency slows
 * from 50ms to 5 seconds, requests waiting on it pile up, and they exhaust the
 * connections, memory or function-concurrency that every OTHER capability also needs.
 * The slow dependency degrades; everything else goes down with it, and the incident
 * report names the wrong system.
 *
 * A bulkhead is a cap on how much of the shared pool one dependency may hold. Past
 * that cap, callers are REFUSED rather than queued indefinitely — a queue is latency
 * the caller cannot see and the operator cannot measure, and an unbounded one is just
 * a slower way to run out of memory. `maxQueued` exists to absorb a burst, not to
 * store a backlog: it should be small enough that waiting in it is still better than
 * being told no.
 *
 * ## In-process, and honest about it
 *
 * This bounds ONE instance. On Vercel, ten concurrent instances each holding four
 * slots means forty in-flight calls at the dependency, and no amount of local
 * bookkeeping can see that — the fleet-wide bound is the platform's own concurrency
 * setting and the dependency's connection limit, which is where it belongs. The
 * in-process bulkhead is still the useful half: it is what stops a single instance
 * from turning one slow dependency into a wholly unresponsive process, and unlike the
 * shared version it costs nothing to consult.
 *
 * Pair it with a breaker rather than choosing between them: the bulkhead bounds how
 * much a slow dependency can hold, the breaker stops calling one that is failing.
 */
import { ResilienceError } from './errors';

export interface BulkheadPolicy {
	name: string;
	/** Calls allowed to run at once. */
	maxConcurrent: number;
	/** Calls allowed to wait for a slot. Beyond this, callers are refused immediately. */
	maxQueued: number;
}

export interface Bulkhead {
	readonly name: string;
	/** Calls running right now. */
	readonly active: number;
	/** Calls waiting for a slot. */
	readonly queued: number;
	/**
	 * How full the compartment is, 0–1, counting waiters.
	 *
	 * This is the pressure signal `shedding.ts` reads: it rises before the bulkhead
	 * starts refusing, which is the whole point — shedding optional work at 0.6 is how
	 * the pool avoids reaching 1.0 for the work that matters.
	 */
	readonly load: number;
	/** Run `work` in this compartment, or reject with `bulkhead_full` if there is no room. */
	run<T>(work: () => Promise<T>): Promise<T>;
}

export function defineBulkhead(policy: BulkheadPolicy): Bulkhead {
	const maxConcurrent = Math.max(1, policy.maxConcurrent);
	const maxQueued = Math.max(0, policy.maxQueued);
	const capacity = maxConcurrent + maxQueued;

	let active = 0;
	const waiting: Array<() => void> = [];

	function release(): void {
		active--;
		const next = waiting.shift();
		if (next) {
			// Claim the slot on behalf of the waiter here, not after it wakes. Between the
			// shift and the resumed microtask a new caller could otherwise walk straight
			// past an `active < maxConcurrent` check and take the slot from under it.
			active++;
			next();
		}
	}

	return {
		name: policy.name,
		get active() {
			return active;
		},
		get queued() {
			return waiting.length;
		},
		get load() {
			return (active + waiting.length) / capacity;
		},

		async run<T>(work: () => Promise<T>): Promise<T> {
			if (active >= maxConcurrent) {
				if (waiting.length >= maxQueued) {
					throw new ResilienceError(
						'bulkhead_full',
						`${policy.name} is at capacity (${maxConcurrent} running, ${waiting.length} queued)`,
					);
				}
				await new Promise<void>((resolve) => waiting.push(resolve));
			} else {
				active++;
			}

			try {
				return await work();
			} finally {
				release();
			}
		},
	};
}
