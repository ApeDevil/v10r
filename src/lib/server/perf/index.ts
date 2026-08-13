/**
 * Performance observatory — the numbers, and the rules for judging them.
 *
 * Two measurement contexts live here and are deliberately not merged:
 *
 *   field — real-user telemetry (`observatory.ts`), read with the dev lane
 *           filtered out and the size of that exclusion reported
 *   lab   — build-time measurements (`snapshot.ts`), committed and gate-asserted
 *
 * Field data tells you how the site behaves; lab data tells you what a commit
 * did. Neither substitutes for the other, and scoring one against the other's
 * budget is the specific mistake `budgets.ts` exists to prevent.
 */

export {
	type Budget,
	type BudgetKey,
	type BudgetKind,
	type BudgetVerdict,
	budgetKeys,
	budgets,
	ceilingFor,
	ceilings,
	FIELD_METRICS,
	type FieldMetric,
	fieldBudgetKey,
	hasEnoughSamples,
	MIN_SAMPLES_FOR_P75,
	scoreBudget,
} from './budgets';
export {
	type FieldVital,
	getFieldVitals,
	getIdleGapProfile,
	getLaneHealth,
	getRouteHotPaths,
	getVitalsTrend,
	type IdleGapRow,
	idleGapIsReadable,
	type LaneCensus,
	type LaneHealth,
	type RouteHotPath,
	type VitalTrendPoint,
} from './observatory';
export {
	checkRatchets,
	isScoreable,
	type LabSnapshot,
	type RatchetCheck,
	type ScoredMetric,
	type SnapshotMetrics,
	scoreSnapshot,
	snapshot,
	snapshotAgeDays,
} from './snapshot';
