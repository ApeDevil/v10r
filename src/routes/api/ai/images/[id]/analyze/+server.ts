/**
 * POST /api/ai/images/[id]/analyze — run vision extraction for an owned image and
 * record the proposal.
 *
 * Formerly a route-local showcase RPC (`showcases/ai/image-metadata/analyze`), which
 * let it bypass the shared AI guard: real vision budget was spent with no AI rate
 * limit and no daily-budget check. Promoted to the un-localized API tree behind
 * `guardAiRequest` and normalized to the repo-wide `{ data } / { error }` envelope.
 * The image id is the path segment (subresource action) — the target resource is
 * also the idempotency key.
 */

import { guardAiRequest } from '$lib/server/ai/guard';
import { apiError, apiOk } from '$lib/server/api/response';
import { redis } from '$lib/server/cache';
import type { ExtractFailureReason } from '$lib/server/imagemeta';
import { extractImageMetadata, getUserImage, recordProposal } from '$lib/server/imagemeta';
import type { RequestHandler } from './$types';

/** Map a vision-extraction failure reason to an HTTP status. */
const REASON_STATUS: Record<ExtractFailureReason, number> = {
	no_provider: 503,
	budget: 429,
	model_refused: 422,
	timeout: 504,
	error: 500,
};

/** The generic `error` reason becomes a named code in the public envelope. */
function reasonCode(reason: ExtractFailureReason): string {
	return reason === 'error' ? 'extract_failed' : reason;
}

/** Sum the known token counts; null only when every term is null (provider reported no usage). */
function sumKnown(...values: (number | null)[]): number | null {
	const known = values.filter((v): v is number => v != null);
	return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

// Synchronous vision extraction can exceed the serverless default; give it room.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ params, locals }) => {
	// auth → aiConfigured → rate-limit → daily budget: the same four gates every
	// AI-spending route passes. This endpoint used to skip all but auth.
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	// Ownership gate — never analyze an image the caller does not own.
	const img = await getUserImage(guard.user.id, params.id);
	if (!img) return apiError(404, 'not_found', 'Image not found.');

	// Idempotency: a short per-(user, image) claim so an accidental duplicate request
	// (double-click, client retry) cannot double-spend vision budget. Fail-open when
	// Redis is down — the guard's rate limit still bounds the damage.
	const lockKey = `imagemeta:analyze:${guard.user.id}:${params.id}`;
	if (redis) {
		const claimed = await redis.set(lockKey, '1', { nx: true, ex: 30 });
		if (claimed === null) {
			return apiError(409, 'analyze_in_flight', 'This image is already being analyzed. Please wait a moment.');
		}
	}

	try {
		const result = await extractImageMetadata(guard.user.id, img.storageKey);

		if (!result.ok) {
			return apiError(REASON_STATUS[result.reason], reasonCode(result.reason), result.message);
		}

		await recordProposal(params.id, result);

		const { title, caption, altText, keywords, category } = result.analysis;
		return apiOk({
			fields: { title, caption, altText, keywords, category },
			confidence: result.analysis.confidence,
			usage: {
				providerId: result.providerId,
				modelId: result.modelId,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				reasoningTokens: result.reasoningTokens,
				// Total = input + output only. Reasoning ("thinking") tokens are a SUBSET of
				// output, not a separate bucket — empirically confirmed 2026-06-18 against
				// gemini-2.5-flash: usage.totalTokens (1051) === input (491) + output (560),
				// with reasoning (380) already inside output. Adding reasoning here would
				// double-count it (see OUTPUT_TOKENS_INCLUDE_THINKING in ai/pricing.ts).
				totalTokens: sumKnown(result.inputTokens, result.outputTokens),
				durationMs: result.durationMs,
			},
			cost: result.cost,
		});
	} finally {
		if (redis) await redis.del(lockKey);
	}
};
