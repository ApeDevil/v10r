import { describe, expect, test } from 'vitest';
import type { ProductComposition } from '../schemas/product-composition';
import { IDENTITY_FRAME } from './frame';
import { parseComposition, stringifyComposition } from './serialize';

const composition: ProductComposition = {
	format: 1,
	id: 'sample',
	definitions: [
		{
			id: 'block',
			label: 'Block',
			body: {
				kind: 'geometry',
				geometry: {
					source: 'primitives',
					primitives: [{ shape: 'box', size: [1, 1, 1], frame: IDENTITY_FRAME, tone: 'surface' }],
				},
				ports: [
					{
						id: 'out',
						label: 'Out',
						standard: 'test.keyed',
						direction: 'source',
						gender: 'male',
						frame: IDENTITY_FRAME,
					},
					{ id: 'in', label: 'In', standard: 'test.keyed', direction: 'sink', gender: 'female', frame: IDENTITY_FRAME },
				],
				passages: [['in', 'out']],
			},
		},
		{
			id: 'stand',
			label: 'Stand',
			body: { kind: 'geometry', geometry: { source: 'model', modelId: 'fox' }, ports: [] },
		},
	],
	occurrences: [
		{ id: 'block-2', definition: 'block', placement: { position: [1, 0, 0], rotation: [0, 0, 0, 1] } },
		{ id: 'block-1', definition: 'block', placement: IDENTITY_FRAME },
	],
	couplings: [
		{ id: 'c-1', a: { occurrence: 'block-1', port: 'out' }, b: { occurrence: 'block-2', port: 'in' }, mode: 'conduit' },
	],
	conduits: [
		{
			id: 'k-1',
			coupling: 'c-1',
			waypoints: [
				[0.5, 1, 0],
				[0.2, 1, 0],
			],
		},
	],
};

describe('stringifyComposition', () => {
	test('export → import → export is byte-equal', () => {
		const text = stringifyComposition(composition);
		const parsed = parseComposition(JSON.parse(text));
		expect(parsed.ok && stringifyComposition(parsed.composition)).toBe(text);
	});

	test('entity order does not change the bytes; waypoint order does', () => {
		const shuffled = { ...composition, occurrences: [...composition.occurrences].reverse() };
		expect(stringifyComposition(shuffled)).toBe(stringifyComposition(composition));

		const reversedPath = {
			...composition,
			conduits: [
				{
					...composition.conduits[0],
					waypoints: [
						[0.2, 1, 0],
						[0.5, 1, 0],
					],
				},
			],
		};
		expect(stringifyComposition(reversedPath as ProductComposition)).not.toBe(stringifyComposition(composition));
	});

	test('a passage is unordered: [out, in] and [in, out] write the same bytes', () => {
		const block = composition.definitions[0];
		if (block.body.kind !== 'geometry') throw new Error('fixture');
		const flipped = { ...block, body: { ...block.body, passages: [['out', 'in'] as [string, string]] } };
		const other = { ...composition, definitions: [flipped, composition.definitions[1]] };
		expect(stringifyComposition(other)).toBe(stringifyComposition(composition));
	});
});

describe('parseComposition is fail-closed', () => {
	const refused = (input: unknown) => {
		const result = parseComposition(input);
		return result.ok ? [] : result.issues.map((issue) => issue.path);
	};

	test('an unknown format, an unknown key and a non-unit rotation are refused with their path', () => {
		expect(refused({ ...composition, format: 2 })).toEqual(['format']);
		expect(refused({ ...composition, extra: true })).toEqual(['extra']);
		const skewed = [{ ...composition.occurrences[0], placement: { position: [0, 0, 0], rotation: [0, 0, 0, 2] } }];
		expect(refused({ ...composition, occurrences: skewed })).toEqual(['occurrences.0.placement.rotation']);
	});

	test('a repeated id is refused at every level', () => {
		const twice = [composition.occurrences[0], composition.occurrences[0]];
		expect(refused({ ...composition, occurrences: twice })).toEqual(['occurrences']);

		const block = composition.definitions[0];
		if (block.body.kind !== 'geometry') throw new Error('fixture');
		const repeatedPort = { ...block, body: { ...block.body, ports: [block.body.ports[0], block.body.ports[0]] } };
		expect(refused({ ...composition, definitions: [repeatedPort] })).toEqual(['definitions.0.body.ports']);
	});

	test('unresolved references still parse — they are validation diagnostics, not parse failures', () => {
		expect(parseComposition({ ...composition, definitions: [] }).ok).toBe(true);
	});
});
