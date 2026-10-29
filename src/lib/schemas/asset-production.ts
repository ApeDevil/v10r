/**
 * An asset production request — the one structured, validated description of a 3D object
 * that `#lib/asset-production/index.ts` turns into a GLB. Every caller (the showcase form,
 * the HTTP route, the CLI, an AI or MCP tool) sends exactly this shape, so none of them can
 * reach a modeling operation the schema does not name.
 *
 * Units and axes: metres, right-handed, +Y up (glTF and Three.js convention).
 *
 * Objects are strict and every number is bounded: an unknown key is refused, not dropped, and
 * no field can ask for more geometry than the bounds below allow. The bounds are one table,
 * read by the schema, the showcase sliders and the tool description alike.
 */
import * as v from 'valibot';

/** The request shape number. Bumped when a field changes meaning, not when a generator's code changes. */
export const ASSET_REQUEST_FORMAT = 1;

/** A closed numeric range; `step` 1 means an integer field. */
export interface ParameterBound {
	min: number;
	max: number;
	step: number;
	default: number;
}

/** The structural ring: a square-section truss bent into a ring, with spokes, a hub and modules. */
export const STRUCTURAL_RING_BOUNDS = {
	/** Centre-line radius of the truss, metres. */
	ringRadius: { min: 2, max: 30, step: 0.5, default: 8 },
	/** Truss bays around the ring. */
	bays: { min: 8, max: 64, step: 1, default: 24 },
	/** Radial width of the truss section, metres. */
	trussDepth: { min: 0.2, max: 3, step: 0.05, default: 1 },
	/** Axial height of the truss section, metres. */
	trussHeight: { min: 0.2, max: 3, step: 0.05, default: 0.8 },
	/** Radius of every truss member, metres. */
	strutRadius: { min: 0.01, max: 0.2, step: 0.005, default: 0.04 },
	/** Spokes from the hub to the ring; 0, or 3 and more. */
	spokes: { min: 0, max: 12, step: 1, default: 4 },
	/** Radius of the central hub, metres. */
	hubRadius: { min: 0.3, max: 5, step: 0.1, default: 1.2 },
	/** Pressurised modules mounted on the outer chords, spread evenly over the bays. */
	modules: { min: 0, max: 64, step: 1, default: 6 },
	/** Facets around each round member: the level of detail. */
	detail: { min: 3, max: 16, step: 1, default: 8 },
} as const satisfies Record<string, ParameterBound>;

/** How the faces of each bay are braced. */
export const BRACING_PATTERNS = ['warren', 'pratt', 'x-brace'] as const;
export type BracingPattern = (typeof BRACING_PATTERNS)[number];

/** Both ends closed, so NaN and ±Infinity fail too (no `finite` action: it has no JSON Schema form). */
function bounded(bound: ParameterBound) {
	const base = v.pipe(v.number(), v.minValue(bound.min), v.maxValue(bound.max));
	return bound.step === 1 ? v.pipe(base, v.integer()) : base;
}

const b = STRUCTURAL_RING_BOUNDS;

export const structuralRingParametersSchema = v.strictObject({
	ringRadius: bounded(b.ringRadius),
	bays: bounded(b.bays),
	trussDepth: bounded(b.trussDepth),
	trussHeight: bounded(b.trussHeight),
	strutRadius: bounded(b.strutRadius),
	bracing: v.picklist(BRACING_PATTERNS),
	spokes: bounded(b.spokes),
	hubRadius: bounded(b.hubRadius),
	modules: bounded(b.modules),
	detail: bounded(b.detail),
});
export type StructuralRingParameters = v.InferOutput<typeof structuralRingParametersSchema>;

export const STRUCTURAL_RING_DEFAULTS: StructuralRingParameters = {
	ringRadius: b.ringRadius.default,
	bays: b.bays.default,
	trussDepth: b.trussDepth.default,
	trussHeight: b.trussHeight.default,
	strutRadius: b.strutRadius.default,
	bracing: 'warren',
	spokes: b.spokes.default,
	hubRadius: b.hubRadius.default,
	modules: b.modules.default,
	detail: b.detail.default,
};

/** Shown to people, never used as a path or a key: printable text only. */
const labelSchema = v.pipe(
	v.string(),
	v.minLength(1),
	v.maxLength(80),
	v.regex(/^\P{Cc}+$/u, 'must be printable text'),
);

/**
 * The request. `generator` is the discriminator, so a second generator is one more entry in
 * the variant — and a request can never name an operation no generator implements.
 */
export const assetRequestSchema = v.variant('generator', [
	v.strictObject({
		format: v.literal(ASSET_REQUEST_FORMAT),
		generator: v.literal('structural-ring'),
		label: v.optional(labelSchema),
		parameters: structuralRingParametersSchema,
	}),
]);
export type AssetRequest = v.InferOutput<typeof assetRequestSchema>;
export type AssetGeneratorId = AssetRequest['generator'];
