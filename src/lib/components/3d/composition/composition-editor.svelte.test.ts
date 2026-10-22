import { describe, expect, test } from 'vitest';
import {
	createPortStandardRegistry,
	disconnect,
	moveOccurrence,
	type ProductComposition,
	stringifyComposition,
} from '$lib/product-composition';
import { HEATING_COMPOSITION, HEATING_STANDARDS } from '$lib/showcases/3d/compose/heating';
import { CompositionEditor } from './composition-editor.svelte';

const registry = createPortStandardRegistry(HEATING_STANDARDS);
const editor = () => new CompositionEditor(HEATING_COMPOSITION, registry);
const at = (composition: ProductComposition, id: string) =>
	composition.occurrences.find((occurrence) => occurrence.id === id)?.placement.position;

describe('CompositionEditor', () => {
	test('an applied operation is one undo step; a refused one changes nothing and says why', () => {
		const state = editor();
		expect(state.apply(disconnect(state.composition, 'radiator-link'))).toBe(true);
		expect(state.composition.couplings).toHaveLength(HEATING_COMPOSITION.couplings.length - 1);

		expect(state.apply(disconnect(state.composition, 'radiator-link'))).toBe(false);
		expect(state.notice.map((found) => found.code)).toEqual(['coupling.unresolved']);

		state.undo();
		expect(state.composition).toBe(HEATING_COMPOSITION);
		expect(state.canUndo).toBe(false);
	});

	test('a drag re-applies to the snapshot it started from and ends as a single undo step', () => {
		const state = editor();
		state.beginGesture();
		for (const x of [0.1, 0.2, 0.3]) {
			state.updateGesture(
				moveOccurrence(state.gestureBase, registry, 'boiler-1', { position: [x, 1.5, 0], rotation: [0, 0, 0, 1] }),
			);
		}
		state.endGesture();
		expect(at(state.composition, 'boiler-1')).toEqual([0.3, 1.5, 0]);
		state.undo();
		expect(state.composition).toBe(HEATING_COMPOSITION);
	});

	test('coupling options mark which ports would take the selected one and which would refuse', () => {
		const state = editor();
		state.select({ kind: 'port', key: 'tank-1#spare-out', ref: { occurrence: 'tank-1', port: 'spare-out' } });
		const options = new Map(state.couplingOptions().map((option) => [option.key, option.diagnostics]));
		expect(options.get('tank-1#secondary-in')?.map((found) => found.code)).toEqual(['coupling.self']);
		expect(options.get('radiator-2#out')?.[0]?.mismatches?.map((mismatch) => mismatch.code)).toEqual([
			'direction.mismatch',
		]);
		expect(options.get('towel-radiator-1#in')?.[0]?.mismatches).toEqual([
			{ code: 'parameter.mismatch', parameter: 'dn' },
		]);
	});

	test('import replaces the document as one undo step; a broken file changes nothing', () => {
		const state = editor();
		const moved = moveOccurrence(state.composition, registry, 'thermostat-1', {
			position: [2, 1.5, 0],
			rotation: [0, 0, 0, 1],
		}).composition;
		expect(state.importJson(stringifyComposition(moved))).toEqual([]);
		expect(at(state.composition, 'thermostat-1')).toEqual([2, 1.5, 0]);
		expect(state.importJson('{ nope')).toHaveLength(1);
		expect(state.importJson(JSON.stringify({ format: 2 })).length).toBeGreaterThan(0);
		state.undo();
		expect(state.composition).toBe(HEATING_COMPOSITION);
	});

	test('a new waypoint goes halfway along the longest run, or after the selected waypoint', () => {
		const state = editor();
		state.select({ kind: 'conduit', coupling: 'control-link' });
		expect(state.waypointInsertion('control-link')).toEqual({ index: 1, point: [0.6625, 1.7, -0.1] });
		state.waypoint = 0;
		expect(state.waypointInsertion('control-link')?.index).toBe(1);
	});
});
