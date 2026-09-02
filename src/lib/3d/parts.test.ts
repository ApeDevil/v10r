import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { collectPartMeshes, type PartDef, resolvePartId, SOFA_PARTS, validateParts } from './parts';

function partById(id: string): PartDef {
	const part = SOFA_PARTS.find((p) => p.id === id);
	if (!part) throw new Error(`test fixture missing part "${id}"`);
	return part;
}

describe('resolvePartId', () => {
	it('maps exact sofa mesh names to logical parts', () => {
		expect(resolvePartId('GlamVelvetSofa_fabric', SOFA_PARTS)).toBe('body');
		expect(resolvePartId('GlamVelvetSofa_legs', SOFA_PARTS)).toBe('legs');
		expect(resolvePartId('GlamVelvetSofa_feet', SOFA_PARTS)).toBe('feet');
	});

	it('tolerates multi-primitive "_N" mesh splits', () => {
		expect(resolvePartId('GlamVelvetSofa_legs_0', SOFA_PARTS)).toBe('legs');
		expect(resolvePartId('GlamVelvetSofa_fabric_1', SOFA_PARTS)).toBe('body');
	});

	it('returns null for unknown or empty names', () => {
		expect(resolvePartId('Camera', SOFA_PARTS)).toBeNull();
		expect(resolvePartId('GlamVelvetSofa', SOFA_PARTS)).toBeNull(); // prefix without "_" must not match
		expect(resolvePartId('', SOFA_PARTS)).toBeNull();
	});
});

// Minimal Object3D-like tree: just enough for traverse + isMesh/name checks.
function fakeScene(meshNames: string[]): Object3D {
	const nodes = meshNames.map((name) => ({ isMesh: true, name }));
	return {
		traverse(cb: (child: unknown) => void) {
			for (const n of nodes) cb(n);
		},
	} as unknown as Object3D;
}

describe('collectPartMeshes', () => {
	it('collects every mesh (incl. primitive splits) for a part', () => {
		const scene = fakeScene(['GlamVelvetSofa_legs', 'GlamVelvetSofa_legs_0', 'GlamVelvetSofa_feet']);
		const legs = partById('legs');
		expect(collectPartMeshes(scene, legs).map((m) => m.name)).toEqual(['GlamVelvetSofa_legs', 'GlamVelvetSofa_legs_0']);
	});

	it('returns empty when no mesh matches', () => {
		expect(collectPartMeshes(fakeScene(['SomethingElse']), partById('body'))).toEqual([]);
	});
});

describe('SOFA_PARTS photos', () => {
	it('gives every part exactly 3 photos', () => {
		for (const part of SOFA_PARTS) {
			expect(part.photos, `part "${part.id}" photos`).toHaveLength(3);
		}
	});

	it('points every photo at a model-scoped static asset with complete copy', () => {
		for (const part of SOFA_PARTS) {
			for (const photo of part.photos ?? []) {
				expect(photo.src).toMatch(/^\/images\/parts\/glam-velvet-sofa\/[a-z0-9-]+\.(jpg|webp|png|avif)$/);
				expect(photo.alt.trim()).not.toBe('');
				expect(photo.caption.trim()).not.toBe('');
				expect(photo.credit.trim()).not.toBe('');
			}
		}
	});

	it('never reuses a photo across parts', () => {
		const srcs = SOFA_PARTS.flatMap((p) => p.photos ?? []).map((p) => p.src);
		expect(new Set(srcs).size).toBe(srcs.length);
	});

	it('has a real file in static/ behind every photo src', () => {
		for (const part of SOFA_PARTS) {
			for (const photo of part.photos ?? []) {
				expect(existsSync(join(process.cwd(), 'static', photo.src)), `missing asset: ${photo.src}`).toBe(true);
			}
		}
	});
});

describe('validateParts', () => {
	it('warns once per part with zero matches', () => {
		const scene = fakeScene(['GlamVelvetSofa_legs']); // body + feet will miss
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (msg: string) => warnings.push(msg);
		try {
			validateParts(scene, SOFA_PARTS);
		} finally {
			console.warn = original;
		}
		expect(warnings).toHaveLength(2);
		expect(warnings.join('\n')).toContain('"body"');
		expect(warnings.join('\n')).toContain('"feet"');
	});
});
