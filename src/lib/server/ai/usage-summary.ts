/**
 * The cross-surface unification seam — APP LAYER, never SQL. The chatbot and image-reader
 * telemetry live in two independent tables; this is the only place that knows both exist.
 * It combines their per-model usage into one table + an honest summary:
 *  - Cost is derived per row via the reference price table (`estimateCost`), never stored.
 *  - The summary sums cost over PRICED rows only and reports `costCoverage`, so the UI can
 *    never render a misleading grand total when some models (e.g. groq llama) are unpriced.
 *  - Token totals are input+output ONLY — `reasoning` is a subset of output, never added.
 */

import type { ModelUsageSummary, UnifiedModelUsageRow } from '$lib/schemas/admin/model-usage';
import type { CostEstimate } from '$lib/schemas/showcase/image-metadata';
import type { ModelUsageRow } from '$lib/server/db/ai/admin-queries';
import type { ImageModelUsageRow } from '$lib/server/db/ai/image-metadata-queries';
import { estimateCost } from './pricing';

function rowTotalTokens(r: { inputTokens: number | null; outputTokens: number | null }): number | null {
	if (r.inputTokens == null && r.outputTokens == null) return null;
	return (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
}

/** Sum, skipping nulls; null only when EVERY value was null. */
function sumNullable(values: (number | null)[]): number | null {
	const known = values.filter((v): v is number => v != null);
	return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

export function buildUnifiedModelUsage(
	chatRows: ModelUsageRow[],
	imageRows: ImageModelUsageRow[],
): { rows: UnifiedModelUsageRow[]; summary: ModelUsageSummary } {
	const rows: UnifiedModelUsageRow[] = [
		...chatRows.map(
			(r): UnifiedModelUsageRow => ({
				surface: 'chat',
				modelId: r.model,
				providerId: r.providerId,
				inputTokens: r.inputTokens,
				outputTokens: r.outputTokens,
				reasoningTokens: null,
				calls: r.steps,
				callUnit: 'step',
				cost: estimateCost(r.model, {
					inputTokens: r.inputTokens,
					outputTokens: r.outputTokens,
					reasoningTokens: null,
				}),
			}),
		),
		...imageRows.map(
			(r): UnifiedModelUsageRow => ({
				surface: 'image',
				modelId: r.modelId,
				providerId: r.providerId,
				inputTokens: r.inputTokens,
				outputTokens: r.outputTokens,
				reasoningTokens: r.reasoningTokens,
				calls: r.analyses,
				callUnit: 'analysis',
				cost: estimateCost(r.modelId, {
					inputTokens: r.inputTokens,
					outputTokens: r.outputTokens,
					reasoningTokens: r.reasoningTokens,
				}),
			}),
		),
	];

	// Busiest first; rows with no reported tokens sort last.
	rows.sort((a, b) => (rowTotalTokens(b) ?? -1) - (rowTotalTokens(a) ?? -1));

	const costs: CostEstimate[] = rows.map((r) => r.cost).filter((c): c is CostEstimate => c !== null);
	const totalRowCount = rows.length;
	const pricedRowCount = costs.length;
	const costCoverage: ModelUsageSummary['costCoverage'] =
		pricedRowCount === 0 ? 'none' : pricedRowCount === totalRowCount ? 'full' : 'partial';

	const inputTokens = sumNullable(rows.map((r) => r.inputTokens));
	const outputTokens = sumNullable(rows.map((r) => r.outputTokens));
	const totalTokens = inputTokens == null && outputTokens == null ? null : (inputTokens ?? 0) + (outputTokens ?? 0);

	return {
		rows,
		summary: {
			totalRowCount,
			pricedRowCount,
			costCoverage,
			inputTokens,
			outputTokens,
			totalTokens,
			totalCostUsd: costs.length ? costs.reduce((s, c) => s + c.totalUsd, 0) : null,
			costKind: 'reference',
			asOf: costs.length ? costs.map((c) => c.verifiedOn).reduce((min, d) => (d < min ? d : min)) : null,
		},
	};
}
