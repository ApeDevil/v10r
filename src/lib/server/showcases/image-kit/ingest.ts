/**
 * Ephemeral ingest — the no-DB counterpart of imagemeta's `ingestImage`.
 *
 * Validate → process (sharp resize + EXIF strip, reused from imagemeta) → store the
 * WebP derivative under the `showcase/imagekit/` prefix. Deliberately writes NO
 * database row: the toolkit persists nothing. The object is keyed by the session
 * userId; the discard RPC + an R2 lifecycle TTL reclaim it.
 */

import { ImageMetaError, processImage, sniffImageMime } from '$lib/server/imagemeta';
import { ALLOWED_MIME, MAX_UPLOAD_SIZE } from '$lib/server/imagemeta/config';
import { buildImagekitKey, putImagekitDerivative } from '$lib/server/showcases/image-kit/storage';
import type { EphemeralUpload } from './types';

export async function ingestEphemeralImage(userId: string, file: File): Promise<EphemeralUpload> {
	if (!file || file.size === 0) {
		throw new ImageMetaError('validation', 'No image file was provided.');
	}
	if (file.size > MAX_UPLOAD_SIZE) {
		throw new ImageMetaError('too_large', `Image exceeds the ${(MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(0)} MB limit.`);
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const sniffed = sniffImageMime(bytes);
	if (!sniffed || !(ALLOWED_MIME as readonly string[]).includes(sniffed)) {
		throw new ImageMetaError('unsupported', 'Unsupported image type. Use PNG, JPEG, or WebP.');
	}

	const processed = await processImage(bytes);
	const imageId = crypto.randomUUID();
	const key = buildImagekitKey(userId, imageId, processed.ext);

	await putImagekitDerivative(key, processed.derivative, processed.contentType);

	return {
		imageId,
		storageKey: key,
		width: processed.width,
		height: processed.height,
		fileSize: processed.derivative.byteLength,
	};
}
