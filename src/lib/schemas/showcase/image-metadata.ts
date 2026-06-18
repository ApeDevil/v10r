import * as v from 'valibot';

// ── Vocabularies ────────────────────────────────────────────────────

/** Semantic image categories the user (or AI) classifies an image into. */
export const IMAGE_CATEGORIES = ['photo', 'illustration', 'screenshot', 'diagram', 'document', 'other'] as const;
export const imageCategorySchema = v.picklist(IMAGE_CATEGORIES);
export type ImageCategory = v.InferOutput<typeof imageCategorySchema>;

/** Three-tier confidence bucket. Never a raw float — advisory only, never gates save. */
export const CONFIDENCE_TIERS = ['high', 'medium', 'low'] as const;
export const confidenceTierSchema = v.picklist(CONFIDENCE_TIERS);
export type ConfidenceTier = v.InferOutput<typeof confidenceTierSchema>;

/** The content fields whose provenance (empty | ai-draft | human) and confidence we track. */
export const METADATA_FIELD_KEYS = ['title', 'caption', 'altText', 'keywords', 'category'] as const;
export type MetadataFieldKey = (typeof METADATA_FIELD_KEYS)[number];

/** Per-field provenance, displayed as an affordance and persisted as audit. */
export const PROVENANCE_STATES = ['empty', 'ai-draft', 'human'] as const;
export const provenanceStateSchema = v.picklist(PROVENANCE_STATES);
export type ProvenanceState = v.InferOutput<typeof provenanceStateSchema>;
export type FieldProvenance = Record<MetadataFieldKey, ProvenanceState>;

// ── 1) AI-propose contract ──────────────────────────────────────────
// Every content field is nullable: null = "the AI could not determine this".
// This is the canonical VALIDATION schema. AI SDK v6 Output.object needs an SDK
// jsonSchema() (not a Valibot schema directly), so extract.ts hand-writes a
// jsonSchema() mirror for generation and re-validates the model output against
// THIS schema — drift between the two then surfaces as model_refused.
// `keywords` is a (possibly empty) array, never null, to dodge Gemini's optional-array quirk.

export const imageAnalysisSchema = v.object({
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
});
export type ImageAnalysis = v.InferOutput<typeof imageAnalysisSchema>;

/** True when the model returned nothing usable (couldn't read the image) — treat as model_refused. */
export function analysisIsEmpty(a: ImageAnalysis): boolean {
	return a.title === null && a.caption === null && a.altText === null && a.category === null && a.keywords.length === 0;
}

// ── 2) Strict save contract ─────────────────────────────────────────
// The single gate for Superforms + persistence. The manual form is the always-usable
// ground floor; the AI path only ever pre-fills values that still pass this schema.

export const imageMetadataSaveSchema = v.object({
	/** Which image this metadata belongs to (hidden field, set at upload-confirm). */
	imageId: v.pipe(v.string(), v.nonEmpty()),
	title: v.pipe(v.string(), v.trim(), v.nonEmpty('Title is required'), v.maxLength(200, 'Max 200 characters')),
	caption: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000, 'Max 2000 characters')), ''),
	altText: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Alt text is required for accessibility'),
		v.maxLength(250, 'Max 250 characters'),
	),
	keywords: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(50))),
		v.maxLength(25, 'Max 25 keywords'),
	),
	category: imageCategorySchema,
	// GPS is opt-in (default OFF). Coordinates only persist when includeLocation is true;
	// the approval dialog doubles as the consent gate for this sensitive field.
	includeLocation: v.optional(v.boolean(), false),
	gpsLat: v.nullable(v.pipe(v.number(), v.minValue(-90), v.maxValue(90))),
	gpsLng: v.nullable(v.pipe(v.number(), v.minValue(-180), v.maxValue(180))),
});
export type ImageMetadataInput = v.InferInput<typeof imageMetadataSaveSchema>;
export type ImageMetadataOutput = v.InferOutput<typeof imageMetadataSaveSchema>;

/** Blank form defaults for a freshly-uploaded image (manual path, before any AI fill). */
export function emptyImageMetadata(imageId: string): ImageMetadataInput {
	return {
		imageId,
		title: '',
		caption: '',
		altText: '',
		keywords: [],
		category: 'photo',
		includeLocation: false,
		gpsLat: null,
		gpsLng: null,
	};
}
