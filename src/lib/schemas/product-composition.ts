/**
 * The persisted shape of a product composition — the contract `$lib/product-composition`
 * operates on and an exported `.json` file carries.
 *
 * Units and axes: metres, right-handed, +Y up (Three.js convention). A port's frame points
 * **outward along its local +Z**; its local +Y is the clocking reference. Rotations are unit
 * quaternions `[x, y, z, w]`. Two mated ports are face to face: one frame is the other turned
 * half a turn about its +Y (the SolidWorks-routing / Onshape mate-connector convention).
 *
 * IFC 4.3 maps with a conversion, not one to one: an `IfcDistributionPort` Axis points *out*
 * for SOURCE and *in* for SINK (so IFC Axis = our +Z for a source, −Z for a sink), rigidly
 * connected IFC ports carry *equal* frames where ours are opposed, and IFC RefDirection is the
 * profile's X, not our +Y clocking reference.
 *
 * Objects are strict: an unknown key is refused, not dropped, so a file written by a newer
 * format never loads as a silently truncated one.
 */
import * as v from 'valibot';

/** The persisted shape number. Not `version` (an optimistic-concurrency counter) nor `revision` (a stored snapshot). */
export const COMPOSITION_FORMAT = 1;

/** Stable, human-readable ids: `boiler-1`, `flow-out`. */
const idSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case id'));
/** Port standard ids may be dotted by family: `fluid.thread`, `mechanical.peg`. */
const standardIdSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'must be a dotted id'));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(v.number(), v.finite(), v.gtValue(0));

export const vec3Schema = v.tuple([finite, finite, finite]);
export type Vec3 = v.InferOutput<typeof vec3Schema>;

export const quatSchema = v.pipe(
	v.tuple([finite, finite, finite, finite]),
	v.check(([x, y, z, w]) => Math.abs(Math.hypot(x, y, z, w) - 1) < 1e-6, 'must be a unit quaternion'),
);
export type Quat = v.InferOutput<typeof quatSchema>;

/** A rigid placement: where something sits and which way it faces, relative to its parent. */
export const frameSchema = v.strictObject({ position: vec3Schema, rotation: quatSchema });
export type Frame = v.InferOutput<typeof frameSchema>;

/** One endpoint of a coupling: a port on an occurrence. */
export const portRefSchema = v.strictObject({ occurrence: idSchema, port: idSchema });
export type PortRef = v.InferOutput<typeof portRefSchema>;

/**
 * An interface kind a port speaks, and the rules two ports of it must satisfy to couple.
 * Domain content (threads, buses, pegs) lives in the caller's registry, never in the core.
 * Two different standards never couple: an adapter is a product with one port of each.
 */
export const portStandardSchema = v.strictObject({
	id: standardIdSchema,
	/** Grouping for rendering and networks (`fluid`, `control`, `mechanical`). */
	family: idSchema,
	label: v.string(),
	/** `opposite`: male↔female, neutral↔neutral. `any`: no gender rule. */
	genders: v.picklist(['opposite', 'any']),
	/** `complementary`: a source meets a sink (bidirectional meets anything). `any`: no direction rule. */
	directions: v.picklist(['complementary', 'any']),
	/** `fixed`: a mate must also align the ports' +Y. `free`: any turn about the port axis holds (threads, pegs). */
	clocking: v.picklist(['fixed', 'free']),
	/**
	 * Port parameters that must be equal on both sides (`dn`, `thread`, a keying clock position).
	 * Equality only, on purpose: ratings stay informational — a range check is engineering.
	 */
	matchParameters: v.array(v.string()),
});
export type PortStandard = v.InferOutput<typeof portStandardSchema>;

export const PORT_DIRECTIONS = ['source', 'sink', 'bidirectional'] as const;
export const PORT_GENDERS = ['male', 'female', 'neutral'] as const;

/**
 * A typed attachment point on a product, placed in the product's local space. `direction` is
 * the nominal design direction — actual flow is never computed. `neutral` is genderless
 * (a flange, a hermaphroditic connector).
 */
export const productPortSchema = v.strictObject({
	id: idSchema,
	label: v.string(),
	standard: standardIdSchema,
	direction: v.picklist(PORT_DIRECTIONS),
	gender: v.picklist(PORT_GENDERS),
	frame: frameSchema,
	/** How many couplings the port accepts; 1 when absent. */
	capacity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	parameters: v.optional(v.record(v.string(), v.union([v.string(), finite]))),
});
export type ProductPort = v.InferOutput<typeof productPortSchema>;

/** A colour role, resolved to a CSS token by the renderer — never a colour value. */
const toneSchema = idSchema;

/** A parametric solid in the product's local space. Cylinders run along their local +Y. */
export const primitiveSchema = v.variant('shape', [
	v.strictObject({
		shape: v.literal('box'),
		size: v.tuple([positive, positive, positive]),
		frame: frameSchema,
		tone: toneSchema,
	}),
	v.strictObject({
		shape: v.literal('cylinder'),
		radius: positive,
		length: positive,
		frame: frameSchema,
		tone: toneSchema,
	}),
	v.strictObject({ shape: v.literal('sphere'), radius: positive, frame: frameSchema, tone: toneSchema }),
]);
export type Primitive = v.InferOutput<typeof primitiveSchema>;

/** Where a product's look comes from: parametric solids, or a model in the `$lib/3d` catalogue. */
export const productGeometrySchema = v.variant('source', [
	v.strictObject({ source: v.literal('primitives'), primitives: v.array(primitiveSchema) }),
	v.strictObject({ source: v.literal('model'), modelId: idSchema, scale: v.optional(positive) }),
]);
export type ProductGeometry = v.InferOutput<typeof productGeometrySchema>;

/** One placed use of a definition. Two occurrences of one definition differ only in id and placement. */
export const productOccurrenceSchema = v.strictObject({
	id: idSchema,
	definition: idSchema,
	placement: frameSchema,
	label: v.optional(v.string()),
});
export type ProductOccurrence = v.InferOutput<typeof productOccurrenceSchema>;

/**
 * A logical edge between two ports on two different occurrences; `a` and `b` are unordered.
 * `mated`: the port frames coincide face to face. `conduit`: a pipe or cable realises it —
 * see `Conduit`. On a composed occurrence, `PortRef.port` names one of its `exposedPorts`.
 */
export const couplingSchema = v.strictObject({
	id: idSchema,
	a: portRefSchema,
	b: portRefSchema,
	mode: v.picklist(['mated', 'conduit']),
});
export type Coupling = v.InferOutput<typeof couplingSchema>;

/**
 * The physical path that realises a `conduit` coupling. Only interior waypoints are stored:
 * the ends are always derived from the live port frames, so a moved product never leaves a
 * detached pipe.
 */
export const conduitSchema = v.strictObject({
	id: idSchema,
	coupling: idSchema,
	waypoints: v.array(vec3Schema),
});
export type Conduit = v.InferOutput<typeof conduitSchema>;

const arrangementEntries = {
	occurrences: v.array(productOccurrenceSchema),
	couplings: v.array(couplingSchema),
	conduits: v.array(conduitSchema),
};

/** A port of an inner occurrence that a composed product offers to the outside. */
export const exposedPortSchema = v.strictObject({ id: idSchema, label: v.optional(v.string()), from: portRefSchema });
export type ExposedPort = v.InferOutput<typeof exposedPortSchema>;

/** What a product is made of: its own geometry and ports, or an arrangement of other products. */
export const productBodySchema = v.variant('kind', [
	v.strictObject({
		kind: v.literal('geometry'),
		geometry: productGeometrySchema,
		ports: v.array(productPortSchema),
		/** Port pairs joined through the product's body (a pump's inlet and outlet). */
		passages: v.optional(v.array(v.tuple([idSchema, idSchema]))),
	}),
	v.strictObject({
		kind: v.literal('composition'),
		...arrangementEntries,
		exposedPorts: v.array(exposedPortSchema),
	}),
]);
export type ProductBody = v.InferOutput<typeof productBodySchema>;

/** A reusable catalogue entry. A product with no ports is valid; so is one built from others. */
export const productDefinitionSchema = v.strictObject({
	id: idSchema,
	label: v.string(),
	body: productBodySchema,
	metadata: v.optional(v.record(v.string(), v.union([v.string(), finite]))),
});
export type ProductDefinition = v.InferOutput<typeof productDefinitionSchema>;

/**
 * The editable document. Definitions travel inside it, so an exported file is self-contained;
 * the port standards do not — they are the caller's domain vocabulary.
 */
export const productCompositionSchema = v.strictObject({
	format: v.literal(COMPOSITION_FORMAT),
	id: idSchema,
	label: v.optional(v.string()),
	definitions: v.array(productDefinitionSchema),
	...arrangementEntries,
});
export type ProductComposition = v.InferOutput<typeof productCompositionSchema>;

/** The occurrences, couplings and conduits of one level — the document's top, or a composed product's body. */
export type Arrangement = Pick<ProductComposition, 'occurrences' | 'couplings' | 'conduits'>;
