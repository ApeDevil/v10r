import { expect, test } from 'vitest';
import type { ProductComposition, ProductDefinition, ProductPort, Vec3 } from '../schemas/product-composition';
import { frameFromAxisAngle, IDENTITY_FRAME } from './frame';
import { portNetworks } from './network';

const Y: Vec3 = [0, 1, 0];
const port = (id: string, x: number, east: boolean, standard = 'test.keyed'): ProductPort => ({
	id,
	label: id,
	standard,
	direction: east ? 'source' : 'sink',
	gender: east ? 'male' : 'female',
	frame: frameFromAxisAngle([x, 0, 0], Y, east ? Math.PI / 2 : -Math.PI / 2),
});
/** A through-part: its two ends are joined through its body. */
const THROUGH: ProductDefinition = {
	id: 'through',
	label: 'Through',
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [] },
		ports: [port('east', 0.5, true), port('west', -0.5, false), port('signal', 0, true, 'test.signal')],
		passages: [['west', 'east']],
	},
};
const UNIT: ProductDefinition = {
	id: 'unit',
	label: 'Unit',
	body: {
		kind: 'composition',
		occurrences: [
			{ id: 'first', definition: 'through', placement: IDENTITY_FRAME },
			{ id: 'second', definition: 'through', placement: { position: [1, 0, 0], rotation: [0, 0, 0, 1] } },
		],
		couplings: [
			{
				id: 'inside',
				a: { occurrence: 'first', port: 'east' },
				b: { occurrence: 'second', port: 'west' },
				mode: 'mated',
			},
		],
		conduits: [],
		exposedPorts: [
			{ id: 'in', from: { occurrence: 'first', port: 'west' } },
			{ id: 'out', from: { occurrence: 'second', port: 'east' } },
		],
	},
};
const at = (id: string, definition: string) => ({ id, definition, placement: IDENTITY_FRAME });
const ref = (occurrence: string, port: string) => ({ occurrence, port });

test('a network closes through passages and through a subassembly; its open ports are listed', () => {
	const composition: ProductComposition = {
		format: 1,
		id: 'loop',
		definitions: [THROUGH, UNIT],
		occurrences: [at('source-1', 'through'), at('unit-1', 'unit'), at('return-1', 'through')],
		couplings: [
			{ id: 'c-1', a: ref('source-1', 'east'), b: ref('unit-1', 'in'), mode: 'conduit' },
			{ id: 'c-2', a: ref('unit-1', 'out'), b: ref('return-1', 'west'), mode: 'conduit' },
			{ id: 'c-3', a: ref('return-1', 'signal'), b: ref('source-1', 'signal'), mode: 'conduit' },
		],
		conduits: [],
	};
	expect(portNetworks(composition)).toEqual([
		{
			id: 'return-1#east',
			ports: [
				'return-1#east',
				'return-1#west',
				'source-1#east',
				'source-1#west',
				'unit-1/first#east',
				'unit-1/first#west',
				'unit-1/second#east',
				'unit-1/second#west',
			],
			standards: ['test.keyed'],
			openPorts: ['return-1#east', 'source-1#west'],
		},
		{
			id: 'return-1#signal',
			ports: ['return-1#signal', 'source-1#signal'],
			standards: ['test.signal'],
			openPorts: [],
		},
	]);

	const closed = {
		...composition,
		couplings: [
			...composition.couplings,
			{ id: 'c-4', a: ref('return-1', 'east'), b: ref('source-1', 'west'), mode: 'conduit' as const },
		],
	};
	expect(portNetworks(closed)[0].openPorts).toEqual([]);
});
