import type {
	ConfidenceTier,
	CostEstimate,
	ImageAnalysis,
	MetadataFieldKey,
} from '$lib/schemas/showcase/image-metadata';

/** EXIF/technical fields parsed from the ORIGINAL bytes, before stripping. */
export interface ExtractedExif {
	width: number | null;
	height: number | null;
	make: string | null;
	model: string | null;
	dateTimeOriginal: string | null;
	/** Signed decimal degrees, or null. Sensitive — surfaced as an opt-in field only. */
	gps: { lat: number; lng: number } | null;
}

/** Result of the sharp/exif transform: a sanitised WebP derivative + extracted EXIF. */
export interface ProcessedImage {
	derivative: Uint8Array;
	contentType: 'image/webp';
	ext: 'webp';
	width: number;
	height: number;
	exif: ExtractedExif;
}

/** Outcome of ingesting an uploaded image (validate → process → store → row). */
export interface IngestResult {
	imageId: string;
	storageKey: string;
	width: number;
	height: number;
	mimeType: string;
	fileSize: number;
	exif: ExtractedExif;
}

export type ExtractFailureReason = 'no_provider' | 'budget' | 'model_refused' | 'timeout' | 'error';

/** Outcome of a vision extraction run. */
export type ExtractResult =
	| {
			ok: true;
			analysis: ImageAnalysis;
			providerId: string;
			modelId: string;
			inputTokens: number | null;
			outputTokens: number | null;
			/** Gemini "thinking" tokens; null when the provider doesn't report them. */
			reasoningTokens: number | null;
			durationMs: number;
			/** Reference cost estimate; null when the model isn't priced. */
			cost: CostEstimate | null;
	  }
	| { ok: false; reason: ExtractFailureReason; message: string };

export type ConfidenceMap = Record<MetadataFieldKey, ConfidenceTier>;
