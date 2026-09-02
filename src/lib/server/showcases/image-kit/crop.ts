/**
 * Crop derivative generation — sharp only, no AI.
 *
 * `generateCropDerivative` extracts the snapped (or user-adjusted) rectangle.
 * `generateAttentionCrop` is the DETERMINISTIC comparison: sharp's built-in
 * saliency (`position: attention`) cropped to the same ratio — shown side-by-side
 * with the AI crop so the showcase demonstrates "deterministic vs AI".
 */
import sharp from 'sharp';
import { CROP_RATIO_VALUE, type CropRatio, largestRatioRect } from '$lib/schemas/showcase/image-kit';
import type { PixelRect } from './geometry';

/** Extract a pixel rectangle and re-encode as WebP. */
export async function generateCropDerivative(bytes: Uint8Array, rect: PixelRect): Promise<Uint8Array> {
	const out = await sharp(bytes)
		.extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
		.webp({ quality: 82 })
		.toBuffer();
	return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** sharp's saliency-based smart crop at the target ratio (the deterministic baseline). */
export async function generateAttentionCrop(
	bytes: Uint8Array,
	ratio: CropRatio,
	W: number,
	H: number,
): Promise<Uint8Array> {
	const { width, height } = largestRatioRect(CROP_RATIO_VALUE[ratio], W, H);
	const out = await sharp(bytes)
		.resize({ width, height, fit: 'cover', position: sharp.strategy.attention })
		.webp({ quality: 82 })
		.toBuffer();
	return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** Read the pixel dimensions of an image buffer (the crop rects are relative to these). */
export async function imageDimensions(bytes: Uint8Array): Promise<{ width: number; height: number }> {
	const meta = await sharp(bytes).metadata();
	return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Encode WebP bytes as a `data:` URL for inline preview/download (no extra R2 round-trip). */
export function toDataUrl(bytes: Uint8Array): string {
	return `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`;
}
