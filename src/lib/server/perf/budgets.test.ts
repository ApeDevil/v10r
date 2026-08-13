import { describe, expect, it } from 'vitest';
import {
	budgetKeys,
	budgets,
	FIELD_METRICS,
	fieldBudgetKey,
	hasEnoughSamples,
	MIN_SAMPLES_FOR_P75,
	scoreBudget,
} from './budgets';

describe('budgets.json integrity', () => {
	it('defines a warn below a fail for every budget', () => {
		for (const key of budgetKeys) {
			expect(budgets[key].warn, key).toBeLessThan(budgets[key].fail);
		}
	});

	it('gives every budget a kind and a note', () => {
		for (const key of budgetKeys) {
			expect(['lab', 'field'], key).toContain(budgets[key].kind);
			expect(budgets[key].note, key).toBeTruthy();
		}
	});

	it('has no budget keyed with the JSON comment prefix', () => {
		expect(budgetKeys.some((k) => k.startsWith('_'))).toBe(false);
	});
});

describe('scoreBudget', () => {
	it('passes below warn, warns between, fails above fail', () => {
		// ttfb_ms is warn 200 / fail 600.
		expect(scoreBudget('ttfb_ms', 0)).toBe('pass');
		expect(scoreBudget('ttfb_ms', 199)).toBe('pass');
		expect(scoreBudget('ttfb_ms', 201)).toBe('warn');
		expect(scoreBudget('ttfb_ms', 599)).toBe('warn');
		expect(scoreBudget('ttfb_ms', 601)).toBe('fail');
	});

	// Google's wording is "good UP TO AND INCLUDING 2500ms", so the threshold
	// itself must pass. An exclusive comparison here would report every
	// exactly-at-target measurement as a regression.
	it('treats the threshold value itself as still within the better band', () => {
		expect(scoreBudget('ttfb_ms', 200)).toBe('pass');
		expect(scoreBudget('ttfb_ms', 600)).toBe('warn');
		expect(scoreBudget('field_lcp_ms', 2500)).toBe('pass');
		expect(scoreBudget('field_lcp_ms', 4000)).toBe('warn');
	});

	it('handles fractional budgets like CLS', () => {
		expect(scoreBudget('field_cls', 0.05)).toBe('pass');
		expect(scoreBudget('field_cls', 0.1)).toBe('pass');
		expect(scoreBudget('field_cls', 0.2)).toBe('warn');
		expect(scoreBudget('field_cls', 0.3)).toBe('fail');
	});

	it('throws on an unknown key rather than silently passing', () => {
		// @ts-expect-error deliberately outside the key union
		expect(() => scoreBudget('not_a_budget', 1)).toThrow(/Unknown performance budget/);
	});
});

describe('field metric mapping', () => {
	it('maps every Web Vitals metric to a field budget', () => {
		for (const metric of FIELD_METRICS) {
			const key = fieldBudgetKey(metric);
			expect(key, metric).not.toBeNull();
			expect(budgets[key as string].kind, metric).toBe('field');
		}
	});

	it('returns null for a metric with no budget instead of guessing', () => {
		expect(fieldBudgetKey('FID')).toBeNull();
		expect(fieldBudgetKey('')).toBeNull();
	});

	// The lab and field TTFB budgets measure different things — a warm local
	// preview versus real users across the internet. Collapsing them to one
	// number is what made the audit report a failure on every deployment.
	it('keeps lab and field TTFB budgets distinct', () => {
		expect(budgets.ttfb_ms.kind).toBe('lab');
		expect(budgets.field_ttfb_ms.kind).toBe('field');
		expect(budgets.field_ttfb_ms.fail).toBeGreaterThan(budgets.ttfb_ms.fail);
	});
});

describe('hasEnoughSamples', () => {
	it('gates at the documented floor', () => {
		expect(hasEnoughSamples(MIN_SAMPLES_FOR_P75)).toBe(true);
		expect(hasEnoughSamples(MIN_SAMPLES_FOR_P75 - 1)).toBe(false);
		expect(hasEnoughSamples(0)).toBe(false);
	});
});
