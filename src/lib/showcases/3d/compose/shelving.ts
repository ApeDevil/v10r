/**
 * Shelving fixture for `/showcases/3d/compose`: the proof that the composition engine is not
 * a heating engine. Two uprights and two shelves peg together into a closed ring of mates,
 * beside a lamp and two sofas that connect to nothing — one of them a glTF model, placed
 * twice. It uses the same core as the heating fixture with no change to it.
 */
import type { RoomLayout } from '#lib/components/3d/composition/index.ts';
import {
	frameFromAxisAngle,
	IDENTITY_FRAME,
	type PortStandard,
	type ProductComposition,
	type ProductDefinition,
	type ProductPort,
	type Vec3,
} from '#lib/product-composition/index.ts';

export const SHELVING_STANDARDS: PortStandard[] = [
	{
		id: 'mechanical.peg',
		family: 'mechanical',
		label: 'Shelf peg, 5 mm',
		genders: 'any',
		directions: 'any',
		clocking: 'free',
		matchParameters: ['diameter'],
	},
];

const Y: Vec3 = [0, 1, 0];
const at = (position: Vec3) => ({ position, rotation: IDENTITY_FRAME.rotation });

const peg = (id: string, label: string, position: Vec3, side: 'east' | 'west'): ProductPort => ({
	id,
	label,
	standard: 'mechanical.peg',
	direction: 'bidirectional',
	gender: 'neutral',
	frame: frameFromAxisAngle(position, Y, side === 'east' ? Math.PI / 2 : -Math.PI / 2),
	parameters: { diameter: 5 },
});

const UPRIGHT_HALF_WIDTH = 0.015;
const SHELF_HALF_LENGTH = 0.4;

const upright: ProductDefinition = {
	id: 'upright',
	label: 'Upright',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [{ shape: 'box', size: [0.03, 1.8, 0.3], frame: IDENTITY_FRAME, tone: 'muted' }],
		},
		ports: [
			peg('low-east', 'Low, east face', [UPRIGHT_HALF_WIDTH, -0.5, 0], 'east'),
			peg('high-east', 'High, east face', [UPRIGHT_HALF_WIDTH, 0.3, 0], 'east'),
			peg('low-west', 'Low, west face', [-UPRIGHT_HALF_WIDTH, -0.5, 0], 'west'),
			peg('high-west', 'High, west face', [-UPRIGHT_HALF_WIDTH, 0.3, 0], 'west'),
		],
	},
};

const shelf: ProductDefinition = {
	id: 'shelf',
	label: 'Shelf',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [{ shape: 'box', size: [0.8, 0.02, 0.28], frame: IDENTITY_FRAME, tone: 'surface' }],
		},
		ports: [
			peg('west', 'West end', [-SHELF_HALF_LENGTH, 0, 0], 'west'),
			peg('east', 'East end', [SHELF_HALF_LENGTH, 0, 0], 'east'),
		],
	},
};

const lamp: ProductDefinition = {
	id: 'floor-lamp',
	label: 'Floor lamp',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				{ shape: 'cylinder', radius: 0.015, length: 1.5, frame: IDENTITY_FRAME, tone: 'muted' },
				{ shape: 'sphere', radius: 0.12, frame: at([0, 0.8, 0]), tone: 'accent' },
			],
		},
		ports: [],
	},
};

/** A catalogue model from `#lib/3d/models.ts`, not parametric primitives. */
const sofa: ProductDefinition = {
	id: 'velvet-sofa',
	label: 'Velvet sofa',
	body: { kind: 'geometry', geometry: { source: 'model', modelId: 'glam-velvet-sofa' }, ports: [] },
};

export const SHELVING_DEFINITIONS: ProductDefinition[] = [upright, shelf, lamp, sofa];

const LEFT = 0;
const RIGHT = LEFT + 2 * UPRIGHT_HALF_WIDTH + 2 * SHELF_HALF_LENGTH;
const SHELF_X = LEFT + UPRIGHT_HALF_WIDTH + SHELF_HALF_LENGTH;
const mate = (id: string, a: [string, string], b: [string, string]) => ({
	id,
	a: { occurrence: a[0], port: a[1] },
	b: { occurrence: b[0], port: b[1] },
	mode: 'mated' as const,
});

export const SHELVING_COMPOSITION: ProductComposition = {
	format: 1,
	id: 'shelving-starter',
	label: 'Pegged shelving beside a sofa',
	definitions: SHELVING_DEFINITIONS,
	occurrences: [
		{ id: 'upright-1', definition: 'upright', placement: at([LEFT, 0.9, 0]) },
		{ id: 'upright-2', definition: 'upright', placement: at([RIGHT, 0.9, 0]) },
		{ id: 'shelf-1', definition: 'shelf', placement: at([SHELF_X, 0.4, 0]) },
		{ id: 'shelf-2', definition: 'shelf', placement: at([SHELF_X, 1.2, 0]) },
		{ id: 'lamp-1', definition: 'floor-lamp', placement: at([1.3, 0.75, 0]) },
		{ id: 'sofa-1', definition: 'velvet-sofa', placement: at([2.8, 0, 0.3]) },
		{ id: 'sofa-2', definition: 'velvet-sofa', placement: frameFromAxisAngle([5.3, 0, 0.6], Y, -Math.PI / 8) },
	],
	// Four mates close one ring: upright-1 → shelf-1 → upright-2 → shelf-2 → upright-1.
	couplings: [
		mate('low-left', ['upright-1', 'low-east'], ['shelf-1', 'west']),
		mate('low-right', ['shelf-1', 'east'], ['upright-2', 'low-west']),
		mate('high-right', ['upright-2', 'high-west'], ['shelf-2', 'east']),
		mate('high-left', ['shelf-2', 'west'], ['upright-1', 'high-east']),
	],
	conduits: [],
};

/** A floor to stand on, without walls: the sofas stand out in the room, not against a wall. */
export const SHELVING_ROOM: RoomLayout = { floor: 0, back: -0.6, span: [-1.2, 6.8], depth: 3.4 };
