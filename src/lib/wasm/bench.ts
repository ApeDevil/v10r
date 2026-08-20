/**
 * Benchmark protocol helpers — the statistics half of the honest-measurement
 * story. Pure and node-testable; the protocol itself (warm both engines untimed,
 * counterbalance round order — AB/BA alternating, rotations for three lanes —
 * report medians with spread, show first-run cost separately) lives where the
 * timing runs: kernel-bench.worker.ts and the showcase components.
 *
 * Median, not mean: JIT tiers, GC pauses and scheduler noise skew right, and a
 * single outlier round should not move the headline number.
 */

export interface BenchStats {
	median: number;
	min: number;
	max: number;
}

export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(values: number[]): BenchStats {
	if (values.length === 0) return { median: 0, min: 0, max: 0 };
	return {
		median: median(values),
		min: Math.min(...values),
		max: Math.max(...values),
	};
}

/** One benchmark round, wasm lanes split at the boundary. JS lanes carry 0 copy cost — the data already lives in JS memory, which is exactly the point the split makes visible. */
export interface RoundTiming {
	copyIn: number;
	compute: number;
	copyOut: number;
}

export function stageStats(rounds: RoundTiming[]): {
	copyIn: BenchStats;
	compute: BenchStats;
	copyOut: BenchStats;
	total: BenchStats;
} {
	return {
		copyIn: summarize(rounds.map((r) => r.copyIn)),
		compute: summarize(rounds.map((r) => r.compute)),
		copyOut: summarize(rounds.map((r) => r.copyOut)),
		total: summarize(rounds.map((r) => r.copyIn + r.compute + r.copyOut)),
	};
}

export function formatMs(ms: number): string {
	return ms >= 100 ? String(Math.round(ms)) : (Math.round(ms * 10) / 10).toFixed(1);
}
