/**
 * POST ./crop — produce the cropped image bytes (sharp only, no AI, no budget).
 *
 * Returns the AI-suggested (or user-adjusted) crop AND sharp's deterministic
 * `attention` crop at the same ratio, as data URLs, for the side-by-side comparison
 * and download. The incoming rect is re-clamped server-side against the real image
 * dimensions — a client can never produce an out-of-bounds or wrong-ratio crop.
 */
import { json } from '@sveltejs/kit';
import { type CropDerivativeResponse, type CropRatio, isCropRatio, isImageId } from '$lib/schemas/showcase/image-kit';
import {
	generateAttentionCrop,
	generateCropDerivative,
	imageDimensions,
	toDataUrl,
} from '$lib/server/showcases/image-kit';
import { buildImagekitKey, getImagekitBytes } from '$lib/server/showcases/image-kit/storage';
import type { RequestHandler } from './$types';

interface RectInput {
	left: number;
	top: number;
	width: number;
	height: number;
}

function clampInt(n: unknown, lo: number, hi: number): number {
	const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : lo;
	return Math.min(hi, Math.max(lo, v));
}

/** Re-clamp a client rect into the image; guarantees left+width ≤ W, top+height ≤ H. */
function clampRect(rect: Partial<RectInput> | undefined, W: number, H: number): RectInput {
	const left = clampInt(rect?.left, 0, Math.max(0, W - 1));
	const top = clampInt(rect?.top, 0, Math.max(0, H - 1));
	const width = clampInt(rect?.width, 1, W - left);
	const height = clampInt(rect?.height, 1, H - top);
	return { left, top, width, height };
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ ok: false, reason: 'error', message: 'Not signed in.' } satisfies CropDerivativeResponse, {
			status: 401,
		});
	}

	let body: { imageId?: unknown; ratio?: unknown; rect?: Partial<RectInput> };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, reason: 'error', message: 'Invalid request body.' } satisfies CropDerivativeResponse, {
			status: 400,
		});
	}
	const { imageId, ratio, rect } = body;
	if (!isImageId(imageId) || !isCropRatio(ratio)) {
		return json(
			{ ok: false, reason: 'error', message: 'Missing or invalid imageId/ratio.' } satisfies CropDerivativeResponse,
			{
				status: 400,
			},
		);
	}

	const key = buildImagekitKey(locals.user.id, imageId, 'webp');
	let bytes: Uint8Array;
	try {
		bytes = await getImagekitBytes(key);
	} catch {
		return json(
			{
				ok: false,
				reason: 'not_found',
				message: 'Image not found — re-upload and try again.',
			} satisfies CropDerivativeResponse,
			{
				status: 404,
			},
		);
	}

	try {
		const { width: W, height: H } = await imageDimensions(bytes);
		const clamped = clampRect(rect, W, H);
		const [ai, attention] = await Promise.all([
			generateCropDerivative(bytes, clamped),
			generateAttentionCrop(bytes, ratio as CropRatio, W, H),
		]);
		return json(
			{
				ok: true,
				ratio: ratio as CropRatio,
				aiCrop: toDataUrl(ai),
				attentionCrop: toDataUrl(attention),
				rect: clamped,
			} satisfies CropDerivativeResponse,
			{ status: 200 },
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Crop failed.';
		return json({ ok: false, reason: 'error', message } satisfies CropDerivativeResponse, { status: 500 });
	}
};
