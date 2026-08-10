import { describe, expect, it } from 'vitest';
import type { ModelUsageRow } from '$lib/server/db/ai/admin-queries';
import type { ImageModelUsageRow } from '$lib/server/db/ai/image-metadata-queries';
import { buildUnifiedModelUsage } from './usage-summary';

const chat = (over: Partial<ModelUsageRow> = {}): ModelUsageRow => ({
	model: 'gemini-2.5-flash',
	providerId: 'google',
	inputTokens: 1000,
	outputTokens: 2000,
	steps: 5,
	...over,
});

const image = (over: Partial<ImageModelUsageRow> = {}): ImageModelUsageRow => ({
	modelId: 'gemini-2.5-flash',
	providerId: 'google',
	inputTokens: 491,
	outputTokens: 560,
	reasoningTokens: 380,
	analyses: 1,
	...over,
});

describe('buildUnifiedModelUsage', () => {
	it('totals tokens as input+output only — reasoning is a subset, never added', () => {
		// The exact empirical figures: 1051 === 491 input + 560 output, with reasoning 380 INSIDE output.
		const { rows, summary } = buildUnifiedModelUsage([], [image()]);
		expect(rows[0].reasoningTokens).toBe(380);
		expect(summary.totalTokens).toBe(1051); // never 1431
		expect(summary.inputTokens).toBe(491);
		expect(summary.outputTokens).toBe(560);
	});

	it('tags surface, call unit, and nulls chat reasoning', () => {
		const { rows } = buildUnifiedModelUsage([chat()], [image()]);
		const chatRow = rows.find((r) => r.surface === 'chat');
		const imageRow = rows.find((r) => r.surface === 'image');
		expect(chatRow?.callUnit).toBe('step');
		expect(chatRow?.reasoningTokens).toBeNull();
		expect(imageRow?.callUnit).toBe('analysis');
		expect(imageRow?.reasoningTokens).toBe(380);
	});

	it('reports partial coverage and sums cost over priced rows only', () => {
		// The `unknown` bucket (admin-queries COALESCEs a NULL model_id to it) can
		// never be a price-table key → permanently unpriced; gemini is priced.
		const { summary } = buildUnifiedModelUsage([chat({ model: 'unknown' }), chat()], []);
		expect(summary.totalRowCount).toBe(2);
		expect(summary.pricedRowCount).toBe(1);
		expect(summary.costCoverage).toBe('partial');
		// Only the gemini row contributes: 1000 in @ $0.30/M + 2000 out @ $2.50/M.
		expect(summary.totalCostUsd).toBeCloseTo(1000e-6 * 0.3 + 2000e-6 * 2.5, 10);
	});

	it('keeps unreported (null) token rows null, never a false $0', () => {
		const { rows, summary } = buildUnifiedModelUsage(
			[],
			[image({ inputTokens: null, outputTokens: null, reasoningTokens: null })],
		);
		expect(rows[0].cost).toBeNull(); // estimateCost guards both-null → null
		expect(summary.costCoverage).toBe('none');
		expect(summary.totalCostUsd).toBeNull();
		expect(summary.totalTokens).toBeNull();
	});

	it('marks full coverage when every row is priced and carries an asOf date', () => {
		const { summary } = buildUnifiedModelUsage([chat()], [image()]);
		expect(summary.costCoverage).toBe('full');
		expect(summary.pricedRowCount).toBe(2);
		expect(summary.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('handles the empty case without inventing numbers', () => {
		const { rows, summary } = buildUnifiedModelUsage([], []);
		expect(rows).toHaveLength(0);
		expect(summary.totalRowCount).toBe(0);
		expect(summary.costCoverage).toBe('none');
		expect(summary.totalCostUsd).toBeNull();
		expect(summary.totalTokens).toBeNull();
	});
});
