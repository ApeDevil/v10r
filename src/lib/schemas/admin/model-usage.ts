/**
 * Cross-surface AI usage DTOs for the admin Cost tab — pure types, no runtime, client-safe
 * (the `+page.svelte` imports them). The dollar math lives server-side in
 * `$lib/server/ai/usage-summary.ts`; cost is always a REFERENCE estimate, never a charge.
 */

import type { CostEstimate } from '$lib/schemas/image-metadata';

/**
 * What the model was asked to DO, which is not the same question as which product surface
 * asked it — `AiSurface` in `$lib/types/db-enums` is chatbot-vs-deskbot and this is
 * conversation-vs-vision. Load-bearing discriminant: the same model (e.g. gemini-2.5-flash)
 * serves both with very different per-call token profiles, so rows are keyed on
 * (workload, modelId), never modelId alone — otherwise the two collapse into one row.
 */
export type AiWorkload = 'chat' | 'image';

/**
 * One row of the cross-surface "usage by model" table. Token counts are individually
 * nullable: a provider may report no usage (the image surface's columns are nullable),
 * so the count propagates as null → estimateCost yields null → the UI renders "—",
 * never a false $0. Cost is derived at read (never stored); null = the model isn't in
 * the price table OR no tokens were reported.
 */
export interface UnifiedModelUsageRow {
	workload: AiWorkload;
	modelId: string;
	/** Resolved provider; null when the source bucketed it (chat pre-capture/fallback rows). */
	providerId: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	/** "Thinking" tokens — a SUBSET of outputTokens, never added to the total. Always
	 *  null for chat (that surface doesn't report them). */
	reasoningTokens: number | null;
	/** Period call count. Unit differs by surface — see callUnit. */
	calls: number;
	/** chat = agent steps, image = analyses — distinct real events, labelled honestly. */
	callUnit: 'step' | 'analysis';
	cost: CostEstimate | null;
}

/**
 * Totals for the usage table. Cost coverage is explicit so the UI can NEVER render a
 * misleading grand total: `totalCostUsd` sums ONLY priced rows, and `costCoverage` tells
 * the reader whether that's all rows ('full'), some ('partial'), or none ('none').
 */
export interface ModelUsageSummary {
	totalRowCount: number;
	pricedRowCount: number;
	costCoverage: 'full' | 'partial' | 'none';
	/** Σ over ALL rows (input+output only — reasoning is a subset, never added).
	 *  null only when no row reported any tokens. */
	inputTokens: number | null;
	outputTokens: number | null;
	totalTokens: number | null;
	/** Σ over PRICED rows only. null when no row is priced. A reference estimate, not a charge. */
	totalCostUsd: number | null;
	costKind: 'reference';
	/** Oldest `verifiedOn` among priced rows — the "as of" date for the reference basis. */
	asOf: string | null;
}

// Image Metadata Reader feature health (image surface only)

/**
 * Conversion of analyses into saved metadata. The only outcomes the code produces are
 * `saved` (a metadata row exists) and `abandoned` (analyzed, never saved) — there is no
 * "rejected" write path, so this is a CONVERSION funnel, not an approval-quality one.
 */
export interface ImageConversionFunnel {
	/** Distinct images analyzed in the window. */
	totalImages: number;
	/** Distinct images that ended with a saved metadata record. */
	saved: number;
	/** Distinct analyzed images with no metadata record (the user walked away). */
	abandoned: number;
	/** saved / totalImages, 0..1; null when there are no analyzed images. */
	savedRate: number | null;
}

export interface ImageUsageKpis {
	/** Successful analyses in the window. Failures are NOT recorded — the card discloses this. */
	analyses: number;
	analysesToday: number;
	distinctImages: number;
	/** ISO timestamp of the most recent analysis, all-time; null if none. */
	lastAnalysisAt: string | null;
}

/** A single day's count, for the SSR bar chart. */
export interface UsageVolumeDay {
	date: string;
	count: number;
}
