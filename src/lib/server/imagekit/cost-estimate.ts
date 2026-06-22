/**
 * Pre-run cost estimate — shown next to the Run button BEFORE spending, so a
 * visitor knows the rough cost of one pass (the established AI-UX cost-transparency
 * pattern). Heuristic, not a charge: Gemini bills image input by tiling (~258
 * tokens per 768px tile), plus a fixed output budget for the merged response.
 */
import type { PreRunEstimate } from '$lib/schemas/showcase/image-kit';
import { estimateCost } from '$lib/server/ai/pricing';

const TILE_PX = 768;
const TOKENS_PER_TILE = 258;
const EST_OUTPUT_TOKENS = 320;

export function estimatePreRunCost(modelId: string, dims: { width: number; height: number }): PreRunEstimate {
	const tilesW = Math.max(1, Math.ceil(dims.width / TILE_PX));
	const tilesH = Math.max(1, Math.ceil(dims.height / TILE_PX));
	const estInputTokens = tilesW * tilesH * TOKENS_PER_TILE;
	const cost = estimateCost(modelId, {
		inputTokens: estInputTokens,
		outputTokens: EST_OUTPUT_TOKENS,
		reasoningTokens: null,
	});
	return { estInputTokens, estOutputTokens: EST_OUTPUT_TOKENS, cost };
}
