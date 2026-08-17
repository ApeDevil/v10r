/**
 * Image Kit showcase — wire + validation contracts.
 *
 * Showcase-only: nothing here is persisted. The metadata vocabulary (categories,
 * confidence tiers) and the usage/cost DTOs are REUSED from the image-metadata
 * reader so the two surfaces can't drift. This file adds the merged-vision schema
 * (metadata + a crop hint), the crop/embed wire shapes, and the aspect-ratio vocab.
 */
import * as v from 'valibot';
import {
	type AnalyzeUsage,
	CONFIDENCE_TIERS,
	type ConfidenceTier,
	type CostEstimate,
	confidenceTierSchema,
	IMAGE_CATEGORIES,
	type ImageCategory,
	imageCategorySchema,
} from './image-metadata';

// Re-export the reused vocab so consumers need a single import for the image-kit surface.
export {
	type AnalyzeUsage,
	type ConfidenceTier,
	CONFIDENCE_TIERS,
	type CostEstimate,
	type ImageCategory,
	IMAGE_CATEGORIES,
};

// Auth-gated v1 needs no signed handle: the server derives the R2 key from the
// session userId + this client-sent id. Validate it's a real UUID (the id the
// upload generated) so a client can't smuggle a path segment into the key.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isImageId(id: unknown): id is string {
	return typeof id === 'string' && UUID_RE.test(id);
}

export function isCropRatio(value: unknown): value is CropRatio {
	return typeof value === 'string' && (CROP_RATIOS as readonly string[]).includes(value);
}

export const CROP_RATIOS = ['1:1', '16:9', '9:16'] as const;
export type CropRatio = (typeof CROP_RATIOS)[number];

/** Width ÷ height for each ratio — the snap geometry consumes this. */
export const CROP_RATIO_VALUE: Record<CropRatio, number> = {
	'1:1': 1,
	'16:9': 16 / 9,
	'9:16': 9 / 16,
};

/** Largest rectangle of the given ratio (w/h) that fits inside W×H, integer px.
 *  Lives here (client-safe) so both the server snap and the client cropper share one impl. */
export function largestRatioRect(ratio: number, W: number, H: number): { width: number; height: number } {
	if (ratio <= 0 || W <= 0 || H <= 0) {
		return { width: Math.max(1, Math.round(W)), height: Math.max(1, Math.round(H)) };
	}
	if (W / H >= ratio) {
		return { width: Math.min(Math.round(H * ratio), W), height: H };
	}
	return { width: W, height: Math.min(Math.round(W / ratio), H) };
}

// 1) Merged vision contract (metadata + crop hint)
// Mirrors the reader's imageAnalysisSchema and adds a `crop` branch. The model
// returns only a salient HINT (Gemini-native conventions below); the server
// re-derives exact pixel geometry deterministically (see snapToAspect), so range
// validation is intentionally NOT enforced here — drift degrades to a center crop.

export const imageKitCropSchema = v.object({
	/** Gemini-native subject box: [ymin, xmin, ymax, xmax], each 0–1000 (y-first). [0,0,0,0] = no subject. */
	subjectBox: v.pipe(v.array(v.number()), v.length(4)),
	/** Most salient point as [x, y], each 0–1 (fractions of width/height). The crop centers here. */
	focalPoint: v.pipe(v.array(v.number()), v.length(2)),
	/** One short phrase describing what the crop should keep. */
	note: v.nullable(v.string()),
});
export type ImageKitCrop = v.InferOutput<typeof imageKitCropSchema>;

export const imageKitVisionSchema = v.object({
	title: v.nullable(v.string()),
	caption: v.nullable(v.string()),
	altText: v.nullable(v.string()),
	keywords: v.array(v.string()),
	category: v.nullable(imageCategorySchema),
	confidence: v.object({
		title: confidenceTierSchema,
		caption: confidenceTierSchema,
		altText: confidenceTierSchema,
		keywords: confidenceTierSchema,
		category: confidenceTierSchema,
	}),
	crop: imageKitCropSchema,
});
export type ImageKitVision = v.InferOutput<typeof imageKitVisionSchema>;

/** True when the model returned nothing usable (couldn't read the image). */
export function visionIsEmpty(a: ImageKitVision): boolean {
	return a.title === null && a.caption === null && a.altText === null && a.category === null && a.keywords.length === 0;
}

// 2) Wire DTOs — vision RPC
// Route-local `{ ok }` envelope (same convention as the reader's analyze RPC).

export const VISION_FAILURE_REASONS = ['no_provider', 'budget', 'model_refused', 'timeout', 'error'] as const;
export type VisionFailureReason = (typeof VISION_FAILURE_REASONS)[number];

export type MetadataFieldKey = 'title' | 'caption' | 'altText' | 'keywords' | 'category';

export interface VisionFields {
	title: string | null;
	caption: string | null;
	altText: string | null;
	keywords: string[];
	category: ImageCategory | null;
}

/** A snapped, server-authoritative crop rect in PIXELS of the processed (WebP) derivative. */
export interface CropFrame {
	ratio: CropRatio;
	rect: { left: number; top: number; width: number; height: number };
	/** True when this is the geometric center-crop fallback (model gave no usable region). */
	fallback: boolean;
}

export interface VisionOk {
	ok: true;
	fields: VisionFields;
	confidence: Record<MetadataFieldKey, ConfidenceTier>;
	/** Dimensions the crop rects are relative to (the stored derivative). */
	image: { width: number; height: number };
	crops: CropFrame[];
	cropNote: string | null;
	usage: AnalyzeUsage;
	cost: CostEstimate | null;
}
export interface VisionErr {
	ok: false;
	reason: VisionFailureReason;
	message: string;
}
export type VisionResponse = VisionOk | VisionErr;

// 3) Wire DTOs — crop derivative RPC (sharp only, no AI)

export interface CropDerivativeOk {
	ok: true;
	ratio: CropRatio;
	/** The AI-suggested (or user-adjusted) crop, extracted at `rect`, as a data URL. */
	aiCrop: string;
	/** sharp `attention` saliency crop at the same ratio — the deterministic comparison. */
	attentionCrop: string;
	rect: { left: number; top: number; width: number; height: number };
}
export interface CropDerivativeErr {
	ok: false;
	reason: 'not_found' | 'error';
	message: string;
}
export type CropDerivativeResponse = CropDerivativeOk | CropDerivativeErr;

// 4) Wire DTOs — embed RPC

export const EMBED_FAILURE_REASONS = ['no_provider', 'budget', 'empty_source', 'error'] as const;
export type EmbedFailureReason = (typeof EMBED_FAILURE_REASONS)[number];

export interface EmbedNeighbor {
	label: string;
	/** Cosine similarity in [-1, 1]. */
	similarity: number;
}

export interface EmbedOk {
	ok: true;
	model: string;
	modality: 'text' | 'image';
	dimensions: number;
	/** The caption text that was embedded (text modality); null for image modality. */
	sourceText: string | null;
	/** L2 norm of the raw vector — a "look inside the model" stat. */
	l2Norm: number;
	/** The raw vector — present only when the client asked for it (heatmap). Viz-only, never stored. */
	vector: number[] | null;
	/** Cosine similarity to a small fixed in-memory corpus, sorted desc. */
	neighbors: EmbedNeighbor[];
}
export interface EmbedErr {
	ok: false;
	reason: EmbedFailureReason;
	message: string;
}
export type EmbedResponse = EmbedOk | EmbedErr;

// 5) Upload result (form action → client)

/** Pre-run cost estimate shown next to the Run button before spending. */
export interface PreRunEstimate {
	estInputTokens: number;
	estOutputTokens: number;
	cost: CostEstimate | null;
}

export interface UploadResult {
	imageId: string;
	previewUrl: string;
	width: number;
	height: number;
	fileSize: number;
	/** Reference estimate for one Run; null when no vision provider is configured. */
	estimate: PreRunEstimate | null;
}
