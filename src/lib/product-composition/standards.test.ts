import { describe, expect, test } from 'vitest';
import type { PortStandard, ProductPort } from '../schemas/product-composition';
import { IDENTITY_FRAME } from './frame';
import { createPortStandardRegistry, portMismatches } from './standards';

/** Deliberately abstract standards: the rules are shape, not domain. */
const KEYED: PortStandard = {
	id: 'test.keyed',
	family: 'test',
	label: 'Keyed',
	genders: 'opposite',
	directions: 'complementary',
	clocking: 'fixed',
	matchParameters: ['size'],
};
const LOOSE: PortStandard = { ...KEYED, id: 'test.loose', genders: 'any', directions: 'any', matchParameters: [] };
const registry = createPortStandardRegistry([KEYED, LOOSE]);

const port = (overrides: Partial<ProductPort>): ProductPort => ({
	id: 'p',
	label: 'P',
	standard: 'test.keyed',
	direction: 'source',
	gender: 'male',
	frame: IDENTITY_FRAME,
	parameters: { size: 20 },
	...overrides,
});

describe('portMismatches', () => {
	test('a male source meets a female sink of the same size', () => {
		expect(portMismatches(registry, port({}), port({ direction: 'sink', gender: 'female' }), 'mated')).toEqual([]);
		expect(portMismatches(registry, port({}), port({ direction: 'bidirectional', gender: 'female' }), 'mated')).toEqual(
			[],
		);
	});

	test('reports every broken rule, in a fixed order', () => {
		expect(portMismatches(registry, port({}), port({ parameters: { size: 25 } }), 'mated')).toEqual([
			{ code: 'gender.mismatch' },
			{ code: 'direction.mismatch' },
			{ code: 'parameter.mismatch', parameter: 'size' },
		]);
	});

	test('a missing match parameter is a mismatch, not a wildcard', () => {
		expect(
			portMismatches(
				registry,
				port({ parameters: {} }),
				port({ direction: 'sink', gender: 'female', parameters: {} }),
				'mated',
			),
		).toEqual([{ code: 'parameter.mismatch', parameter: 'size' }]);
	});

	test('gender binds touching ports only: a conduit between two males passes, direction still binds', () => {
		const sink = port({ direction: 'sink' });
		expect(portMismatches(registry, port({}), sink, 'conduit')).toEqual([]);
		expect(portMismatches(registry, port({}), port({}), 'conduit')).toEqual([{ code: 'direction.mismatch' }]);
	});

	test('different or unknown standards never couple; a standard can waive gender and direction', () => {
		expect(portMismatches(registry, port({}), port({ standard: 'test.loose' }), 'mated')).toEqual([
			{ code: 'standard.mismatch' },
		]);
		expect(portMismatches(registry, port({}), port({ standard: 'test.unknown' }), 'mated')).toEqual([
			{ code: 'standard.unknown' },
		]);
		const loose = port({ standard: 'test.loose' });
		expect(portMismatches(registry, loose, loose, 'mated')).toEqual([]);
	});
});

test('a duplicate standard id is refused', () => {
	expect(() => createPortStandardRegistry([KEYED, KEYED])).toThrow(/test\.keyed/);
});
