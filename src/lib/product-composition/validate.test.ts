import { expect, test } from 'vitest';
import type { ProductComposition, ProductDefinition, ProductPort, Vec3 } from '../schemas/product-composition';
import { frameFromAxisAngle, IDENTITY_FRAME } from './frame';
import { createPortStandardRegistry } from './standards';
import { validateComposition } from './validate';

const registry = createPortStandardRegistry([
	{
		id: 'test.keyed',
		family: 'test',
		label: 'Keyed',
		genders: 'opposite',
		directions: 'complementary',
		clocking: 'fixed',
		matchParameters: [],
	},
]);
const Y: Vec3 = [0, 1, 0];
const port = (id: string, x: number, east: boolean, capacity?: number): ProductPort => ({
	id,
	label: id,
	standard: 'test.keyed',
	direction: east ? 'source' : 'sink',
	gender: east ? 'male' : 'female',
	frame: frameFromAxisAngle([x, 0, 0], Y, east ? Math.PI / 2 : -Math.PI / 2),
	...(capacity ? { capacity } : {}),
});
const BLOCK: ProductDefinition = {
	id: 'block',
	label: 'Block',
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [] },
		ports: [port('east', 0.5, true), port('west', -0.5, false), port('hub', 0, true, 2)],
		passages: [
			['east', 'nowhere'],
			['west', 'west'],
		],
	},
};
const BROKEN_PAIR: ProductDefinition = {
	id: 'broken-pair',
	label: 'Broken pair',
	body: {
		kind: 'composition',
		occurrences: [{ id: 'only', definition: 'block', placement: IDENTITY_FRAME }],
		couplings: [],
		conduits: [],
		exposedPorts: [
			{ id: 'a', from: { occurrence: 'only', port: 'east' } },
			{ id: 'b', from: { occurrence: 'only', port: 'east' } },
			{ id: 'c', from: { occurrence: 'ghost', port: 'east' } },
		],
	},
};
const LOOP: ProductDefinition = {
	id: 'loop',
	label: 'Loop',
	body: {
		kind: 'composition',
		occurrences: [{ id: 'again', definition: 'loop', placement: IDENTITY_FRAME }],
		couplings: [],
		conduits: [],
		exposedPorts: [],
	},
};
const at = (id: string, definition: string, x: number) => ({
	id,
	definition,
	placement: { position: [x, 0, 0] as Vec3, rotation: [0, 0, 0, 1] as [number, number, number, number] },
});
const ref = (occurrence: string, port: string) => ({ occurrence, port });

/** One of each finding the document check can raise. */
const broken: ProductComposition = {
	format: 1,
	id: 'broken',
	definitions: [BLOCK, BROKEN_PAIR, LOOP],
	occurrences: [at('b-1', 'block', 0), at('b-2', 'block', 3), at('b-3', 'block', 6), at('x-1', 'missing', 9)],
	couplings: [
		{ id: 'self', a: ref('b-1', 'east'), b: ref('b-1', 'west'), mode: 'conduit' },
		{ id: 'ghost', a: ref('b-1', 'east'), b: ref('nobody', 'west'), mode: 'conduit' },
		{ id: 'pipe', a: ref('b-1', 'east'), b: ref('b-2', 'west'), mode: 'conduit' },
		{ id: 'pipe-again', a: ref('b-2', 'west'), b: ref('b-1', 'east'), mode: 'conduit' },
		{ id: 'wrong-way', a: ref('b-2', 'east'), b: ref('b-3', 'east'), mode: 'mated' },
		{ id: 'hub-1', a: ref('b-3', 'hub'), b: ref('b-1', 'west'), mode: 'conduit' },
		{ id: 'hub-2', a: ref('b-3', 'hub'), b: ref('b-2', 'hub'), mode: 'conduit' },
	],
	conduits: [
		{ id: 'k-1', coupling: 'pipe', waypoints: [] },
		{ id: 'k-2', coupling: 'pipe', waypoints: [] },
		{ id: 'k-3', coupling: 'wrong-way', waypoints: [] },
		{ id: 'k-4', coupling: 'nothing', waypoints: [] },
	],
};

test('every finding is data with a stable code and subject, sorted by code then subject', () => {
	const found = validateComposition(broken, registry).map(({ code, subject }) => `${code} ${subject}`);
	expect(found).toEqual([
		'composition.recursive definitions/loop',
		'conduit.duplicate conduits/k-2',
		'conduit.mode conduits/k-3',
		'conduit.unresolved conduits/k-4',
		'coupling.duplicate couplings/pipe-again',
		'coupling.self couplings/self',
		'coupling.unresolved couplings/ghost',
		'definition.missing occurrences/x-1',
		'exposed-port.shared definitions/broken-pair/exposedPorts/b',
		'exposed-port.unresolved definitions/broken-pair/exposedPorts/c',
		'mate.misaligned couplings/wrong-way',
		'passage.self definitions/block/passages/1',
		'passage.unresolved definitions/block/passages/0',
		// Couplings that are themselves findings still use their ports.
		'port.capacity ports/b-1#east',
		'port.capacity ports/b-1#west',
		'port.capacity ports/b-2#west',
		'port.incompatible couplings/hub-2',
		'port.incompatible couplings/wrong-way',
		'port.open ports/b-1#hub',
		'port.open ports/b-3#west',
	]);
});

test('a port with capacity 2 holds two conduits; port.open is info, the rest are errors', () => {
	const found = validateComposition(broken, registry);
	expect(found.some((finding) => finding.subject === 'ports/b-3#hub')).toBe(false);
	expect(new Set(found.map((finding) => `${finding.code}:${finding.severity}`)).has('port.open:info')).toBe(true);
	expect(found.filter((finding) => finding.code !== 'port.open').every((finding) => finding.severity === 'error')).toBe(
		true,
	);
});
