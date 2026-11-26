/**
 * The modeling vocabulary as text: one line per operation, in the compact signature form an
 * agent reads once (`describe_modeling`) and a person reads in the docs. Kept beside the schema
 * it describes; `vocabulary.test.ts` pins that every schema operation has exactly one line here.
 */
import type { FeatureOperationKind } from '#lib/schemas/parametric-model.ts';

export interface OperationEntry {
	op: FeatureOperationKind;
	category: 'primitive' | 'profile' | 'solid' | 'transform' | 'procedural';
	/** Fields beyond `id`, `op` and the placement fields; `?` marks optional. */
	fields: string;
	summary: string;
}

export const MODELING_VOCABULARY: readonly OperationEntry[] = [
	{
		op: 'box',
		category: 'primitive',
		fields: 'size:[x,y,z] center?',
		summary: 'Rectangular block, centred unless center:false.',
	},
	{ op: 'sphere', category: 'primitive', fields: 'r segments?', summary: 'Geodesic sphere.' },
	{
		op: 'cylinder',
		category: 'primitive',
		fields: 'r h r2? segments? center?',
		summary: 'Along Z; r2 is the top radius (r2:0 = cone).',
	},
	{
		op: 'torus',
		category: 'primitive',
		fields: 'R r segments? sides?',
		summary: 'Ring about Z: R to the tube centre, r the tube.',
	},
	{
		op: 'extrude',
		category: 'profile',
		fields: 'profile h twist? scaleTop? divisions? center?',
		summary: 'Profile in XY swept up Z; twist in degrees, scaleTop 0 = pyramid.',
	},
	{
		op: 'revolve',
		category: 'profile',
		fields: 'profile angle? segments?',
		summary: 'Profile (x = radius ≥ 0, y = height) turned about Z.',
	},
	{ op: 'union', category: 'solid', fields: 'of:[ids]', summary: 'Boolean union.' },
	{
		op: 'subtract',
		category: 'solid',
		fields: 'from:id remove:[ids]',
		summary: 'Boolean difference: from minus every id in remove.',
	},
	{ op: 'intersect', category: 'solid', fields: 'of:[ids]', summary: 'Boolean intersection.' },
	{
		op: 'hull',
		category: 'solid',
		fields: 'of:[ids]',
		summary: 'Convex hull of the solids (gussets, rounded blends between parts).',
	},
	{ op: 'transform', category: 'transform', fields: 'of:id', summary: 'A placed copy (use at / rotate / scale).' },
	{
		op: 'mirror',
		category: 'transform',
		fields: 'of:id normal:[x,y,z] keep?',
		summary: 'Mirror across the plane through the origin; keeps the original unless keep:false.',
	},
	{
		op: 'pattern.linear',
		category: 'procedural',
		fields: 'of:id count step:[x,y,z]',
		summary: 'count copies, each step further, unioned.',
	},
	{
		op: 'pattern.radial',
		category: 'procedural',
		fields: 'of:id count angle? axis?',
		summary: 'count copies rotated about an axis (default z, 360°).',
	},
	{
		op: 'heightfield',
		category: 'procedural',
		fields: 'size:[x,y] z:"expr(x,y)" base resolution?',
		summary: 'Solid slab whose top is z(x, y); base is its depth below z = 0.',
	},
	{
		op: 'blend',
		category: 'procedural',
		fields: 'spheres:[[x,y,z,r],…] k resolution?',
		summary: 'Spheres smoothly fused into one organic surface; k is the blend radius.',
	},
	{
		op: 'smooth',
		category: 'procedural',
		fields: 'of:id refine sharpAngle?',
		summary: 'Subdivide (refine 2–4) and round the surface; edges sharper than sharpAngle stay.',
	},
	{
		op: 'deform',
		category: 'procedural',
		fields: 'of:id kind:twist|taper|bend amount axis? refine?',
		summary: 'Twist (degrees), taper (top scale) or bend (degrees) along an axis.',
	},
];

export const PROFILE_SHAPES =
	'{shape:"rect", size:[w,h], round?, center?} · {shape:"circle", r, segments?} · {shape:"polygon", points:[[x,y],…]}';

export const PLACEMENT_FIELDS =
	'at:[x,y,z] (translate) · rotate:[x,y,z] (degrees, X then Y then Z) · scale:n|[x,y,z] · material';

export const EXPRESSION_SYNTAX =
	'A number may be an expression string: + - * / ( ), $parameter, pi, abs sqrt sin cos tan floor round (radians), min max pow; x and y inside heightfield z only.';

/** What the vocabulary deliberately does not do, stated so an agent does not try. */
export const UNSUPPORTED_OPERATIONS = [
	'fillet and chamfer (no boundary-representation kernel; round 2D profiles with rect round, or smooth a solid)',
	'shell / offset of a solid (subtract a smaller copy instead)',
	'sweep along a path and loft between profiles',
	'text, imported meshes, images, external files',
	'STEP or other exact CAD exchange (meshes only: GLB, STL)',
	'constraints and a solver (dimensions are parameters and expressions)',
];
