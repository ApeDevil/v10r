/**
 * Heating fixture for `/showcases/3d/compose`: a boiler, a pump-and-valve subassembly, a
 * buffer tank, radiators and a room thermostat, coupled by fluid and control conduits.
 *
 * Domain content lives here, never in `$lib/product-composition`: the port standards below are
 * this fixture's vocabulary. Couplings check declared data only — nominal size, thread gender,
 * design flow direction. Nothing here sizes, rates or approves a heating installation.
 *
 * The starter leaves two ports open on purpose (radiator 2's return and the tank's secondary
 * return — the showcase's first coupling), plus a towel radiator of a smaller nominal size and
 * a spare tank outlet, so an incompatible pairing is one click away.
 */
import {
	composeFrames,
	frameFromAxisAngle,
	IDENTITY_FRAME,
	matedPlacement,
	type PortStandard,
	type ProductComposition,
	type ProductDefinition,
	type ProductPort,
	type Vec3,
} from '$lib/product-composition';

export const HEATING_STANDARDS: PortStandard[] = [
	{
		id: 'fluid.thread',
		family: 'fluid',
		label: 'Threaded pipe connection',
		genders: 'opposite',
		directions: 'complementary',
		clocking: 'free',
		matchParameters: ['dn'],
	},
	{
		id: 'control.bus',
		family: 'control',
		label: 'Two-wire control bus',
		genders: 'any',
		directions: 'complementary',
		clocking: 'fixed',
		matchParameters: ['protocol'],
	},
];

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
/** Port frames by the direction the port faces (its outward +Z). */
const facing = {
	up: (at: Vec3) => frameFromAxisAngle(at, X, -Math.PI / 2),
	down: (at: Vec3) => frameFromAxisAngle(at, X, Math.PI / 2),
	east: (at: Vec3) => frameFromAxisAngle(at, Y, Math.PI / 2),
	west: (at: Vec3) => frameFromAxisAngle(at, Y, -Math.PI / 2),
	back: (at: Vec3) => frameFromAxisAngle(at, Y, Math.PI),
};
const at = (position: Vec3) => ({ position, rotation: IDENTITY_FRAME.rotation });

const fluid = (
	id: string,
	label: string,
	direction: 'source' | 'sink',
	gender: 'male' | 'female',
	dn: number,
	frame: ProductPort['frame'],
): ProductPort => ({ id, label, standard: 'fluid.thread', direction, gender, frame, parameters: { dn } });

const bus = (frame: ProductPort['frame']): ProductPort => ({
	id: 'bus',
	label: 'Control bus',
	standard: 'control.bus',
	direction: 'bidirectional',
	gender: 'neutral',
	frame,
	parameters: { protocol: 'two-wire' },
});

const boiler: ProductDefinition = {
	id: 'gas-boiler',
	label: 'Wall-hung gas boiler',
	metadata: { heatOutputKw: 24 },
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				{ shape: 'box', size: [0.45, 0.7, 0.35], frame: IDENTITY_FRAME, tone: 'surface' },
				{ shape: 'box', size: [0.3, 0.08, 0.02], frame: at([0, 0.2, 0.18]), tone: 'primary' },
			],
		},
		ports: [
			fluid('flow-out', 'Flow out', 'source', 'male', 20, facing.down([-0.1, -0.35, 0])),
			fluid('return-in', 'Return in', 'sink', 'male', 20, facing.down([0.1, -0.35, 0])),
			bus(facing.east([0.225, 0.2, 0])),
		],
		passages: [['return-in', 'flow-out']],
	},
};

const pump: ProductDefinition = {
	id: 'circulation-pump',
	label: 'Circulation pump',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				{ shape: 'cylinder', radius: 0.035, length: 0.18, frame: IDENTITY_FRAME, tone: 'muted' },
				{ shape: 'cylinder', radius: 0.06, length: 0.08, frame: facing.east([0.05, 0, 0]), tone: 'accent' },
			],
		},
		ports: [
			fluid('in', 'In', 'sink', 'female', 20, facing.up([0, 0.09, 0])),
			fluid('out', 'Out', 'source', 'female', 20, facing.down([0, -0.09, 0])),
		],
		passages: [['in', 'out']],
	},
};

const valve: ProductDefinition = {
	id: 'zone-valve',
	label: 'Zone valve',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				{ shape: 'cylinder', radius: 0.03, length: 0.12, frame: IDENTITY_FRAME, tone: 'muted' },
				{ shape: 'sphere', radius: 0.045, frame: IDENTITY_FRAME, tone: 'primary' },
			],
		},
		ports: [
			fluid('in', 'In', 'sink', 'male', 20, facing.up([0, 0.06, 0])),
			fluid('out', 'Out', 'source', 'male', 20, facing.down([0, -0.06, 0])),
		],
		passages: [['in', 'out']],
	},
};

/** The pump's outlet threads straight onto the valve's inlet. */
const valveUnderPump = matedPlacement(
	composeFrames(IDENTITY_FRAME, facing.down([0, -0.09, 0])),
	facing.up([0, 0.06, 0]),
	IDENTITY_FRAME,
);

/** A subassembly: a definition made of other definitions, offering two of their ports outward. */
const hydraulicUnit: ProductDefinition = {
	id: 'hydraulic-unit',
	label: 'Hydraulic unit',
	body: {
		kind: 'composition',
		occurrences: [
			{ id: 'pump-1', definition: 'circulation-pump', placement: IDENTITY_FRAME },
			{ id: 'valve-1', definition: 'zone-valve', placement: valveUnderPump },
		],
		couplings: [
			{
				id: 'pump-valve',
				a: { occurrence: 'pump-1', port: 'out' },
				b: { occurrence: 'valve-1', port: 'in' },
				mode: 'mated',
			},
		],
		conduits: [],
		exposedPorts: [
			{ id: 'in', label: 'In', from: { occurrence: 'pump-1', port: 'in' } },
			{ id: 'out', label: 'Out', from: { occurrence: 'valve-1', port: 'out' } },
		],
	},
};

const tank: ProductDefinition = {
	id: 'buffer-tank',
	label: 'Buffer tank',
	metadata: { volumeLitres: 200 },
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [{ shape: 'cylinder', radius: 0.25, length: 1, frame: IDENTITY_FRAME, tone: 'surface' }],
		},
		ports: [
			fluid('primary-in', 'Primary in', 'sink', 'female', 20, facing.east([0.25, 0.3, 0])),
			fluid('primary-out', 'Primary out', 'source', 'female', 20, facing.east([0.25, -0.3, 0])),
			fluid('secondary-out', 'Secondary out', 'source', 'female', 20, facing.west([-0.25, 0.3, 0])),
			fluid('secondary-in', 'Secondary in', 'sink', 'female', 20, facing.west([-0.25, -0.3, 0])),
			fluid('spare-out', 'Spare out', 'source', 'female', 20, facing.up([0, 0.5, 0])),
		],
		passages: [
			['primary-in', 'secondary-out'],
			['secondary-in', 'primary-out'],
			['primary-in', 'spare-out'],
		],
	},
};

const radiator = (id: string, label: string, dn: number, size: Vec3): ProductDefinition => ({
	id,
	label,
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [{ shape: 'box', size, frame: IDENTITY_FRAME, tone: 'surface' }] },
		ports: [
			fluid('in', 'In', 'sink', 'female', dn, facing.east([size[0] / 2, size[1] / 2 - 0.05, 0])),
			fluid('out', 'Out', 'source', 'female', dn, facing.west([-size[0] / 2, -size[1] / 2 + 0.05, 0])),
		],
		passages: [['in', 'out']],
	},
});

const thermostat: ProductDefinition = {
	id: 'room-thermostat',
	label: 'Room thermostat',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [{ shape: 'box', size: [0.08, 0.12, 0.025], frame: IDENTITY_FRAME, tone: 'primary' }],
		},
		ports: [bus(facing.back([0, 0, -0.0125]))],
	},
};

/** No ports: a product can be part of a composition without connecting to anything. */
const bracket: ProductDefinition = {
	id: 'wall-bracket',
	label: 'Wall bracket',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [{ shape: 'box', size: [0.5, 0.04, 0.12], frame: IDENTITY_FRAME, tone: 'muted' }],
		},
		ports: [],
	},
};

export const HEATING_DEFINITIONS: ProductDefinition[] = [
	boiler,
	pump,
	valve,
	hydraulicUnit,
	tank,
	radiator('panel-radiator', 'Panel radiator', 20, [0.8, 0.5, 0.1]),
	radiator('towel-radiator', 'Towel radiator', 15, [0.5, 0.9, 0.05]),
	thermostat,
	bracket,
];

const BOILER = at([0, 1.5, 0]);
/** The hydraulic unit hangs from the boiler's flow outlet: its exposed inlet is the pump's. */
const UNIT = matedPlacement(
	composeFrames(BOILER, facing.down([-0.1, -0.35, 0])),
	facing.up([0, 0.09, 0]),
	IDENTITY_FRAME,
);

export const HEATING_COMPOSITION: ProductComposition = {
	format: 1,
	id: 'heating-starter',
	label: 'Boiler, buffer tank and two radiators',
	definitions: HEATING_DEFINITIONS,
	occurrences: [
		{ id: 'boiler-1', definition: 'gas-boiler', placement: BOILER },
		{ id: 'bracket-1', definition: 'wall-bracket', placement: at([0, 1.13, -0.2]) },
		{ id: 'hydraulic-unit-1', definition: 'hydraulic-unit', placement: UNIT },
		{ id: 'tank-1', definition: 'buffer-tank', placement: at([-1, 0.5, 0]) },
		{ id: 'radiator-1', definition: 'panel-radiator', placement: at([-2.1, 0.6, 0]) },
		{ id: 'radiator-2', definition: 'panel-radiator', placement: at([-3.1, 0.6, 0]) },
		{ id: 'towel-radiator-1', definition: 'towel-radiator', placement: at([-4.1, 0.9, 0]) },
		{ id: 'thermostat-1', definition: 'room-thermostat', placement: at([1, 1.5, 0.0125]) },
	],
	couplings: [
		{
			id: 'boiler-unit',
			a: { occurrence: 'boiler-1', port: 'flow-out' },
			b: { occurrence: 'hydraulic-unit-1', port: 'in' },
			mode: 'mated',
		},
		{
			id: 'primary-flow',
			a: { occurrence: 'hydraulic-unit-1', port: 'out' },
			b: { occurrence: 'tank-1', port: 'primary-in' },
			mode: 'conduit',
		},
		{
			id: 'primary-return',
			a: { occurrence: 'tank-1', port: 'primary-out' },
			b: { occurrence: 'boiler-1', port: 'return-in' },
			mode: 'conduit',
		},
		{
			id: 'secondary-flow',
			a: { occurrence: 'tank-1', port: 'secondary-out' },
			b: { occurrence: 'radiator-1', port: 'in' },
			mode: 'conduit',
		},
		{
			id: 'radiator-link',
			a: { occurrence: 'radiator-1', port: 'out' },
			b: { occurrence: 'radiator-2', port: 'in' },
			mode: 'conduit',
		},
		{
			id: 'control-link',
			a: { occurrence: 'boiler-1', port: 'bus' },
			b: { occurrence: 'thermostat-1', port: 'bus' },
			mode: 'conduit',
		},
	],
	conduits: [
		{ id: 'conduit-1', coupling: 'primary-flow', waypoints: [[-0.65, 0.75, 0]] },
		{ id: 'conduit-2', coupling: 'primary-return', waypoints: [[0.1, 0.2, 0]] },
		{
			id: 'conduit-3',
			coupling: 'control-link',
			waypoints: [
				[0.325, 1.7, -0.1],
				[1, 1.7, -0.1],
			],
		},
	],
};
