/**
 * A bound on simultaneous work inside one server instance.
 *
 * Rate limiters (Upstash, `rate-limit.ts`) count requests over a window across every
 * instance; they cannot stop ten requests arriving in the same 100 ms and all evaluating
 * geometry at once on one instance. This counts work in flight, in-process, overall and per
 * key — enough to keep one instance's CPU and WASM heap from being stacked by a single caller.
 *
 * It is per instance by design: a cross-instance count needs shared state per request, and
 * the platform already scales instances out. Pair it with the distributed rate limits.
 */

export interface InFlightLimit {
	/** Enter, or `null` when the instance or the key is at its bound. Call the result to leave. */
	tryEnter(key: string): (() => void) | null;
	/** Current counts, for tests and diagnostics. */
	snapshot(): { total: number; keys: number };
}

export function createInFlightLimit(maxTotal: number, maxPerKey: number): InFlightLimit {
	let total = 0;
	const perKey = new Map<string, number>();
	return {
		tryEnter(key) {
			const current = perKey.get(key) ?? 0;
			if (total >= maxTotal || current >= maxPerKey) return null;
			total += 1;
			perKey.set(key, current + 1);
			let left = false;
			return () => {
				if (left) return;
				left = true;
				total -= 1;
				const remaining = (perKey.get(key) ?? 1) - 1;
				if (remaining <= 0) perKey.delete(key);
				else perKey.set(key, remaining);
			};
		},
		snapshot: () => ({ total, keys: perKey.size }),
	};
}
