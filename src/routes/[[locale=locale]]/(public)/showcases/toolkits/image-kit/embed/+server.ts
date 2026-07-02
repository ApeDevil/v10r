/**
 * POST ./embed — embed the AI caption (default) or the image (multimodal toggle).
 *
 * Viz-only: the returned vector is for the heatmap + cosine bars; nothing is stored.
 * The image modality uses the preview multimodal model and is isolated — any failure
 * collapses to `{ ok:false }` so the rest of the page keeps working.
 */
import { json } from '@sveltejs/kit';
import { type EmbedFailureReason, type EmbedResponse, isImageId } from '$lib/schemas/showcase/image-kit';
import { checkUserBudget } from '$lib/server/ai/budget';
import { embedCaptionText, embedImage, l2Norm } from '$lib/server/imagekit';
import { buildImageKey, getImageBytes } from '$lib/server/store/showcase/imagekit';
import type { RequestHandler } from './$types';

// A multimodal image embed can outrun the ~10s serverless default; give it headroom.
export const config = { runtime: 'nodejs22.x', maxDuration: 30 };

const REASON_STATUS: Record<EmbedFailureReason, number> = {
	no_provider: 503,
	budget: 429,
	empty_source: 422,
	error: 500,
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ ok: false, reason: 'error', message: 'Not signed in.' } satisfies EmbedResponse, { status: 401 });
	}

	let body: { imageId?: unknown; source?: unknown; includeVector?: unknown; multimodal?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, reason: 'error', message: 'Invalid request body.' } satisfies EmbedResponse, {
			status: 400,
		});
	}
	const { imageId, source, includeVector, multimodal } = body;
	if (!isImageId(imageId)) {
		return json({ ok: false, reason: 'error', message: 'Missing or invalid imageId.' } satisfies EmbedResponse, {
			status: 400,
		});
	}

	const budget = await checkUserBudget(locals.user.id);
	if (!budget.allowed) {
		return json({ ok: false, reason: 'budget', message: budget.reason } satisfies EmbedResponse, { status: 429 });
	}

	try {
		const run =
			multimodal === true
				? await embedImage(await getImageBytes(buildImageKey(locals.user.id, imageId, 'webp')), 'image/webp')
				: await embedFromSource(source);

		const res: EmbedResponse = {
			ok: true,
			model: run.model,
			modality: run.modality,
			dimensions: run.dimensions,
			sourceText: run.modality === 'text' && typeof source === 'string' ? source : null,
			l2Norm: l2Norm(run.vector),
			vector: includeVector === true ? run.vector : null,
			neighbors: run.neighbors,
		};
		return json(res, { status: 200 });
	} catch (err) {
		if (err instanceof EmptySourceError) {
			return json({ ok: false, reason: 'empty_source', message: err.message } satisfies EmbedResponse, { status: 422 });
		}
		const message = err instanceof Error ? err.message : 'Embedding failed.';
		const reason: EmbedFailureReason = /no_provider/.test(message) ? 'no_provider' : 'error';
		return json({ ok: false, reason, message } satisfies EmbedResponse, { status: REASON_STATUS[reason] });
	}
};

class EmptySourceError extends Error {}

async function embedFromSource(source: unknown) {
	const text = typeof source === 'string' ? source.trim() : '';
	if (!text) throw new EmptySourceError('No caption text to embed. Run analysis first.');
	return embedCaptionText(text);
}
