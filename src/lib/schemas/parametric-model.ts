/**
 * A parametric model — the authoritative, declarative description of a 3D object that
 * `#lib/asset-production/modeling/` evaluates into geometry. An AI agent, the MCP 3D service,
 * the model viewer and a shared model link all carry exactly this document; the geometry is
 * always derived from it, never stored beside it.
 *
 * Shape: named numeric `parameters`, then a **feature graph** — an ordered list of
 * `operations`, each with an `id`, that may reference only operations listed before it (so the
 * graph is acyclic by construction) — and the `output` ids that become the model's components.
 *
 * What a caller cannot express, by construction: code, file paths, URLs, engine flags, or an
 * expression richer than the bounded arithmetic in `expression.ts`. Objects are strict (an
 * unknown key is refused, not dropped) and every count is capped by `MODELING_LIMITS`, the one
 * table the schema, the resource estimate and the `describe_modeling` answer all read.
 *
 * Axes: right-handed, +Z up in the model (CAD convention); the GLB writer turns it into glTF's
 * +Y up and metres. Angles are degrees everywhere except inside expressions (radians, `pi`).
 */
import * as v from 'valibot';

/** The document format. Bumped when a field changes meaning; a model link names it. */
export const PARAMETRIC_MODEL_VERSION = 1;

/** Every bound the modeling contract enforces — before any geometry is allocated. */
export const MODELING_LIMITS = {
	/** Canonical JSON of the whole model, bytes. */
	maxModelBytes: 16_384,
	maxParameters: 32,
	maxOperations: 64,
	/** Longest chain of references from an output down to a primitive. */
	maxGraphDepth: 24,
	maxOutputs: 16,
	/** Ids an operation may combine (`union.of`, `subtract.remove`, …). */
	maxOperands: 32,
	maxExpressionLength: 120,
	maxExpressionTokens: 48,
	maxExpressionDepth: 8,
	/** Absolute value of any resolved number, in model units or degrees. */
	maxMagnitude: 100_000,
	minSegments: 3,
	maxSegments: 128,
	/** Copies a single pattern operation may make. */
	maxPatternCount: 64,
	/** Copies all pattern operations of one model may make together. */
	maxPatternInstances: 512,
	maxProfilePoints: 256,
	maxExtrudeDivisions: 64,
	maxBlendSpheres: 32,
	/** Grid cells per axis for `heightfield` and `blend`. */
	minResolution: 4,
	maxResolution: 96,
	maxRefine: 4,
	/** Largest extent of the evaluated model, metres — the envelope inspection enforces. */
	maxExtentMetres: 50,
} as const;

export const MODEL_UNITS = ['mm', 'cm', 'm', 'in'] as const;
export type ModelUnit = (typeof MODEL_UNITS)[number];

/** Metres per model unit: the scale the GLB writer applies (glTF is metres). */
export const METRES_PER_UNIT: Record<ModelUnit, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 };

/** Surface finishes a component may name. The GLB writer maps each to a PBR material. */
export const MODEL_MATERIALS = ['metal', 'plastic', 'wood', 'rubber', 'glass', 'ceramic', 'accent'] as const;
export type ModelMaterial = (typeof MODEL_MATERIALS)[number];

const L = MODELING_LIMITS;

/** `[a-z][a-zA-Z0-9_]*` — an operation id or parameter name, short enough to stay readable. */
const NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const nameSchema = v.pipe(v.string(), v.regex(NAME_PATTERN, 'must match [a-z][a-zA-Z0-9_]{0,31}'));

/**
 * A number, or a bounded arithmetic expression over `$parameter` references
 * (`"$width / 2 - 4"`). Parsed and evaluated by `expression.ts`, never by `eval`.
 */
const numericSchema = v.union(
	[
		v.pipe(v.number(), v.finite()),
		v.pipe(v.string(), v.minLength(1), v.maxLength(L.maxExpressionLength, 'expression too long')),
	],
	'must be a number or an expression string',
);
export type NumericValue = v.InferOutput<typeof numericSchema>;

const vec2Schema = v.tuple([numericSchema, numericSchema]);
const vec3Schema = v.tuple([numericSchema, numericSchema, numericSchema]);
const segmentsSchema = v.pipe(v.number(), v.integer(), v.minValue(L.minSegments), v.maxValue(L.maxSegments));
const resolutionSchema = v.pipe(v.number(), v.integer(), v.minValue(L.minResolution), v.maxValue(L.maxResolution));
const refineSchema = v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(L.maxRefine));
const operandsSchema = v.pipe(v.array(nameSchema), v.minLength(1), v.maxLength(L.maxOperands));
const axisSchema = v.picklist(['x', 'y', 'z']);
const countSchema = v.union([
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(L.maxPatternCount)),
	v.pipe(v.string(), v.minLength(1), v.maxLength(L.maxExpressionLength)),
]);

/**
 * Placement every solid-producing operation accepts: scale, then rotate (degrees about X, then
 * Y, then Z), then translate to `at`. Applied by the kernel, so the trigonometry is the
 * kernel's (WebAssembly, the same bits in every JavaScript engine).
 */
const placement = {
	at: v.optional(vec3Schema),
	rotate: v.optional(vec3Schema),
	scale: v.optional(v.union([numericSchema, vec3Schema])),
	material: v.optional(v.picklist(MODEL_MATERIALS)),
};

/** A closed 2D outline in the XY plane, for `extrude` and `revolve`. */
const profileSchema = v.variant('shape', [
	v.strictObject({
		shape: v.literal('rect'),
		size: vec2Schema,
		/** Corner radius: a rounded rectangle. */
		round: v.optional(numericSchema),
		center: v.optional(v.boolean()),
	}),
	v.strictObject({ shape: v.literal('circle'), r: numericSchema, segments: v.optional(segmentsSchema) }),
	v.strictObject({
		shape: v.literal('polygon'),
		points: v.pipe(v.array(vec2Schema), v.minLength(3), v.maxLength(L.maxProfilePoints)),
	}),
]);
export type ModelProfile = v.InferOutput<typeof profileSchema>;

const id = { id: nameSchema };

/** One operation of the feature graph. `op` is the discriminator; each shape is strict. */
export const modelOperationSchema = v.variant('op', [
	// Primitives
	v.strictObject({ ...id, op: v.literal('box'), size: vec3Schema, center: v.optional(v.boolean()), ...placement }),
	v.strictObject({
		...id,
		op: v.literal('sphere'),
		r: numericSchema,
		segments: v.optional(segmentsSchema),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('cylinder'),
		r: numericSchema,
		h: numericSchema,
		/** Top radius; `0` makes a cone. Defaults to `r`. */
		r2: v.optional(numericSchema),
		segments: v.optional(segmentsSchema),
		center: v.optional(v.boolean()),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('torus'),
		/** Distance from the centre to the tube's centre line. */
		R: numericSchema,
		/** Tube radius. */
		r: numericSchema,
		segments: v.optional(segmentsSchema),
		sides: v.optional(segmentsSchema),
		...placement,
	}),
	// Profile solids
	v.strictObject({
		...id,
		op: v.literal('extrude'),
		profile: profileSchema,
		h: numericSchema,
		twist: v.optional(numericSchema),
		/** Scale of the top outline relative to the bottom: `0` makes a pyramid or cone. */
		scaleTop: v.optional(numericSchema),
		divisions: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(L.maxExtrudeDivisions))),
		center: v.optional(v.boolean()),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('revolve'),
		/** Outline in the XZ half-plane (x ≥ 0 is the radius), revolved about Z. */
		profile: profileSchema,
		angle: v.optional(numericSchema),
		segments: v.optional(segmentsSchema),
		...placement,
	}),
	// Solid modeling
	v.strictObject({ ...id, op: v.literal('union'), of: operandsSchema, ...placement }),
	v.strictObject({ ...id, op: v.literal('subtract'), from: nameSchema, remove: operandsSchema, ...placement }),
	v.strictObject({ ...id, op: v.literal('intersect'), of: operandsSchema, ...placement }),
	v.strictObject({ ...id, op: v.literal('hull'), of: operandsSchema, ...placement }),
	// Transformations
	v.strictObject({ ...id, op: v.literal('transform'), of: nameSchema, ...placement }),
	v.strictObject({
		...id,
		op: v.literal('mirror'),
		of: nameSchema,
		/** Normal of the mirror plane through the origin. */
		normal: vec3Schema,
		/** Keep the original too (a symmetric pair). Defaults to true. */
		keep: v.optional(v.boolean()),
		...placement,
	}),
	// Procedural
	v.strictObject({
		...id,
		op: v.literal('pattern.linear'),
		of: nameSchema,
		/** A whole number from 1 to `maxPatternCount`; may be an expression (`"$columns"`). */
		count: countSchema,
		step: vec3Schema,
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('pattern.radial'),
		of: nameSchema,
		/** A whole number from 1 to `maxPatternCount`; may be an expression (`"$columns"`). */
		count: countSchema,
		/** Total sweep in degrees; copies are spread over it (360 closes the circle). */
		angle: v.optional(numericSchema),
		axis: v.optional(axisSchema),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('heightfield'),
		/** Footprint, centred on the origin. */
		size: vec2Schema,
		/** Surface height as an expression in `x`, `y` (model units) and `$parameters`. */
		z: v.pipe(v.string(), v.minLength(1), v.maxLength(L.maxExpressionLength)),
		/** Solid depth below z = 0: the slab the surface sits on. */
		base: numericSchema,
		resolution: v.optional(resolutionSchema),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('blend'),
		/** `[x, y, z, r]` per sphere, smoothly merged into one organic surface. */
		spheres: v.pipe(
			v.array(v.tuple([numericSchema, numericSchema, numericSchema, numericSchema])),
			v.minLength(1),
			v.maxLength(L.maxBlendSpheres),
		),
		/** Blend radius: how far apart spheres still fuse. */
		k: numericSchema,
		resolution: v.optional(resolutionSchema),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('smooth'),
		of: nameSchema,
		/** Each triangle is split n × n, then moved onto a smooth surface through the original. */
		refine: refineSchema,
		/** Edges sharper than this stay sharp (degrees). Defaults to 60. */
		sharpAngle: v.optional(numericSchema),
		...placement,
	}),
	v.strictObject({
		...id,
		op: v.literal('deform'),
		of: nameSchema,
		/** twist: degrees over the height · taper: top scale · bend: degrees over the length. */
		kind: v.picklist(['twist', 'taper', 'bend']),
		amount: numericSchema,
		axis: v.optional(axisSchema),
		/** Subdivide first so the deformation has vertices to move. Defaults to none. */
		refine: v.optional(refineSchema),
		...placement,
	}),
]);
export type FeatureOperation = v.InferOutput<typeof modelOperationSchema>;
export type FeatureOperationKind = FeatureOperation['op'];

export const parametricModelSchema = v.strictObject({
	version: v.literal(PARAMETRIC_MODEL_VERSION),
	/** Shown to people only: never a key or a path. */
	name: v.optional(
		v.pipe(v.string(), v.minLength(1), v.maxLength(80), v.regex(/^\P{Cc}+$/u, 'must be printable text')),
	),
	units: v.picklist(MODEL_UNITS),
	parameters: v.optional(
		v.pipe(
			v.record(nameSchema, v.pipe(v.number(), v.finite())),
			v.check((record) => Object.keys(record).length <= L.maxParameters, `at most ${L.maxParameters} parameters`),
		),
	),
	operations: v.pipe(v.array(modelOperationSchema), v.minLength(1), v.maxLength(L.maxOperations)),
	/** The id that is the model, or several ids that become its named components. */
	output: v.union([nameSchema, v.pipe(v.array(nameSchema), v.minLength(1), v.maxLength(L.maxOutputs))]),
});
export type ParametricModel = v.InferOutput<typeof parametricModelSchema>;

/**
 * A modification of an explicitly supplied model — never of a model the server remembers,
 * because it remembers none. Applied in this order: parameter values, operation field edits,
 * removals, additions, a new output.
 */
export const modelPatchSchema = v.strictObject({
	parameters: v.optional(v.record(nameSchema, v.pipe(v.number(), v.finite()))),
	/** Field replacements per operation id (`{ "hole": { "r": 3 } }`); `id` and `op` cannot change. */
	operations: v.optional(v.record(nameSchema, v.record(v.string(), v.unknown()))),
	remove: v.optional(v.pipe(v.array(nameSchema), v.maxLength(L.maxOperations))),
	add: v.optional(v.pipe(v.array(v.unknown()), v.maxLength(L.maxOperations))),
	output: v.optional(v.union([nameSchema, v.array(nameSchema)])),
	name: v.optional(v.string()),
});
export type ModelPatch = v.InferOutput<typeof modelPatchSchema>;
