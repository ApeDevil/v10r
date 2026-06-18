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
		});
	}

	return json({ ok: false, reason: result.reason, message: result.message }, { status: REASON_STATUS[result.reason] });
};
