/**
 * POST ./analyze — run vision extraction for an owned image and record the proposal.
 *
 * Response shape is route-local (`{ ok }`) rather than the repo-wide
 * `{ data } / { error }` helpers: this endpoint is a showcase-internal RPC whose
 * sole consumer is the sibling +page.svelte, which branches on `ok` and merges
 * `fields`/`confidence` field-by-field. See report note on this deliberate choice.
 *
 * Never auto-fired — the client gates the trigger button. Extraction spends AI
 * budget, so ownership is enforced before we ever reach the model.
 */
import { json } from '@sveltejs/kit';
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

/** Sum the known token counts; null only when every term is null (provider reported no usage). */
function sumKnown(...values: (number | null)[]): number | null {
	const known = values.filter((v): v is number => v != null);
	return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

// Synchronous vision extraction can exceed the serverless default; give it room.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		// TODO(i18n)
		return json({ ok: false, reason: 'error', message: 'Not signed in.' }, { status: 401 });
	}

	let imageId: unknown;
	try {
		({ imageId } = (await request.json()) as { imageId?: unknown });
	} catch {
		// TODO(i18n)
		return json({ ok: false, reason: 'error', message: 'Invalid request body.' }, { status: 400 });
	}

	if (typeof imageId !== 'string' || imageId.length === 0) {
		// TODO(i18n)
		return json({ ok: false, reason: 'error', message: 'Missing imageId.' }, { status: 400 });
	}

	// Ownership gate — never analyze an image the caller does not own.
	const img = await getUserImage(locals.user.id, imageId);
	if (!img) {
		// TODO(i18n)
		return json({ ok: false, reason: 'error', message: 'Image not found.' }, { status: 404 });
	}

	const result = await extractImageMetadata(locals.user.id, img.storageKey);

	if (result.ok) {
		await recordProposal(imageId, result);

		const { title, caption, altText, keywords, category } = result.analysis;
		return json({
			ok: true,
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
	}

	return json({ ok: false, reason: result.reason, message: result.message }, { status: REASON_STATUS[result.reason] });
};
