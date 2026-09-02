/**
 * Observatory composition — joins raw telemetry to the budgets that judge it.
 *
 * The queries in `db/analytics/perf-queries.ts` return numbers; this decides what
 * those numbers mean. Kept apart because the verdict rules are the part worth
 * unit-testing, and they should not require a database to exercise.
 */

import {
	getIdleGapProfile,
	getOriginCensus,
	getRouteHotPaths,
	getVitalsByLane,
	getVitalsTrend,
	type IdleGapRow,
	type OriginCensus,
	type RouteHotPath,
	type VitalTrendPoint,
} from '$lib/server/db/analytics/perf-queries';
import {
	type BudgetVerdict,
	budgets,
	fieldBudgetKey,
	hasEnoughSamples,
	MIN_SAMPLES_FOR_P75,
	scoreBudget,
} from './budgets';

export type { IdleGapRow, OriginCensus, RouteHotPath, VitalTrendPoint };

export interface FieldVital {
	metric: string;
	p75: number | null;
	samples: number;
	devSamples: number;
	unknownSamples: number;
	worstTarget: string | null;
	/** Null when there is no prod-origin data, or the metric has no budget. */
	verdict: BudgetVerdict | null;
	/** True when the sample count is too small for the percentile to be meaningful. */
	provisional: boolean;
	warn: number | null;
	fail: number | null;
}

/**
 * Field vitals with a verdict attached.
 *
 * `provisional` is deliberately separate from `verdict` rather than suppressing
 * it. Hiding a number until it reaches n=20 is how a metric goes unwatched for a
 * month; showing it as if it were solid is how one slow page load becomes a
 * "regression". Both facts are shown, and the caller decides how loudly.
 */
export async function getFieldVitals(days: number): Promise<FieldVital[]> {
	const rows = await getVitalsByLane(days);

	return rows.map((row) => {
		const key = fieldBudgetKey(row.metric);
		const budget = key ? budgets[key] : null;
		return {
			...row,
			verdict: key !== null && row.p75 !== null ? scoreBudget(key, row.p75) : null,
			provisional: !hasEnoughSamples(row.samples),
			warn: budget?.warn ?? null,
			fail: budget?.fail ?? null,
		};
	});
}

export interface OriginHealth {
	census: OriginCensus[];
	total: number;
	prodShare: number;
	/**
	 * Dev rows written since the source-side gate landed would mean it regressed.
	 * Historic rows inside the retention window are expected and are not an alarm.
	 */
	devSamples: number;
}

export async function getOriginHealth(days: number): Promise<OriginHealth> {
	const census = await getOriginCensus(days);
	const total = census.reduce((sum, row) => sum + row.samples, 0);
	const prod = census.find((row) => row.origin === 'prod')?.samples ?? 0;
	const dev = census.find((row) => row.origin === 'dev')?.samples ?? 0;
	return {
		census,
		total,
		prodShare: total === 0 ? 0 : Math.round((prod / total) * 1000) / 10,
		devSamples: dev,
	};
}

/**
 * Whether the idle-gap panel has enough data to be read as a shape at all.
 *
 * Guarded because this panel is the one most likely to be over-read: three bars
 * of two samples each will happily draw a convincing curve, and a curve drawn
 * from n=2 is how the audit that motivated this observatory reached a conclusion
 * it had to retract.
 */
export function idleGapIsReadable(rows: IdleGapRow[]): boolean {
	const populated = rows.filter((row) => row.samples > 0);
	return populated.length >= 2 && populated.every((row) => row.samples >= MIN_SAMPLES_FOR_P75);
}

export { getIdleGapProfile, getRouteHotPaths, getVitalsTrend };
