/**
 * imagemeta domain orchestration — the framework-free core.
 *
 * ingestImage:        validate → process (strip/resize) → store derivative → asset row
 * saveImageMetadata:  ownership-check → upsert metadata + materialise tags (atomic)
 * recordProposal:     append-only AI run snapshot + telemetry
 * getUserImage:       ownership-scoped lookup (every entry point gates on this)
 *
 * No @sveltejs/kit / $app imports: thin route adapters call into here.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { FieldProvenance, ImageMetadataOutput } from '$lib/schemas/showcase/image-metadata';
import { IMAGE_ALLOWED_MIME, MAX_IMAGE_UPLOAD_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { imageAiProposal, imageAsset, imageMetadata, imageMetadataTag, imageTag } from '$lib/server/db/schema';
import { buildImageKey, deleteImageObject, putImageDerivative } from '$lib/server/store/showcase/image';
import { ImageMetaError } from './errors';
import { processImage, sniffImageMime } from './process';
import type { ExtractResult, IngestResult } from './types';

/** Ownership-scoped image lookup. Returns null if the image isn't this user's. */
export async function getUserImage(userId: string, imageId: string) {
	const [row] = await db
		.select()
		.from(imageAsset)
		.where(and(eq(imageAsset.id, imageId), eq(imageAsset.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Validate, strip+resize, store the derivative, and create the asset row. */
export async function ingestImage(userId: string, file: File): Promise<IngestResult> {
	if (!file || file.size === 0) {
		throw new ImageMetaError('validation', 'No image file was provided.');
	}
	if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
		throw new ImageMetaError(
			'too_large',
			`Image exceeds the ${(MAX_IMAGE_UPLOAD_SIZE / 1024 / 1024).toFixed(0)} MB limit.`,
		);
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const sniffed = sniffImageMime(bytes);
	if (!sniffed || !(IMAGE_ALLOWED_MIME as readonly string[]).includes(sniffed)) {
		throw new ImageMetaError('unsupported', 'Unsupported image type. Use PNG, JPEG, or WebP.');
	}

	const processed = await processImage(bytes);
	const imageId = crypto.randomUUID();
	const key = buildImageKey(userId, imageId, processed.ext);

	await putImageDerivative(key, processed.derivative, processed.contentType);
	try {
		await db.insert(imageAsset).values({
			id: imageId,
			userId,
			storageKey: key,
			mimeType: processed.contentType,
			fileSize: processed.derivative.byteLength,
			width: processed.width,
			height: processed.height,
		});
	} catch (err) {
		// Roll back the orphaned object so a failed insert leaves no dangling bytes.
		await deleteImageObject(key).catch(() => {});
		throw err;
	}

	return {
		imageId,
		storageKey: key,
		width: processed.width,
		height: processed.height,
		mimeType: processed.contentType,
		fileSize: processed.derivative.byteLength,
		exif: processed.exif,
	};
}

/** Persist approved metadata (whole-form atomic) + replace the keyword set. Idempotent. */
export async function saveImageMetadata(
	userId: string,
	data: ImageMetadataOutput,
	provenance: FieldProvenance,
): Promise<{ metadataId: string }> {
	const owned = await getUserImage(userId, data.imageId);
	if (!owned) throw new ImageMetaError('not_found', 'Image not found.');

	const keywords = normalizeKeywords(data.keywords);
	// GPS only persists when the human opted in; otherwise it never touches the DB.
	const gpsLat = data.includeLocation ? data.gpsLat : null;
	const gpsLng = data.includeLocation ? data.gpsLng : null;
	const now = new Date();

	const fields = {
		title: data.title,
		caption: data.caption,
		altText: data.altText,
		category: data.category,
		status: 'approved' as const,
		gpsLat,
		gpsLng,
		fieldProvenance: provenance,
		approvedBy: userId,
		approvedAt: now,
		updatedAt: now,
	};

	return db.transaction(async (tx) => {
		const [meta] = await tx
			.insert(imageMetadata)
			.values({ imageId: data.imageId, ...fields })
			.onConflictDoUpdate({ target: imageMetadata.imageId, set: fields })
			.returning({ id: imageMetadata.id });

		const metadataId = meta.id;

		// Replace the tag set wholesale — simplest correct semantics for an edit.
		await tx.delete(imageMetadataTag).where(eq(imageMetadataTag.metadataId, metadataId));
		const uniqueLabels = [...new Set(keywords)];
		if (uniqueLabels.length > 0) {
			// Batch the tag upsert + junction insert instead of 2 round-trips per keyword.
			// onConflictDoUpdate (label set to itself) makes RETURNING yield existing rows too.
			const tags = await tx
				.insert(imageTag)
				.values(uniqueLabels.map((label) => ({ label })))
				.onConflictDoUpdate({ target: imageTag.label, set: { label: sql`excluded.label` } })
				.returning({ id: imageTag.id });
			await tx
				.insert(imageMetadataTag)
				.values(tags.map((t) => ({ metadataId, tagId: t.id })))
				.onConflictDoNothing();
		}

		return { metadataId };
	});
}

/** Append-only snapshot of a successful AI run (raw output + telemetry). */
export async function recordProposal(imageId: string, run: Extract<ExtractResult, { ok: true }>): Promise<void> {
	await db.insert(imageAiProposal).values({
		imageId,
		providerId: run.providerId,
		modelId: run.modelId,
		inputTokens: run.inputTokens,
		outputTokens: run.outputTokens,
		reasoningTokens: run.reasoningTokens,
		durationMs: run.durationMs,
		rawProposal: run.analysis,
		confidence: run.analysis.confidence,
	});
}

function normalizeKeywords(keywords: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of keywords) {
		const n = raw.trim().toLowerCase();
		if (n && !seen.has(n)) {
			seen.add(n);
			out.push(n);
		}
	}
	return out;
}
