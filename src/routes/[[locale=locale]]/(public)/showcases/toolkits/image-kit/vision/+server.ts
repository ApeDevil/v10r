/**
 * POST ./vision — the merged metadata + crop pass for an uploaded image.
 *
 * Route-local `{ ok }` envelope (same convention as the reader's analyze RPC), sole
 * consumer is the sibling page. Auth-gated; the R2 key is DERIVED from the session
 * userId (never client-supplied), so a caller can only ever address their own object.
 * Nothing is persisted.
 */
import { json } from '@sveltejs/kit';
import { isImageId, type VisionFailureReason, type VisionResponse } from '$lib/schemas/showcase/image-kit';
import { runVision } from '$lib/server/imagekit';
import { buildImageKey, getImageBytes } from '$lib/server/store/showcase/imagekit';
import type { RequestHandler } from './$types';

const REASON_STATUS: Record<VisionFailureReason, number> = {
	no_provider: 503,
	budget: 429,
	model_refused: 422,
	timeout: 504,
	error: 500,
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ ok: false, reason: 'error', message: 'Not signed in.' } satisfies VisionResponse, { status: 401 });
	}

	let imageId: unknown;
	try {
		({ imageId } = (await request.json()) as { imageId?: unknown });
	} catch {
		return json({ ok: false, reason: 'error', message: 'Invalid request body.' } satisfies VisionResponse, {
			status: 400,
		});
	}
	if (!isImageId(imageId)) {
		return json({ ok: false, reason: 'error', message: 'Missing or invalid imageId.' } satisfies VisionResponse, {
			status: 400,
		});
	}

	const key = buildImageKey(locals.user.id, imageId, 'webp');
	let bytes: Uint8Array;
	try {
		bytes = await getImageBytes(key);
	} catch {
		return json(
			{ ok: false, reason: 'error', message: 'Image not found — re-upload and try again.' } satisfies VisionResponse,
			{
				status: 404,
			},
		);
	}

	const result = await runVision(locals.user.id, bytes);
	return json(result, { status: result.ok ? 200 : REASON_STATUS[result.reason] });
};
