import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	conduitPolyline,
	connect,
	createPortStandardRegistry,
	insertWaypoint,
	moveOccurrence,
	type ProductComposition,
	parseComposition,
	portNetworks,
	stringifyComposition,
	validateComposition,
} from '#lib/product-composition/index.ts';
import { HEATING_COMPOSITION, HEATING_STANDARDS } from './heating';
import { SHELVING_COMPOSITION, SHELVING_STANDARDS } from './shelving';

const heating = createPortStandardRegistry(HEATING_STANDARDS);
const shelving = createPortStandardRegistry(SHELVING_STANDARDS);
const errors = (composition: ProductComposition, registry: typeof heating) =>
	validateComposition(composition, registry).filter((found) => found.severity === 'error');
const roundTrip = (composition: ProductComposition) => {
	const parsed = parseComposition(JSON.parse(stringifyComposition(composition)));
	if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
	return parsed.composition;
};
const ref = (occurrence: string, port: string) => ({ occurrence, port });

describe('the fixtures', () => {
	test.each([
		['heating', HEATING_COMPOSITION, heating],
		['shelving', SHELVING_COMPOSITION, shelving],
	] as const)('%s parses, round-trips byte-equal and has no error', (_, composition, registry) => {
		expect(stringifyComposition(roundTrip(composition))).toBe(stringifyComposition(composition));
		expect(errors(composition, registry)).toEqual([]);
	});

	test('the heating starter leaves exactly its intended ports open', () => {
		const open = validateComposition(HEATING_COMPOSITION, heating).map(({ code, subject }) => `${code} ${subject}`);
		expect(open).toEqual([
			'port.open ports/radiator-2#out',
			'port.open ports/tank-1#secondary-in',
			'port.open ports/tank-1#spare-out',
			'port.open ports/towel-radiator-1#in',
			'port.open ports/towel-radiator-1#out',
		]);
	});
});

/**
 * The domain-neutrality gate: the engine must not know what it is composing. Heating and
 * shelving words may appear in its comments (as examples), never in its code. A member access
 * (`v.pipe`, Valibot's combinator) is a library's name, not a domain word.
 */
test('the composition core names no domain in its code', () => {
	const DOMAIN_WORDS =
		/(?<!\.)\b(heating|boiler|pump|radiator|thermostat|valve|tank|water|fluid|shelf|shelving|upright|peg|sofa|lamp|pipe|cable|voltage|thread|dn)\b/i;
	const directory = join(process.cwd(), 'src/lib/product-composition');
	const sources = [
		...readdirSync(directory)
			.filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
			.map((file) => join(directory, file)),
		join(process.cwd(), 'src/lib/schemas/product-composition.ts'),
	];
	for (const source of sources) {
		const code = readFileSync(source, 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');
		expect(code.match(DOMAIN_WORDS)?.[0], source).toBeUndefined();
	}
});

/**
 * The boundary gate: the core imports only itself, its schema, Valibot and Three.js's math
 * classes — never Svelte, `$app`, Threlte or a scene object — so an import, an AI tool or a
 * server write can validate a document without a renderer.
 */
test('the composition core imports no framework and no renderer', () => {
	const ALLOWED = /^(\.\/[a-z-]+|\.\.\/schemas\/product-composition|valibot|three)$/;
	const THREE_MATH = new Set(['Quaternion', 'Vector3', 'Matrix4', 'Euler']);
	const directory = join(process.cwd(), 'src/lib/product-composition');
	for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
		const source = readFileSync(join(directory, file), 'utf8');
		for (const [, names, specifier] of source.matchAll(
			/(?:import|export)\s+(?:type\s+)?\{?([^'"]*?)\}?\s+from\s+'([^']+)'/g,
		)) {
			expect(specifier, `${file} imports ${specifier}`).toMatch(ALLOWED);
			if (specifier !== 'three') continue;
			for (const name of names.split(',').map((part) => part.replace(/^type\s+/, '').trim())) {
				expect(THREE_MATH.has(name), `${file} imports ${name} from three`).toBe(true);
			}
		}
	}
});

/** The six steps the browser spec drives through the editor, replayed on the core alone. */
test('scenario: couple, refuse, move, route, export → import, switch fixture', () => {
	// 1. The heating fixture loads clean.
	let composition = roundTrip(HEATING_COMPOSITION);
	expect(errors(composition, heating)).toEqual([]);

	// 2. Coupling a compatible pair closes the secondary circuit's open return.
	const coupled = connect(composition, heating, {
		a: ref('radiator-2', 'out'),
		b: ref('tank-1', 'secondary-in'),
		mode: 'conduit',
	});
	expect(coupled.diagnostics).toEqual([]);
	composition = coupled.composition;
	const fluidNetwork = portNetworks(composition).find((network) => network.standards.includes('fluid.thread'));
	expect(fluidNetwork?.openPorts).toEqual(['tank-1#spare-out']);

	// 3. An incompatible pair is refused with its reason, and nothing changes.
	const refused = connect(composition, heating, {
		a: ref('tank-1', 'spare-out'),
		b: ref('towel-radiator-1', 'in'),
		mode: 'conduit',
	});
	expect(refused.diagnostics).toMatchObject([
		{ code: 'port.incompatible', mismatches: [{ code: 'parameter.mismatch', parameter: 'dn' }] },
	]);
	expect(refused.composition).toBe(composition);

	// 4. Moving the boiler carries the mated hydraulic unit; the pipe from it re-derives.
	const unitBefore = composition.occurrences.find((occurrence) => occurrence.id === 'hydraulic-unit-1')?.placement;
	const lengthBefore = conduitPolyline(composition, 'primary-flow')?.length;
	composition = moveOccurrence(composition, heating, 'boiler-1', {
		position: [0.5, 1.5, 0],
		rotation: [0, 0, 0, 1],
	}).composition;
	const unitAfter = composition.occurrences.find((occurrence) => occurrence.id === 'hydraulic-unit-1')?.placement;
	expect(unitAfter?.position[0]).toBeCloseTo((unitBefore?.position[0] ?? 0) + 0.5, 9);
	expect(conduitPolyline(composition, 'primary-flow')?.length).not.toBe(lengthBefore);
	expect(errors(composition, heating)).toEqual([]);

	// 5. An edited waypoint survives export → import, byte for byte.
	composition = insertWaypoint(composition, 'conduit-1', 0, [0.4, 0.75, 0]).composition;
	const exported = stringifyComposition(composition);
	expect(stringifyComposition(roundTrip(composition))).toBe(exported);
	expect(roundTrip(composition).conduits.find((conduit) => conduit.id === 'conduit-1')?.waypoints[0]).toEqual([
		0.4, 0.75, 0,
	]);

	// 6. The other fixture runs on the same engine — and its ring of mates moves as one piece.
	const shelf = moveOccurrence(SHELVING_COMPOSITION, shelving, 'shelf-1', {
		position: [0.415, 0.4, 2],
		rotation: [0, 0, 0, 1],
	}).composition;
	expect(errors(shelf, shelving)).toEqual([]);
	expect(shelf.occurrences.find((occurrence) => occurrence.id === 'upright-2')?.placement.position).toEqual([
		0.83, 0.9, 2,
	]);
});
