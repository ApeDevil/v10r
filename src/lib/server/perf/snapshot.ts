/**
 * The committed lab snapshot — build-time measurements, scored against budgets.
 *
 * Field telemetry answers "how fast is it for real users right now"; it cannot
 * answer "did this commit make the bundle bigger", because bundle size does not
 * appear in RUM until it has already shipped. This is the other half: numbers
 * taken from a build, written to disk, and diffable in git.
 *
 * Regenerate with `scripts/perf/snapshot.ts` after a production build.
 */

import { type BudgetKey, type BudgetVerdict, budgets, ceilings, scoreBudget } from './budgets';
import raw from './snapshot.json';

export interface SnapshotMetrics {
	baseline_js_kb: number;
	route_js_kb: number;
	heaviest_route_node: string;
	median_route_js_kb: number;
	total_client_js_kb: number;
	chunk_count: number;
	route_count: number;
	doc_html_kb: number;
	largest_html_path: string | null;
	prerendered_page_count: number;
}

export interface LabSnapshot {
	generatedAt: string;
	gitSha: string | null;
	nodeEnv: string;
	metrics: SnapshotMetrics;
}

export const snapshot = raw as LabSnapshot;

/**
 * A snapshot taken from a dev-mode build is not a weaker measurement, it is a
 * different one — Svelte compiles both halves differently and client JS came out
 * ~9% heavier. Scoring it against production budgets produces failures that no
 * production change can fix, which is how a gate gets muted.
 */
export function isScoreable(snap: LabSnapshot = snapshot): boolean {
	return snap.nodeEnv === 'production';
}

/** Snapshot metrics that have a matching budget, in display order. */
const SCORED: { metric: keyof SnapshotMetrics; budget: BudgetKey }[] = [
	{ metric: 'route_js_kb', budget: 'route_js_kb' },
	{ metric: 'baseline_js_kb', budget: 'baseline_js_kb' },
	{ metric: 'doc_html_kb', budget: 'doc_html_kb' },
];

export interface ScoredMetric {
	metric: keyof SnapshotMetrics;
	budget: BudgetKey;
	value: number;
	/** Against the aspirational target. Reported, never build-failing. */
	verdict: BudgetVerdict;
	warn: number;
	fail: number;
	note: string;
}

/** How each measured metric stands against its aspirational target. Never build-failing. */
export function scoreSnapshot(snap: LabSnapshot = snapshot): ScoredMetric[] {
	return SCORED.map(({ metric, budget }) => ({
		metric,
		budget,
		value: snap.metrics[metric] as number,
		verdict: scoreBudget(budget, snap.metrics[metric] as number),
		warn: budgets[budget].warn,
		fail: budgets[budget].fail,
		note: budgets[budget].note,
	}));
}

export interface RatchetCheck {
	metric: string;
	value: number;
	ceiling: number;
	/** True when the build grew past what was last accepted. This fails the gate. */
	exceeds: boolean;
	/** Headroom in KB. Comfortably positive means the ceiling should be lowered. */
	slackKb: number;
}

/**
 * The ratchet check, driven by whatever `budgets.json` declares a ceiling for.
 *
 * Iterating the ceilings rather than a hardcoded list means adding a new
 * ratcheted metric is a one-line JSON edit, and a ceiling naming a metric the
 * snapshot does not measure surfaces as an explicit failure rather than being
 * silently skipped.
 */
export function checkRatchets(snap: LabSnapshot = snapshot): RatchetCheck[] {
	return Object.entries(ceilings).map(([metric, ceiling]) => {
		const value = snap.metrics[metric as keyof SnapshotMetrics];
		if (typeof value !== 'number') {
			throw new Error(
				`budgets.json declares a ceiling for "${metric}" but the snapshot has no such numeric metric. ` +
					'Either the metric was renamed in scripts/perf/snapshot.ts or the ceiling is a typo.',
			);
		}
		return {
			metric,
			value,
			ceiling,
			exceeds: value > ceiling,
			slackKb: Math.round((ceiling - value) * 10) / 10,
		};
	});
}

/**
 * Age in whole days. Surfaced on the observatory rather than enforced by the
 * gate: failing an unrelated commit because nobody re-ran a build is how a
 * useful check becomes one people route around.
 */
export function snapshotAgeDays(snap: LabSnapshot = snapshot, now: number = Date.now()): number {
	const taken = Date.parse(snap.generatedAt);
	if (Number.isNaN(taken)) return Number.POSITIVE_INFINITY;
	return Math.max(0, Math.floor((now - taken) / 86400000));
}
