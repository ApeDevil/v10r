/**
 * POST ./discard — best-effort delete of the ephemeral R2 object (fired on Approve).
 *
 * The whole page persists nothing; this is the in-app cleanup so an uploaded image
 * doesn't linger. A failed delete is swallowed — the R2 lifecycle TTL on the
 * `showcase/imagekit/` prefix is the safety net for abandoned sessions.
 */
import { json } from '@sveltejs/kit';
import { isImageId } from '$lib/schemas/showcase/image-kit';
import { buildImagekitKey, deleteImagekitObject } from '$lib/server/store/showcase/imagekit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });

	let imageId: unknown;
	try {
		({ imageId } = (await request.json()) as { imageId?: unknown });
	} catch {
		return json({ ok: false }, { status: 400 });
	}
	if (!isImageId(imageId)) return json({ ok: false }, { status: 400 });

	try {
		await deleteImagekitObject(buildImagekitKey(locals.user.id, imageId, 'webp'));
	} catch {
		// Swallow — the R2 lifecycle TTL reclaims anything we miss.
	}
	return json({ ok: true });
};
