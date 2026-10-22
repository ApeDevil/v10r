import { describe, expect, test } from 'vitest';
import type { ProductComposition, ProductDefinition, ProductPort, Vec3 } from '../schemas/product-composition';
import { composeFrames, frameFromAxisAngle, framesMate, IDENTITY_FRAME } from './frame';
import { resolveComposition, resolvePort } from './resolve';

const Y: Vec3 = [0, 1, 0];
const port = (id: string, x: number, east: boolean): ProductPort => ({
	id,
	label: id,
	standard: 'test.keyed',
	direction: east ? 'source' : 'sink',
	gender: east ? 'male' : 'female',
	frame: frameFromAxisAngle([x, 0, 0], Y, east ? Math.PI / 2 : -Math.PI / 2),
});
const BLOCK: ProductDefinition = {
	id: 'block',
	label: 'Block',
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [] },
		ports: [port('east', 0.5, true), port('west', -0.5, false)],
	},
};
/** Two blocks mated in a row, offering the outer ends: a subassembly. */
const PAIR: ProductDefinition = {
	id: 'pair',
	label: 'Pair',
	body: {
		kind: 'composition',
		occurrences: [
			{ id: 'left', definition: 'block', placement: IDENTITY_FRAME },
			{ id: 'right', definition: 'block', placement: { position: [1, 0, 0], rotation: [0, 0, 0, 1] } },
		],
		couplings: [
			{ id: 'inner', a: { occurrence: 'left', port: 'east' }, b: { occurrence: 'right', port: 'west' }, mode: 'mated' },
		],
		conduits: [],
		exposedPorts: [
			{ id: 'in', from: { occurrence: 'left', port: 'west' } },
			{ id: 'out', from: { occurrence: 'right', port: 'east' } },
		],
	},
};
const placement = frameFromAxisAngle([5, 1, 0], Y, Math.PI / 2);
const composition: ProductComposition = {
	format: 1,
	id: 'nested',
	definitions: [BLOCK, PAIR],
	occurrences: [
		{ id: 'pair-1', definition: 'pair', placement },
		{ id: 'pair-2', definition: 'pair', placement: IDENTITY_FRAME },
		{ id: 'block-1', definition: 'block', placement: IDENTITY_FRAME },
	],
	couplings: [],
	conduits: [],
};

describe('resolvePort', () => {
	test('follows an exposed port down to its leaf, composing every placement on the way', () => {
		const out = resolvePort(composition, { occurrence: 'pair-1', port: 'out' });
		expect(out?.key).toBe('pair-1/right#east');
		const expected = composeFrames(
			placement,
			composeFrames({ position: [1, 0, 0], rotation: [0, 0, 0, 1] }, port('east', 0.5, true).frame),
		);
		expect(
			out && framesMate(out.frame, composeFrames(expected, frameFromAxisAngle([0, 0, 0], Y, Math.PI)), 'fixed'),
		).toBe(true);
	});

	test('an inner port that is not exposed is not reachable from outside', () => {
		expect(resolvePort(composition, { occurrence: 'pair-1', port: 'east' })).toBeUndefined();
	});
});

describe('resolveComposition', () => {
	const { occurrences, ports } = resolveComposition(composition);

	test('repeated occurrences of one definition flatten to distinct leaves, each knowing its top-level owner', () => {
		expect(occurrences.map((leaf) => [leaf.path, leaf.occurrence])).toEqual([
			['block-1', 'block-1'],
			['pair-1/left', 'pair-1'],
			['pair-1/right', 'pair-1'],
			['pair-2/left', 'pair-2'],
			['pair-2/right', 'pair-2'],
		]);
	});

	test('a leaf port carries its top-level address only when the top level can reach it', () => {
		const byKey = new Map(ports.map((leaf) => [leaf.key, leaf.ref]));
		expect(byKey.get('pair-1/left#west')).toEqual({ occurrence: 'pair-1', port: 'in' });
		expect(byKey.get('pair-1/left#east')).toBeUndefined();
		expect(byKey.get('block-1#east')).toEqual({ occurrence: 'block-1', port: 'east' });
	});

	test('a definition that contains itself is not entered, so flattening terminates', () => {
		const loop: ProductDefinition = {
			id: 'loop',
			label: 'Loop',
			body: {
				kind: 'composition',
				occurrences: [{ id: 'again', definition: 'loop', placement: IDENTITY_FRAME }],
				couplings: [],
				conduits: [],
				exposedPorts: [{ id: 'x', from: { occurrence: 'again', port: 'x' } }],
			},
		};
		const recursive = {
			...composition,
			definitions: [loop],
			occurrences: [{ id: 'loop-1', definition: 'loop', placement: IDENTITY_FRAME }],
		};
		expect(resolveComposition(recursive)).toEqual({ occurrences: [], ports: [] });
		expect(resolvePort(recursive, { occurrence: 'loop-1', port: 'x' })).toBeUndefined();
	});
});
