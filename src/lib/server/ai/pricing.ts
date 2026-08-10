/**
 * Per-model token pricing — hand-maintained reference data (sibling of provider-limits.ts).
 *
 * ZERO runtime imports by design (only an erased `import type`): this is plain
 * documentation that rots, edited by a developer (not an admin UI). Keyed by `modelId`
 * (not providerId) because per-image vision-token cost differs ~25× between models on the
 * same provider — a single per-provider rate would be wrong.
 *
 * HONESTY: our gemini-2.5-flash key runs on the FREE tier, so the real charge is $0.
 * Every dollar figure here is a REFERENCE at standard pay-as-you-go pricing — the
 * returned CostEstimate carries `kind: 'reference'` so no consumer mistakes it for a bill.
 * Each entry carries `verifiedOn` + `sourceUrl` + confidence, mirroring provider-limits.ts.
 */

import type { CostEstimate } from '$lib/schemas/showcase/image-metadata';

export type PriceConfidence = 'documented' | 'estimated' | 'unknown';

export interface ModelPrice {
	modelId: string;
	/** USD per 1,000,000 input tokens (image tokens are folded into input by the provider). */
	inputPerMillion: number;
	/** USD per 1,000,000 output tokens. For thinking models this rate already covers
	 *  thinking/thoughts tokens — there is no separate thinking rate. */
	outputPerMillion: number;
	confidence: PriceConfidence;
	/** Source-of-truth pricing page for the next developer who edits this. */
	sourceUrl: string;
	/** ISO date these numbers were last verified against the provider's pricing page. */
	verifiedOn: string;
	note?: string;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
	'gemini-2.5-flash': {
		modelId: 'gemini-2.5-flash',
		inputPerMillion: 0.3,
		outputPerMillion: 2.5,
		confidence: 'documented',
		sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
		verifiedOn: '2026-06-15',
		note: 'Standard paid-tier rate. The output rate already includes thinking/thoughts tokens (no separate thinking rate). Our key runs free-tier → real cost $0; this is a reference estimate.',
	},
	'gpt-4o-mini': {
		modelId: 'gpt-4o-mini',
		inputPerMillion: 0.15,
		outputPerMillion: 0.6,
		confidence: 'documented',
		sourceUrl: 'https://platform.openai.com/docs/pricing',
		verifiedOn: '2026-06-15',
		note: 'Fallback vision provider. Per-image vision tokens are far higher than Gemini and are counted inside inputTokens by the provider.',
	},
	'llama-3.3-70b-versatile': {
		modelId: 'llama-3.3-70b-versatile',
		inputPerMillion: 0.59,
		outputPerMillion: 0.79,
		confidence: 'documented',
		sourceUrl: 'https://console.groq.com/docs/models',
		verifiedOn: '2026-08-10',
		note: 'Default Groq chat model — text-only, no vision. Our key runs free-tier → real cost $0; this is a reference estimate. Batch API and prompt caching each discount this rate and stack, so a batched cached call bills well under the figure here.',
	},
};

/**
 * Whether the provider's reported `outputTokens` already INCLUDES thinking/reasoning
 * tokens (true) or reports them separately so they must be added to get the billed
 * quantity (false).
 *
 * @ai-sdk/google ≥1.2.23 reports outputTokens as the billed total including thinking,
 * so the default is `true`. CONFIRMED empirically 2026-06-18 against gemini-2.5-flash:
 * a live run reported usage.totalTokens 1051 === input 491 + output 560, with
 * reasoning 380 already INSIDE output (not added on top). If a future provider reports
 * thinking separately (totalTokens ≈ input+output+reasoning), flip this to false.
 */
export const OUTPUT_TOKENS_INCLUDE_THINKING = true;

interface TokenUsage {
	inputTokens: number | null;
	outputTokens: number | null;
	reasoningTokens: number | null;
}

/**
 * Compute a reference cost estimate from token counts. Returns null — never a guess —
 * when the model isn't in the price table, or when no usable token counts were reported.
 *
 * The invariant `inputUsd + outputUsd === totalUsd` always holds. `reasoningUsd` is the
 * slice of `outputUsd` attributable to thinking tokens (reported for transparency); it is
 * a SUBSET, never summed into the total a second time.
 */
export function estimateCost(modelId: string, usage: TokenUsage): CostEstimate | null {
	const price = MODEL_PRICES[modelId];
	if (!price) return null;
	if (usage.inputTokens == null && usage.outputTokens == null) return null;

	const input = usage.inputTokens ?? 0;
	const reasoning = usage.reasoningTokens ?? 0;
	// Billed output: inclusive models already count thinking inside outputTokens; additive
	// models report it separately, so add it back to get the true billed quantity.
	const billedOutput = OUTPUT_TOKENS_INCLUDE_THINKING
		? (usage.outputTokens ?? 0)
		: (usage.outputTokens ?? 0) + reasoning;

	const inputUsd = (input / 1_000_000) * price.inputPerMillion;
	const outputUsd = (billedOutput / 1_000_000) * price.outputPerMillion;
	const reasoningUsd = (reasoning / 1_000_000) * price.outputPerMillion;
	const totalUsd = inputUsd + outputUsd;

	return {
		kind: 'reference',
		pricedAs: modelId,
		currency: 'USD',
		inputUsd,
		outputUsd,
		reasoningUsd,
		totalUsd,
		per1000Usd: totalUsd * 1000,
		confidence: price.confidence,
		verifiedOn: price.verifiedOn,
		sourceUrl: price.sourceUrl,
	};
}
