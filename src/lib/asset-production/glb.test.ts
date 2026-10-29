import { validateBytes } from 'gltf-validator';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, test } from 'vitest';
import { STRUCTURAL_RING_DEFAULTS, type StructuralRingParameters } from '#lib/schemas/asset-production.ts';
import { DEFAULT_ASSET_BUDGET, proceduralEngine, readGlb } from './index.ts';

async function glbFor(parameters: Partial<StructuralRingParameters> = {}) {
	const run = await proceduralEngine.produce(
		{ format: 1, generator: 'structural-ring', parameters: { ...STRUCTURAL_RING_DEFAULTS, ...parameters } },
		{ budget: DEFAULT_ASSET_BUDGET, extras: () => ({ derivationKey: 'test' }) },
	);
	if (!run.glb) throw new Error(JSON.stringify(run.diagnostics));
	return run;
}

describe('the encoder writes valid glTF', () => {
	test.each([
		['16-bit indices', {}],
		[
			'32-bit indices (more than 65 535 vertices in one mesh)',
			{ bays: 64, detail: 16, bracing: 'x-brace', ringRadius: 30 } as const,
		],
	])('the Khronos validator finds no error or warning: %s', async (_, parameters) => {
		const run = await glbFor(parameters);
		const report = await validateBytes(run.glb as Uint8Array);
		expect(report.issues.messages.filter((m: { severity: number }) => m.severity <= 1)).toEqual([]);
		expect(report.issues.numErrors).toBe(0);
		expect(report.issues.numWarnings).toBe(0);
		expect(report.info.totalTriangleCount).toBe(run.inspection?.triangles);
	});

	test('Three.js GLTFLoader — what the viewer uses — loads every mesh by name', async () => {
		const run = await glbFor();
		const glb = run.glb as Uint8Array;
		const buffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
		const gltf = await new GLTFLoader().parseAsync(buffer, '');
		const names: string[] = [];
		gltf.scene.traverse((object) => {
			if ('isMesh' in object && object.isMesh) names.push(object.name);
		});
		expect(names).toEqual(['truss', 'spokes', 'hub', 'modules']);
	});
});

describe('the read-back gate refuses a damaged file', () => {
	const damage = async (edit: (bytes: Uint8Array) => Uint8Array) => {
		const bytes = (await glbFor()).glb as Uint8Array;
		return readGlb(edit(bytes.slice()));
	};
	const malformed = (result: ReturnType<typeof readGlb>) => {
		expect(result.summary).toBeUndefined();
		expect(result.diagnostics.map((d) => d.code)).toEqual(['glb.malformed']);
	};

	test('the original reads clean', async () => {
		const result = await damage((b) => b);
		expect(result.diagnostics).toEqual([]);
		expect(result.summary?.meshes).toBe(4);
	});
	test('truncated', async () => malformed(await damage((b) => b.subarray(0, b.byteLength - 4))));
	test('wrong magic', async () => malformed(await damage((b) => b.fill(0, 0, 4))));
	test('garbage JSON', async () => malformed(await damage((b) => b.fill(0x7b, 20, 40))));
	test('an index past the vertices', async () =>
		malformed(
			await damage((bytes) => {
				// The last 4 bytes of BIN are the end of the last index buffer (or its zero padding, then the one before).
				bytes.fill(0xff, bytes.byteLength - 8, bytes.byteLength);
				return bytes;
			}),
		));
	test('too short to be a GLB', () => malformed(readGlb(new Uint8Array(8))));
});
