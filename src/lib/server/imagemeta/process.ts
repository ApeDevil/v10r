/**
 * Image processing: magic-byte sniff + EXIF parse + sharp re-encode/resize/strip.
 *
 * The whole privacy posture rests here: sharp drops ALL metadata by default
 * (we never call keepMetadata/withMetadata), so the WebP derivative we store
 * carries no EXIF. GPS is parsed from the ORIGINAL bytes first, then discarded
 * from the stored object — it can only re-enter persistence if the human opts in.
 */

import ExifReader from 'exifreader';
import sharp from 'sharp';
import { IMAGE_MAX_DIMENSION } from '$lib/server/config';
import type { ExtractedExif, ProcessedImage } from './types';

const MAGIC: { mime: string; test: (b: Uint8Array) => boolean }[] = [
	{ mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
	{ mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{
		mime: 'image/webp',
		test: (b) =>
			b[0] === 0x52 &&
			b[1] === 0x49 &&
			b[2] === 0x46 &&
			b[3] === 0x46 && // "RIFF"
			b[8] === 0x57 &&
			b[9] === 0x45 &&
			b[10] === 0x42 &&
			b[11] === 0x50, // "WEBP"
	},
];

/** Detect the real image type from magic bytes, ignoring the client-declared MIME. */
export function sniffImageMime(bytes: Uint8Array): string | null {
	for (const { mime, test } of MAGIC) {
		if (bytes.length >= 12 && test(bytes)) return mime;
	}
	return null;
}

/** Re-encode + resize to a sanitised WebP derivative; parse + return EXIF for opt-in use. */
export async function processImage(bytes: Uint8Array): Promise<ProcessedImage> {
	const exif = parseExif(bytes);

	const out = await sharp(bytes)
		.rotate() // bake EXIF orientation into pixels, then it's gone with the rest of the metadata
		.resize({
			width: IMAGE_MAX_DIMENSION,
			height: IMAGE_MAX_DIMENSION,
			fit: 'inside',
			withoutEnlargement: true,
		})
		.webp({ quality: 82 })
		.toBuffer({ resolveWithObject: true });

	return {
		derivative: new Uint8Array(out.data.buffer, out.data.byteOffset, out.data.byteLength),
		contentType: 'image/webp',
		ext: 'webp',
		width: out.info.width,
		height: out.info.height,
		exif: { ...exif, width: exif.width ?? out.info.width, height: exif.height ?? out.info.height },
	};
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
		? (bytes.buffer as ArrayBuffer)
		: bytes.slice().buffer;
}

function parseExif(bytes: Uint8Array): ExtractedExif {
	const empty: ExtractedExif = {
		width: null,
		height: null,
		make: null,
		model: null,
		dateTimeOriginal: null,
		gps: null,
	};
	try {
		const tags = ExifReader.load(toArrayBuffer(bytes), { expanded: true });
		const lat = tags.gps?.Latitude;
		const lng = tags.gps?.Longitude;
		const hasGps = typeof lat === 'number' && typeof lng === 'number';
		return {
			width: numOrNull(tags.file?.['Image Width']?.value),
			height: numOrNull(tags.file?.['Image Height']?.value),
			make: strOrNull(tags.exif?.Make?.description),
			model: strOrNull(tags.exif?.Model?.description),
			dateTimeOriginal: strOrNull(tags.exif?.DateTimeOriginal?.description),
			gps: hasGps ? { lat: lat as number, lng: lng as number } : null,
		};
	} catch {
		// No / unsupported EXIF (normal for PNG, WebP, screenshots) — not an error.
		return empty;
	}
}

function numOrNull(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
	return typeof v === 'string' && v.trim() ? v.trim() : null;
}
