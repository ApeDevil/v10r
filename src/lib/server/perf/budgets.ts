/**
 * Performance budgets and how to score a number against them.
 *
 * `budgets.json` is the single source of truth and is read by two consumers that
 * historically drifted: this module (the observatory + the gate test) and the
 * shell probes in `scripts/perf/`, which used to hardcode their own thresholds.
 *
 * Budgets carry a `kind` because the same metric name means different things in
 * the two measurement contexts, and conflating them produces false verdicts.
 * `ttfb_ms` (lab) is first-byte from a warm local preview, where 600 ms really is
 * a regression. `field_ttfb_ms` is p75 first-byte from real users on the far side
 * of the public internet, a serverless cold start and TLS — scoring that against
 * the lab budget reports a failure on every healthy deployment. The field bands
 * are Google's published Core Web Vitals thresholds so the verdict matches what
 * Search Console reports.
 */

import raw from './budgets.json';

export type BudgetKind = 'lab' | 'field';
export type BudgetVerdict = 'pass' | 'warn' | 'fail';

export interface Budget {
	/** Investigate at or above this value. */
	warn: number;
	/** Treat as a regression at or above this value. */
	fail: number;
	kind: BudgetKind;
	note: string;
}

export const budgets = raw.budgets as Readonly<Record<string, Budget>>;

export type BudgetKey = keyof typeof raw.budgets;

export const budgetKeys = Object.keys(budgets) as BudgetKey[];

/**
 * The ratchet: the measured value at the moment it was accepted.
 *
 * Targets and ceilings are separate because they answer different questions. The
 * `route_js_kb` target is 250 KB and the heaviest route measures 609 — that gap
 * is a real, honest finding and it belongs on the dashboard. But a gate wired to
 * an aspirational target fails on the day it lands, and a gate that fails on day
 * one gets muted, after which it protects nothing.
 *
 * So the gate asserts against these instead. They stop the number growing while
 * the target stays visible as the thing still to fix. They only ever move DOWN,
 * and lowering one is the deliberate act of banking an improvement.
 */
export const ceilings = raw.ceilings as Readonly<Record<string, number>>;

export function ceilingFor(metric: string): number | null {
	return ceilings[metric] ?? null;
}

/**
 * Score a measurement. Every budget here is "lower is better", so the comparison
 * is one-directional by construction — if a "higher is better" budget is ever
 * added this needs a direction field rather than a special case at the call site.
 *
 * Boundaries are inclusive of the threshold (`>=`) to match Google's wording:
 * LCP is "good" up to and including 2500 ms, so 2500 passes and 2501 warns.
 */
export function scoreBudget(key: BudgetKey, value: number): BudgetVerdict {
	const budget = budgets[key];
	if (!budget) throw new Error(`Unknown performance budget: ${key}`);
	if (value > budget.fail) return 'fail';
	if (value > budget.warn) return 'warn';
	return 'pass';
}

/** Web Vitals metric names as emitted by `web-vitals/attribution`. */
export const FIELD_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
export type FieldMetric = (typeof FIELD_METRICS)[number];

const FIELD_BUDGET_KEYS: Record<FieldMetric, BudgetKey> = {
	LCP: 'field_lcp_ms',
	INP: 'field_inp_ms',
	CLS: 'field_cls',
	FCP: 'field_fcp_ms',
	TTFB: 'field_ttfb_ms',
};

export function fieldBudgetKey(metric: string): BudgetKey | null {
	return FIELD_BUDGET_KEYS[metric as FieldMetric] ?? null;
}

/**
 * Below this many samples a p75 is not a p75 — it is one or two slow page loads
 * wearing a percentile's clothes. The observatory renders the number but marks
 * it provisional, because hiding it entirely is how a metric silently goes
 * unwatched for a month.
 *
 * 20 is a floor for readability, not a statistical guarantee: at n=20 a p75 is
 * still the 15th-ranked sample and moves a lot. It is the point below which the
 * number is actively misleading rather than merely noisy.
 */
export const MIN_SAMPLES_FOR_P75 = 20;

/** Is this sample count large enough for the percentile to mean anything? */
export function hasEnoughSamples(samples: number): boolean {
	return samples >= MIN_SAMPLES_FOR_P75;
}
