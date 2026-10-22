/**
 * Heating fixture for `/showcases/3d/compose`: a wall-hung boiler, a pump-and-valve subassembly,
 * a floor-standing buffer tank, panel radiators under the windows, a towel radiator and a room
 * thermostat, coupled by fluid and control conduits — set in a room, against its back wall.
 *
 * Domain content lives here, never in `$lib/product-composition`: the port standards below are
 * this fixture's vocabulary. Couplings check declared data only — nominal size, thread gender,
 * design flow direction. Nothing here sizes, rates or approves a heating installation.
 *
 * The starter leaves two ports open on purpose (radiator 2's return and the tank's secondary
 * return — the showcase's first coupling), plus a towel radiator of a smaller nominal size and
 * a spare tank outlet, so an incompatible pairing is one click away.
 *
 * The products are drawn from many small primitives, each with a physical `tone` and `finish`
 * (enamel casings, brushed copper stubs, chrome valve bodies, glass displays). Every one hangs
 * or stands where it would in a plant room: its back on the wall (`WALL`), or its feet on the
 * floor (y = 0). The room itself is `HEATING_ROOM` — scenery the page passes to the renderer,
 * not part of the document.
 */
import type { ConduitSurface, RoomLayout } from '$lib/components/3d/composition';
import {
	composeFrames,
	frameFromAxisAngle,
	IDENTITY_FRAME,
	matedPlacement,
	type PortStandard,
	type Primitive,
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
const Z: Vec3 = [0, 0, 1];
/** Port frames by the direction the port faces (its outward +Z). */
const facing = {
	up: (at: Vec3) => frameFromAxisAngle(at, X, -Math.PI / 2),
	down: (at: Vec3) => frameFromAxisAngle(at, X, Math.PI / 2),
	east: (at: Vec3) => frameFromAxisAngle(at, Y, Math.PI / 2),
	west: (at: Vec3) => frameFromAxisAngle(at, Y, -Math.PI / 2),
};
/** An unturned frame, on the document's 1e-9 grid. */
const at = (position: Vec3) => frameFromAxisAngle(position, Y, 0);
/** Cylinders run along +Y; these lay one along X or Z. A torus lies around +Z, `flat` around +Y. */
const along = {
	x: (position: Vec3) => frameFromAxisAngle(position, Z, Math.PI / 2),
	z: (position: Vec3) => frameFromAxisAngle(position, X, Math.PI / 2),
};
const flat = (position: Vec3) => frameFromAxisAngle(position, X, Math.PI / 2);

// ── Primitive builders: a tone (colour role) and a finish (surface role) on every part ─────────

type Look = { tone: string; finish?: string };
const ENAMEL: Look = { tone: 'enamel', finish: 'satin' };
const COPPER: Look = { tone: 'copper', finish: 'brushed' };
const BRASS: Look = { tone: 'brass', finish: 'brushed' };
const CHROME: Look = { tone: 'chrome', finish: 'metal' };
const STEEL: Look = { tone: 'steel', finish: 'brushed' };
const GLASS: Look = { tone: 'glass', finish: 'gloss' };
const RUBBER: Look = { tone: 'rubber', finish: 'matte' };
const PRIMARY: Look = { tone: 'primary', finish: 'gloss' };
const ACCENT: Look = { tone: 'accent', finish: 'satin' };

const box = (size: Vec3, frame: Primitive['frame'], look: Look, radius?: number): Primitive =>
	radius ? { shape: 'box', size, radius, frame, ...look } : { shape: 'box', size, frame, ...look };
const cylinder = (radius: number, length: number, frame: Primitive['frame'], look: Look): Primitive => ({
	shape: 'cylinder',
	radius,
	length,
	frame,
	...look,
});
const sphere = (radius: number, frame: Primitive['frame'], look: Look): Primitive => ({
	shape: 'sphere',
	radius,
	frame,
	...look,
});
const torus = (radius: number, tube: number, frame: Primitive['frame'], look: Look): Primitive => ({
	shape: 'torus',
	radius,
	tube,
	frame,
	...look,
});

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

/** The back wall's face (z) and the plane the plant-room pipes run in, in front of it (z). */
const WALL = -0.2;
const PIPE_PLANE = 0.07;

// ── Boiler ────────────────────────────────────────────────────────────────────────────────────

const BOILER_SIZE: Vec3 = [0.44, 0.72, 0.34];
/** The flow and return tails leave the boiler's underside, in the pipe plane. */
const BOILER_FLOW: Vec3 = [-0.1, -0.42, PIPE_PLANE];
const BOILER_RETURN: Vec3 = [0.1, -0.42, PIPE_PLANE];

const boiler: ProductDefinition = {
	id: 'gas-boiler',
	label: 'Wall-hung gas boiler',
	metadata: { heatOutputKw: 24 },
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				box(BOILER_SIZE, IDENTITY_FRAME, ENAMEL, 0.03),
				// Control fascia: display, two dials, a power light.
				box([0.4, 0.1, 0.02], at([0, -0.27, 0.165]), RUBBER, 0.008),
				box([0.11, 0.045, 0.006], at([-0.08, -0.265, 0.176]), GLASS),
				cylinder(0.016, 0.02, along.z([0.06, -0.265, 0.18]), CHROME),
				cylinder(0.016, 0.02, along.z([0.12, -0.265, 0.18]), CHROME),
				sphere(0.005, at([-0.17, -0.265, 0.176]), PRIMARY),
				box([0.16, 0.012, 0.004], at([0, 0.26, 0.171]), PRIMARY),
				// Air-intake louvres across the upper front.
				...[0.17, 0.15, 0.13, 0.11].map((y) => box([0.24, 0.006, 0.004], at([0, y, 0.17]), RUBBER)),
				// Concentric flue: up from the casing, an elbow, and back into the wall behind.
				cylinder(0.05, 0.14, at([0, 0.43, -0.03]), ENAMEL),
				sphere(0.05, at([0, 0.5, -0.03]), ENAMEL),
				cylinder(0.05, 0.18, along.z([0, 0.5, -0.12]), ENAMEL),
				cylinder(0.075, 0.012, along.z([0, 0.5, WALL + 0.006]), ENAMEL),
				// Tails: copper flow and return with brass unions, a gas cock between them.
				...[BOILER_FLOW, BOILER_RETURN].flatMap(([x, , z]) => [
					cylinder(0.011, 0.06, at([x, -0.39, z]), COPPER),
					cylinder(0.018, 0.022, at([x, -0.405, z]), BRASS),
				]),
				cylinder(0.011, 0.08, at([0, -0.4, PIPE_PLANE]), BRASS),
				box([0.05, 0.012, 0.012], at([0.025, -0.41, PIPE_PLANE]), PRIMARY),
			],
		},
		ports: [
			fluid('flow-out', 'Flow out', 'source', 'male', 20, facing.down(BOILER_FLOW)),
			fluid('return-in', 'Return in', 'sink', 'male', 20, facing.down(BOILER_RETURN)),
			bus(facing.east([BOILER_SIZE[0] / 2, 0.2, -0.1])),
		],
		passages: [['return-in', 'flow-out']],
	},
};

// ── Pump and zone valve, joined into the hydraulic unit ──────────────────────────────────────

const PUMP_PORT = 0.09;
const pump: ProductDefinition = {
	id: 'circulation-pump',
	label: 'Circulation pump',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				// Cast volute between two brass unions.
				cylinder(0.03, 0.12, IDENTITY_FRAME, STEEL),
				cylinder(0.02, 0.03, at([0, PUMP_PORT - 0.015, 0]), BRASS),
				cylinder(0.02, 0.03, at([0, -PUMP_PORT + 0.015, 0]), BRASS),
				// Wet-rotor motor toward the room, ribbed, with a terminal box and a lit control head.
				cylinder(0.05, 0.09, along.z([0, 0, 0.065]), ACCENT),
				...[0.04, 0.065, 0.09].map((z) => torus(0.05, 0.004, at([0, 0, z]), ACCENT)),
				box([0.05, 0.03, 0.05], at([0, 0.055, 0.07]), ACCENT, 0.006),
				cylinder(0.045, 0.02, along.z([0, 0, 0.12]), RUBBER),
				torus(0.03, 0.003, at([0, 0, 0.131]), PRIMARY),
				box([0.026, 0.012, 0.004], at([0, 0, 0.131]), GLASS),
			],
		},
		ports: [
			fluid('in', 'In', 'sink', 'female', 20, facing.up([0, PUMP_PORT, 0])),
			fluid('out', 'Out', 'source', 'female', 20, facing.down([0, -PUMP_PORT, 0])),
		],
		passages: [['in', 'out']],
	},
};

const VALVE_PORT = 0.06;
const valve: ProductDefinition = {
	id: 'zone-valve',
	label: 'Zone valve',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				cylinder(0.022, 0.08, IDENTITY_FRAME, BRASS),
				cylinder(0.019, 0.025, at([0, VALVE_PORT - 0.0125, 0]), BRASS),
				cylinder(0.019, 0.025, at([0, -VALVE_PORT + 0.0125, 0]), BRASS),
				// Spindle, actuator head, manual-override lever.
				cylinder(0.008, 0.035, along.z([0, 0, 0.03]), CHROME),
				box([0.07, 0.07, 0.06], at([0, 0, 0.075]), ENAMEL, 0.01),
				box([0.012, 0.04, 0.008], at([0.026, 0.012, 0.108]), PRIMARY, 0.003),
				box([0.03, 0.012, 0.003], at([-0.012, -0.02, 0.1055]), GLASS),
			],
		},
		ports: [
			fluid('in', 'In', 'sink', 'male', 20, facing.up([0, VALVE_PORT, 0])),
			fluid('out', 'Out', 'source', 'male', 20, facing.down([0, -VALVE_PORT, 0])),
		],
		passages: [['in', 'out']],
	},
};

/** The pump's outlet threads straight onto the valve's inlet. */
const valveUnderPump = matedPlacement(
	composeFrames(IDENTITY_FRAME, facing.down([0, -PUMP_PORT, 0])),
	facing.up([0, VALVE_PORT, 0]),
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

// ── Buffer tank ───────────────────────────────────────────────────────────────────────────────

const TANK_RADIUS = 0.24;
/** From the tank's middle to its floor: half the shell, the plinth and the feet. */
const TANK_HEIGHT = 0.62;
/** Side tappings stand out of the shell on short nipples; the ports are at their ends. */
const TAPPING = TANK_RADIUS + 0.05;
const tankFeet = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6].map((angle) =>
	cylinder(0.02, 0.09, at([0.16 * Math.cos(angle), -0.575, 0.16 * Math.sin(angle)]), STEEL),
);

const tank: ProductDefinition = {
	id: 'buffer-tank',
	label: 'Buffer tank',
	metadata: { volumeLitres: 200 },
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				// Insulated jacket, lid, plinth, chrome bands and three feet.
				cylinder(TANK_RADIUS, 1, IDENTITY_FRAME, ENAMEL),
				cylinder(TANK_RADIUS - 0.005, 0.03, at([0, 0.515, 0]), RUBBER),
				cylinder(TANK_RADIUS - 0.01, 0.03, at([0, -0.515, 0]), RUBBER),
				torus(TANK_RADIUS + 0.002, 0.006, flat([0, 0.35, 0]), CHROME),
				torus(TANK_RADIUS + 0.002, 0.006, flat([0, -0.35, 0]), CHROME),
				...tankFeet,
				// Dial thermometer and rating plate on the front.
				cylinder(0.035, 0.016, along.z([0, 0.15, TANK_RADIUS + 0.004]), CHROME),
				cylinder(0.03, 0.004, along.z([0, 0.15, TANK_RADIUS + 0.013]), { tone: 'enamel', finish: 'gloss' }),
				box([0.003, 0.024, 0.002], at([0.004, 0.156, TANK_RADIUS + 0.016]), ACCENT),
				box([0.09, 0.035, 0.003], at([0, -0.12, TANK_RADIUS + 0.001]), PRIMARY, 0.001),
				// Tapping nipples with brass unions, a capped top outlet and an air vent.
				...[0.3, -0.3].flatMap((y) =>
					[1, -1].flatMap((side) => [
						cylinder(0.012, 0.05, along.x([side * (TANK_RADIUS + 0.025), y, 0]), COPPER),
						cylinder(0.019, 0.02, along.x([side * (TAPPING - 0.01), y, 0]), BRASS),
					]),
				),
				cylinder(0.012, 0.05, at([0, 0.555, 0]), COPPER),
				cylinder(0.019, 0.02, at([0, 0.57, 0]), BRASS),
				cylinder(0.01, 0.035, at([0.12, 0.547, 0.05]), BRASS),
				sphere(0.012, at([0.12, 0.57, 0.05]), CHROME),
			],
		},
		ports: [
			fluid('primary-in', 'Primary in', 'sink', 'female', 20, facing.east([TAPPING, 0.3, 0])),
			fluid('primary-out', 'Primary out', 'source', 'female', 20, facing.east([TAPPING, -0.3, 0])),
			fluid('secondary-out', 'Secondary out', 'source', 'female', 20, facing.west([-TAPPING, 0.3, 0])),
			fluid('secondary-in', 'Secondary in', 'sink', 'female', 20, facing.west([-TAPPING, -0.3, 0])),
			fluid('spare-out', 'Spare out', 'source', 'female', 20, facing.up([0, 0.58, 0])),
		],
		passages: [
			['primary-in', 'secondary-out'],
			['secondary-in', 'primary-out'],
			['primary-in', 'spare-out'],
		],
	},
};

// ── Radiators ─────────────────────────────────────────────────────────────────────────────────

/** How far a radiator's back stands off the wall on its brackets. */
const RADIATOR_STANDOFF = 0.04;
/** A valve body's reach beyond the radiator's side, to the tail its port sits on. */
const VALVE_REACH = 0.07;

/**
 * A double-panel convector: pressed front channels, a top grille, wall brackets, a thermostatic
 * valve on the flow corner and a lockshield on the return.
 */
const panelRadiator = (id: string, label: string, dn: number, size: Vec3): ProductDefinition => {
	const [width, height, depth] = size;
	const [east, west] = [width / 2, -width / 2];
	const [top, bottom] = [height / 2 - 0.05, -height / 2 + 0.05];
	const channels = Math.round(width / 0.05);
	return {
		id,
		label,
		body: {
			kind: 'geometry',
			geometry: {
				source: 'primitives',
				primitives: [
					box(size, IDENTITY_FRAME, ENAMEL, 0.008),
					...Array.from({ length: channels }, (_, index) =>
						box(
							[0.022, height - 0.05, 0.004],
							at([west + (index + 0.5) * (width / channels), 0, depth / 2]),
							ENAMEL,
							0.0015,
						),
					),
					box([width - 0.03, 0.004, depth - 0.03], at([0, height / 2, 0]), RUBBER),
					...Array.from({ length: 24 }, (_, index) =>
						box(
							[0.004, 0.005, depth - 0.03],
							at([west + 0.02 + index * ((width - 0.04) / 23), height / 2 + 0.001, 0]),
							ENAMEL,
						),
					),
					// Brackets from the panel's back to the wall.
					...[west + 0.12, east - 0.12].flatMap((x) => [
						box([0.03, 0.06, RADIATOR_STANDOFF], at([x, height / 2 - 0.08, -depth / 2 - RADIATOR_STANDOFF / 2]), STEEL),
						box(
							[0.03, 0.04, RADIATOR_STANDOFF],
							at([x, -height / 2 + 0.06, -depth / 2 - RADIATOR_STANDOFF / 2]),
							STEEL,
						),
					]),
					// Thermostatic valve: chrome body, a white sensing head with its scale ring.
					cylinder(0.014, VALVE_REACH, along.x([east + VALVE_REACH / 2, top, 0]), CHROME),
					cylinder(0.018, 0.02, along.x([east + VALVE_REACH - 0.01, top, 0]), BRASS),
					cylinder(0.026, 0.07, at([east + 0.03, top + 0.05, 0]), ENAMEL),
					torus(0.0265, 0.003, flat([east + 0.03, top + 0.045, 0]), PRIMARY),
					cylinder(0.02, 0.006, at([east + 0.03, top + 0.088, 0]), CHROME),
					// Lockshield: a capped chrome body on the return.
					cylinder(0.014, VALVE_REACH, along.x([west - VALVE_REACH / 2, bottom, 0]), CHROME),
					cylinder(0.018, 0.02, along.x([west - VALVE_REACH + 0.01, bottom, 0]), BRASS),
					cylinder(0.014, 0.035, at([west - 0.03, bottom + 0.025, 0]), CHROME),
				],
			},
			ports: [
				fluid('in', 'In', 'sink', 'female', dn, facing.east([east + VALVE_REACH, top, 0])),
				fluid('out', 'Out', 'source', 'female', dn, facing.west([west - VALVE_REACH, bottom, 0])),
			],
			passages: [['in', 'out']],
		},
	};
};

/** A chrome ladder: two rails, round bars between them, stand-off brackets, valves below each rail. */
const towelRadiator = (id: string, label: string, dn: number, size: Vec3): ProductDefinition => {
	const [width, height, depth] = size;
	const rail = width / 2 - 0.025;
	const bars = 9;
	const valveBottom = -height / 2 - 0.05;
	return {
		id,
		label,
		body: {
			kind: 'geometry',
			geometry: {
				source: 'primitives',
				primitives: [
					...[rail, -rail].flatMap((x) => [
						cylinder(0.014, height, at([x, 0, 0]), CHROME),
						sphere(0.014, at([x, height / 2, 0]), CHROME),
						cylinder(0.011, 0.05, at([x, -height / 2 - 0.025, 0]), CHROME),
						...[height / 2 - 0.12, -height / 2 + 0.12].flatMap((y) => [
							cylinder(0.008, depth, along.z([x, y, -depth / 2]), CHROME),
							cylinder(0.018, 0.008, along.z([x, y, -depth + 0.004]), CHROME),
						]),
					]),
					...Array.from({ length: bars }, (_, index) =>
						cylinder(
							0.011,
							2 * rail,
							along.x([0, -height / 2 + 0.07 + (index * (height - 0.14)) / (bars - 1), 0]),
							CHROME,
						),
					),
				],
			},
			ports: [
				fluid('in', 'In', 'sink', 'female', dn, facing.down([rail, valveBottom, 0])),
				fluid('out', 'Out', 'source', 'female', dn, facing.down([-rail, valveBottom, 0])),
			],
			passages: [['in', 'out']],
		},
	};
};

// ── Controls and fixings ──────────────────────────────────────────────────────────────────────

const THERMOSTAT_DEPTH = 0.024;
const thermostat: ProductDefinition = {
	id: 'room-thermostat',
	label: 'Room thermostat',
	body: {
		kind: 'geometry',
		geometry: {
			source: 'primitives',
			primitives: [
				box([0.085, 0.12, THERMOSTAT_DEPTH], IDENTITY_FRAME, ENAMEL, 0.008),
				box([0.055, 0.032, 0.003], at([0, 0.028, 0.0115]), GLASS),
				cylinder(0.022, 0.008, along.z([0, -0.022, 0.014]), ENAMEL),
				torus(0.022, 0.0022, at([0, -0.022, 0.0182]), PRIMARY),
			],
		},
		// The cable enters from below, where it meets the surface-run wiring.
		ports: [bus(facing.down([0, -0.06, 0.003]))],
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
			primitives: [
				box([0.36, 0.05, 0.03], IDENTITY_FRAME, STEEL, 0.004),
				...[-0.14, 0, 0.14].map((x) => cylinder(0.007, 0.004, along.z([x, 0, 0.016]), CHROME)),
			],
		},
		ports: [],
	},
};

const PANEL: Vec3 = [0.8, 0.5, 0.1];
const TOWEL: Vec3 = [0.5, 0.9, 0.06];

export const HEATING_DEFINITIONS: ProductDefinition[] = [
	boiler,
	pump,
	valve,
	hydraulicUnit,
	tank,
	panelRadiator('panel-radiator', 'Panel radiator', 20, PANEL),
	towelRadiator('towel-radiator', 'Towel radiator', 15, TOWEL),
	thermostat,
	bracket,
];

// ── Placement: everything on the wall or the floor ────────────────────────────────────────────

const BOILER = at([0, 1.5, 0]);
/** The hydraulic unit hangs from the boiler's flow outlet: its exposed inlet is the pump's. */
const UNIT = matedPlacement(
	composeFrames(BOILER, facing.down(BOILER_FLOW)),
	facing.up([0, PUMP_PORT, 0]),
	IDENTITY_FRAME,
);
/** Panel radiators: 15 cm clear of the floor, on brackets off the wall. */
const PANEL_Y = 0.15 + PANEL[1] / 2;
const PANEL_Z = WALL + RADIATOR_STANDOFF + PANEL[2] / 2;
const RADIATOR_1_X = -2.1;
const RADIATOR_2_X = -3.4;

export const HEATING_COMPOSITION: ProductComposition = {
	format: 1,
	id: 'heating-starter',
	label: 'Boiler, buffer tank and two radiators',
	definitions: HEATING_DEFINITIONS,
	occurrences: [
		{ id: 'boiler-1', definition: 'gas-boiler', placement: BOILER },
		{ id: 'bracket-1', definition: 'wall-bracket', placement: at([0, 1.8, WALL + 0.015]) },
		{ id: 'hydraulic-unit-1', definition: 'hydraulic-unit', placement: UNIT },
		{ id: 'tank-1', definition: 'buffer-tank', placement: at([-1, TANK_HEIGHT, PIPE_PLANE]) },
		{ id: 'radiator-1', definition: 'panel-radiator', placement: at([RADIATOR_1_X, PANEL_Y, PANEL_Z]) },
		{ id: 'radiator-2', definition: 'panel-radiator', placement: at([RADIATOR_2_X, PANEL_Y, PANEL_Z]) },
		{ id: 'towel-radiator-1', definition: 'towel-radiator', placement: at([-4.55, 1.05, WALL + TOWEL[2]]) },
		{ id: 'thermostat-1', definition: 'room-thermostat', placement: at([1, 1.5, WALL + THERMOSTAT_DEPTH / 2]) },
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
	// Pipes run square in the pipe plane, then step back to the radiators' plane near the wall;
	// the thermostat cable runs on the wall's surface.
	conduits: [
		{
			id: 'conduit-1',
			coupling: 'primary-flow',
			waypoints: [
				[-0.35, 0.68, PIPE_PLANE],
				[-0.35, 0.92, PIPE_PLANE],
			],
		},
		{ id: 'conduit-2', coupling: 'primary-return', waypoints: [[0.1, 0.32, PIPE_PLANE]] },
		{
			id: 'conduit-3',
			coupling: 'control-link',
			waypoints: [
				[0.4, 1.7, -0.1],
				[0.4, 1.7, -0.185],
				[0.4, 1.25, -0.185],
				[1, 1.25, -0.185],
			],
		},
		{
			id: 'conduit-4',
			coupling: 'secondary-flow',
			waypoints: [
				[-1.46, 0.92, PIPE_PLANE],
				[-1.46, 0.92, PANEL_Z],
				[-1.46, 0.6, PANEL_Z],
			],
		},
		{
			id: 'conduit-5',
			coupling: 'radiator-link',
			waypoints: [
				[-2.75, 0.2, PANEL_Z],
				[-2.75, 0.6, PANEL_Z],
			],
		},
	],
};

/** The plant room: a tiled floor, a plastered back wall with two windows over the radiators, a corner at the west end. */
export const HEATING_ROOM: RoomLayout = {
	floor: 0,
	back: WALL,
	span: [-5.1, 1.6],
	depth: 4.5,
	height: 2.6,
	corner: 'west',
	windows: [
		{ x: RADIATOR_1_X, sill: 0.95, width: 0.9, height: 1.2 },
		{ x: RADIATOR_2_X, sill: 0.95, width: 0.9, height: 1.2 },
	],
};

/** Pipes are drawn copper and the bus a slim white cable; each keeps its family colour on its fittings. */
export const HEATING_CONDUIT_SURFACES: Record<string, ConduitSurface> = {
	fluid: { tone: 'copper', finish: 'brushed', radius: 0.011 },
	control: { tone: 'enamel', finish: 'matte', radius: 0.004 },
};
