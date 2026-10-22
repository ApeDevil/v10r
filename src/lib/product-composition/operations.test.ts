import { describe, expect, test } from 'vitest';
import type { ProductComposition, ProductDefinition, Vec3 } from '../schemas/product-composition';
import { frameFromAxisAngle, framesMate } from './frame';
import {
	addOccurrence,
	connect,
	insertWaypoint,
	moveOccurrence,
	removeOccurrence,
	removeWaypoint,
	rotateOccurrence,
	setConduitWaypoints,
} from './operations';
import { resolvePort } from './resolve';
import { createPortStandardRegistry } from './standards';
import { validateComposition } from './validate';

/** Abstract parts: a unit cube with a male source on its east face and a female sink on its west face. */
const registry = createPortStandardRegistry([
	{
		id: 'test.keyed',
		family: 'test',
		label: 'Keyed',
		genders: 'opposite',
		directions: 'complementary',
		clocking: 'fixed',
		matchParameters: ['size'],
	},
]);
const Y: Vec3 = [0, 1, 0];
const BLOCK: ProductDefinition = {
	id: 'block',
	label: 'Block',
	body: {
		kind: 'geometry',
		geometry: { source: 'primitives', primitives: [] },
		ports: [
			{
				id: 'east',
				label: 'East',
				standard: 'test.keyed',
				direction: 'source',
				gender: 'male',
				frame: frameFromAxisAngle([0.5, 0, 0], Y, Math.PI / 2),
				parameters: { size: 1 },
			},
			{
				id: 'west',
				label: 'West',
				standard: 'test.keyed',
				direction: 'sink',
				gender: 'female',
				frame: frameFromAxisAngle([-0.5, 0, 0], Y, -Math.PI / 2),
				parameters: { size: 1 },
			},
		],
	},
};

const blocks = (...positions: Vec3[]): ProductComposition => ({
	format: 1,
	id: 'test',
	definitions: [BLOCK],
	occurrences: positions.map((position, index) => ({
		id: `block-${index + 1}`,
		definition: 'block',
		placement: { position, rotation: [0, 0, 0, 1] },
	})),
	couplings: [],
	conduits: [],
});
const ref = (occurrence: string, port: string) => ({ occurrence, port });
const codes = (result: { diagnostics: { code: string }[] }) => result.diagnostics.map((found) => found.code);
const placementOf = (composition: ProductComposition, id: string) =>
	composition.occurrences.find((occurrence) => occurrence.id === id)?.placement;

describe('connect', () => {
	const start = blocks([0, 0, 0], [3, 0, 0], [6, 0, 0]);

	test('refuses what validation would report, and leaves the document untouched', () => {
		const self = connect(start, registry, { a: ref('block-1', 'east'), b: ref('block-1', 'west'), mode: 'conduit' });
		const unresolved = connect(start, registry, {
			a: ref('block-1', 'up'),
			b: ref('block-2', 'west'),
			mode: 'conduit',
		});
		const sameKind = connect(start, registry, { a: ref('block-1', 'east'), b: ref('block-2', 'east'), mode: 'mated' });
		expect(codes(self)).toEqual(['coupling.self']);
		expect(codes(unresolved)).toEqual(['coupling.unresolved']);
		expect(codes(sameKind)).toEqual(['port.incompatible']);
		expect(sameKind.diagnostics[0].mismatches?.map((mismatch) => mismatch.code)).toEqual([
			'gender.mismatch',
			'direction.mismatch',
		]);
		expect(sameKind.composition).toBe(start);
	});

	test('a pair is joined once; a port holds `capacity` conduits, and a mate holds it alone', () => {
		const once = connect(start, registry, { a: ref('block-1', 'east'), b: ref('block-2', 'west'), mode: 'conduit' });
		const twice = connect(once.composition, registry, {
			a: ref('block-2', 'west'),
			b: ref('block-1', 'east'),
			mode: 'conduit',
		});
		const full = connect(once.composition, registry, {
			a: ref('block-1', 'east'),
			b: ref('block-3', 'west'),
			mode: 'conduit',
		});
		expect(codes(once)).toEqual([]);
		expect(codes(twice)).toEqual(['coupling.duplicate']);
		expect(full.diagnostics).toMatchObject([{ code: 'port.capacity', subject: 'ports/block-1#east' }]);
	});

	test('a new mate snaps the other side’s whole cluster face to face', () => {
		const paired = connect(start, registry, { a: ref('block-2', 'east'), b: ref('block-3', 'west'), mode: 'mated' });
		expect(placementOf(paired.composition, 'block-3')?.position).toEqual([4, 0, 0]);

		const joined = connect(paired.composition, registry, {
			a: ref('block-1', 'east'),
			b: ref('block-2', 'west'),
			mode: 'mated',
		});
		expect(placementOf(joined.composition, 'block-2')?.position).toEqual([1, 0, 0]);
		expect(placementOf(joined.composition, 'block-3')?.position).toEqual([2, 0, 0]);
		expect(validateComposition(joined.composition, registry).filter((found) => found.severity === 'error')).toEqual([]);
	});
});

describe('moving a mated cluster', () => {
	const chain = [
		{ id: 'm-1', a: ref('block-1', 'east'), b: ref('block-2', 'west'), mode: 'mated' as const },
		{ id: 'm-2', a: ref('block-2', 'east'), b: ref('block-3', 'west'), mode: 'mated' as const },
	];
	const start: ProductComposition = { ...blocks([0, 0, 0], [1, 0, 0], [2, 0, 0]), couplings: chain };

	test('moves and turns everything mated to the moved occurrence, rigidly', () => {
		const moved = moveOccurrence(start, registry, 'block-2', { position: [1, 5, 0], rotation: [0, 0, 0, 1] });
		expect(placementOf(moved.composition, 'block-1')?.position).toEqual([0, 5, 0]);
		expect(placementOf(moved.composition, 'block-3')?.position).toEqual([2, 5, 0]);

		const turned = rotateOccurrence(start, registry, 'block-1', Y, Math.PI / 2);
		const a = resolvePort(turned.composition, ref('block-2', 'east'));
		const b = resolvePort(turned.composition, ref('block-3', 'west'));
		expect(a && b && framesMate(a.frame, b.frame, 'fixed')).toBe(true);
	});

	test('two hundred awkward moves accumulate no drift', () => {
		let current = start;
		for (let step = 0; step < 200; step++) {
			const placement = frameFromAxisAngle([Math.sin(step) * 3, step * 0.01, Math.cos(step)], [1, 2, 3], step * 0.37);
			current = moveOccurrence(current, registry, step % 2 ? 'block-1' : 'block-3', placement).composition;
		}
		expect(validateComposition(current, registry).filter((found) => found.code === 'mate.misaligned')).toEqual([]);
	});

	test('a ring closes only where the mate already holds', () => {
		// Two rails and two bars: four mates around a rectangle, the last one closing the ring.
		const loose = createPortStandardRegistry([
			{
				...[...registry.values()][0],
				id: 'test.loose',
				genders: 'any',
				directions: 'any',
				clocking: 'free',
				matchParameters: [],
			},
		]);
		const pin = (id: string, position: Vec3, east: boolean) => ({
			id,
			label: id,
			standard: 'test.loose',
			direction: 'bidirectional' as const,
			gender: 'neutral' as const,
			frame: frameFromAxisAngle(position, Y, east ? Math.PI / 2 : -Math.PI / 2),
		});
		const part = (id: string, ports: ReturnType<typeof pin>[]): ProductDefinition => ({
			id,
			label: id,
			body: { kind: 'geometry', geometry: { source: 'primitives', primitives: [] }, ports },
		});
		const rail = part('rail', [
			pin('low-east', [0, 0, 0], true),
			pin('high-east', [0, 1, 0], true),
			pin('low-west', [0, 0, 0], false),
			pin('high-west', [0, 1, 0], false),
		]);
		const bar = part('bar', [pin('west', [-1, 0, 0], false), pin('east', [1, 0, 0], true)]);
		const at = (id: string, definition: string, position: Vec3) => ({
			id,
			definition,
			placement: { position, rotation: [0, 0, 0, 1] as [number, number, number, number] },
		});
		let frame: ProductComposition = {
			format: 1,
			id: 'frame',
			definitions: [rail, bar],
			occurrences: [
				at('rail-1', 'rail', [0, 0, 0]),
				at('rail-2', 'rail', [7, 3, 1]),
				at('bar-1', 'bar', [4, 4, 4]),
				at('bar-2', 'bar', [-3, 2, 1]),
			],
			couplings: [],
			conduits: [],
		};
		for (const [a, b] of [
			[ref('rail-1', 'low-east'), ref('bar-1', 'west')],
			[ref('bar-1', 'east'), ref('rail-2', 'low-west')],
			[ref('rail-2', 'high-west'), ref('bar-2', 'east')],
		]) {
			frame = connect(frame, loose, { a, b, mode: 'mated' }).composition;
		}
		const closing = { a: ref('bar-2', 'west'), b: ref('rail-1', 'high-east'), mode: 'mated' as const };
		const closed = connect(frame, loose, closing);
		expect(codes(closed)).toEqual([]);
		expect(validateComposition(closed.composition, loose).filter((found) => found.severity === 'error')).toEqual([]);

		// The same closure with the ring knocked 1 mm out of shape is refused, not forced.
		const bent = {
			...frame,
			occurrences: frame.occurrences.map((occurrence) =>
				occurrence.id === 'bar-2'
					? {
							...occurrence,
							placement: {
								...occurrence.placement,
								position: [
									occurrence.placement.position[0],
									occurrence.placement.position[1] + 0.001,
									occurrence.placement.position[2],
								] as Vec3,
							},
						}
					: occurrence,
			),
		};
		expect(codes(connect(bent, loose, closing))).toEqual(['mate.misaligned']);
	});
});

test('removing an occurrence removes its couplings and their conduits', () => {
	const start = blocks([0, 0, 0], [3, 0, 0], [6, 0, 0]);
	const first = connect(start, registry, { a: ref('block-1', 'east'), b: ref('block-2', 'west'), mode: 'conduit' });
	const second = connect(first.composition, registry, {
		a: ref('block-2', 'east'),
		b: ref('block-3', 'west'),
		mode: 'conduit',
	});
	const routed = setConduitWaypoints(second.composition, 'coupling-1', [[1, 1, 0]]).composition;
	const removed = removeOccurrence(routed, 'block-1').composition;
	expect(removed.couplings.map((coupling) => coupling.id)).toEqual(['coupling-2']);
	expect(removed.conduits).toEqual([]);
	expect(codes(removeOccurrence(removed, 'block-1'))).toEqual(['occurrence.unresolved']);
});

describe('waypoints', () => {
	const start = connect(blocks([0, 0, 0], [3, 0, 0]), registry, {
		id: 'pipe',
		a: ref('block-1', 'east'),
		b: ref('block-2', 'west'),
		mode: 'conduit',
	}).composition;

	test('are quantised on the way in, edited in order, and refused out of range or on a mate', () => {
		const set = setConduitWaypoints(start, 'pipe', [[1.0000000004, 1, 0]]).composition;
		expect(set.conduits).toEqual([{ id: 'conduit-1', coupling: 'pipe', waypoints: [[1, 1, 0]] }]);

		const inserted = insertWaypoint(set, 'conduit-1', 1, [2, 1, 0]).composition;
		expect(inserted.conduits[0].waypoints).toEqual([
			[1, 1, 0],
			[2, 1, 0],
		]);
		expect(removeWaypoint(inserted, 'conduit-1', 0).composition.conduits[0].waypoints).toEqual([[2, 1, 0]]);
		expect(codes(removeWaypoint(inserted, 'conduit-1', 2))).toEqual(['waypoint.unresolved']);

		const mated = connect(blocks([0, 0, 0], [3, 0, 0]), registry, {
			id: 'mate',
			a: ref('block-1', 'east'),
			b: ref('block-2', 'west'),
			mode: 'mated',
		}).composition;
		expect(codes(setConduitWaypoints(mated, 'mate', []))).toEqual(['conduit.mode']);
	});
});

describe('addOccurrence', () => {
	const PAIR: ProductDefinition = {
		id: 'pair',
		label: 'Pair',
		body: { kind: 'composition', occurrences: [], couplings: [], conduits: [], exposedPorts: [] },
	};
	const NESTED: ProductDefinition = {
		...PAIR,
		body: {
			...(PAIR.body as Extract<ProductDefinition['body'], { kind: 'composition' }>),
			occurrences: [{ id: 'block-1', definition: 'block', placement: { position: [0, 0, 0], rotation: [0, 0, 0, 1] } }],
		},
	};
	const empty: ProductComposition = { ...blocks(), definitions: [] };

	test('copies a definition and everything nested in it from the catalogue, and names the occurrence', () => {
		const result = addOccurrence(empty, { definition: 'pair', placement: frameFromAxisAngle([1, 2, 3], Y, 0.5) }, [
			NESTED,
			BLOCK,
		]);
		expect(result.composition.definitions.map((definition) => definition.id)).toEqual(['pair', 'block']);
		expect(result.composition.occurrences.map((occurrence) => occurrence.id)).toEqual(['pair-1']);
	});

	test('refuses an id in use and a definition found nowhere', () => {
		const one = addOccurrence(blocks([0, 0, 0]), {
			id: 'block-1',
			definition: 'block',
			placement: placementOf(blocks([0, 0, 0]), 'block-1') ?? frameFromAxisAngle([0, 0, 0], Y, 0),
		});
		expect(codes(one)).toEqual(['id.duplicate']);
		expect(codes(addOccurrence(empty, { definition: 'pair', placement: frameFromAxisAngle([0, 0, 0], Y, 0) }))).toEqual(
			['definition.missing'],
		);
	});
});
