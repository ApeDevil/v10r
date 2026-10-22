import { expect, test } from 'vitest';
import type { ProductComposition, ProductDefinition, Vec3 } from '../schemas/product-composition';
import { CONDUIT_STUB, conduitPolyline } from './conduit';
import { frameFromAxisAngle } from './frame';
import { moveOccurrence } from './operations';
import { createPortStandardRegistry } from './standards';

const Y: Vec3 = [0, 1, 0];
/** A product with one port on top, facing up. */
const POST: ProductDefinition = {
	id: 'post',
	label: 'Post',
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [] },
		ports: [
			{
				id: 'top',
				label: 'Top',
				standard: 'test.any',
				direction: 'bidirectional',
				gender: 'neutral',
				frame: frameFromAxisAngle([0, 1, 0], [1, 0, 0], -Math.PI / 2),
			},
		],
	},
};
const at = (id: string, position: Vec3) => ({ id, definition: 'post', placement: frameFromAxisAngle(position, Y, 0) });
const composition: ProductComposition = {
	format: 1,
	id: 'posts',
	definitions: [POST],
	occurrences: [at('post-1', [0, 0, 0]), at('post-2', [2, 0, 0])],
	couplings: [
		{ id: 'link', a: { occurrence: 'post-1', port: 'top' }, b: { occurrence: 'post-2', port: 'top' }, mode: 'conduit' },
	],
	conduits: [
		{
			id: 'conduit-1',
			coupling: 'link',
			waypoints: [
				[0, 2, 0],
				[2, 2, 0],
			],
		},
	],
};

test('a path leaves each port along its axis, then runs through the stored waypoints', () => {
	expect(conduitPolyline(composition, 'link')).toEqual({
		points: [
			[0, 1, 0],
			[0, 1 + CONDUIT_STUB, 0],
			[0, 2, 0],
			[2, 2, 0],
			[2, 1 + CONDUIT_STUB, 0],
			[2, 1, 0],
		],
		length: 4,
		bends: 2,
	});
});

test('moving a product moves the path’s end with it — the ends are never stored', () => {
	const registry = createPortStandardRegistry([]);
	const moved = moveOccurrence(composition, registry, 'post-2', frameFromAxisAngle([2, 0, 3], Y, 0)).composition;
	const path = conduitPolyline(moved, 'link');
	expect(path?.points.at(-1)).toEqual([2, 1, 3]);
	expect(moved.conduits).toEqual(composition.conduits);
});
