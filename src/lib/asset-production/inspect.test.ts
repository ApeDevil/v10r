import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { type GeneratedMesh, inspectMesh, MeshBuilder, type MeshPrimitive } from './index.ts';

const ENVELOPE: GeneratedMesh['envelope'] = { min: [-10, -10, -10], max: [10, 10, 10] };
const codes = (mesh: GeneratedMesh) => inspectMesh(mesh).diagnostics.map((d) => d.code);

function tubeAndBox(): MeshPrimitive {
	const builder = new MeshBuilder('part', 'structure');
	builder.tube(new Vector3(0, 0, 0), new Vector3(1, 2, 3), 0.1, 6);
	builder.box(new Vector3(2, 0, 0), [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)], [0.5, 0.25, 1]);
	return builder.build();
}
const mesh = (primitive: MeshPrimitive, envelope = ENVELOPE): GeneratedMesh => ({ primitives: [primitive], envelope });

describe('a well-formed mesh', () => {
	test('passes every check, and measures what it is', () => {
		const { inspection, diagnostics } = inspectMesh(mesh(tubeAndBox()));
		expect(diagnostics).toEqual([]);
		expect(inspection.shells).toBe(2);
		expect(inspection.triangles).toBe(4 * 6 + 12);
		// The box is exact; the hexagonal tube is a little less than a round one.
		const box = 1 * 0.5 * 2;
		const tube = ((3 * Math.sqrt(3)) / 2) * 0.1 ** 2 * Math.hypot(1, 2, 3);
		expect(inspection.enclosedVolume).toBeCloseTo(box + tube, 5);
	});
});

describe('every defect is a finding', () => {
	test('a missing triangle opens its shell', () => {
		const primitive = tubeAndBox();
		const indices = primitive.indices.slice(3);
		const shells = [{ firstIndex: 0, indexCount: primitive.shells[0].indexCount - 3 }];
		expect(codes(mesh({ ...primitive, indices, shells }))).toContain('mesh.open-shell');
	});

	test('reversed winding is an inverted shell', () => {
		const primitive = tubeAndBox();
		const indices = primitive.indices.slice();
		for (let t = 0; t < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
		expect(codes(mesh({ ...primitive, indices }))).toEqual(['mesh.inverted-shell']);
	});

	test('a non-finite coordinate', () => {
		const primitive = tubeAndBox();
		primitive.positions[4] = Number.NaN;
		expect(codes(mesh(primitive))).toContain('mesh.non-finite');
	});

	test('an index past the last vertex', () => {
		const primitive = tubeAndBox();
		primitive.indices[0] = 10_000;
		expect(codes(mesh(primitive))).toContain('mesh.index-out-of-range');
	});

	test('a zero-area triangle', () => {
		const primitive = tubeAndBox();
		primitive.indices[2] = primitive.indices[1];
		expect(codes(mesh(primitive))).toContain('mesh.degenerate-triangle');
	});

	test('a normal that is not unit length', () => {
		const primitive = tubeAndBox();
		primitive.normals[0] = 3;
		expect(codes(mesh(primitive))).toEqual(['mesh.normal-not-unit']);
	});

	test('geometry outside the declared envelope', () => {
		expect(codes(mesh(tubeAndBox(), { min: [-1, -1, -1], max: [1, 1, 1] }))).toEqual(['mesh.outside-envelope']);
	});

	test('no triangles at all', () => {
		expect(codes({ primitives: [], envelope: ENVELOPE })).toEqual(['mesh.empty']);
	});
});
