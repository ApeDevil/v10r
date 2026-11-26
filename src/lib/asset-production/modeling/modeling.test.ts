import { describe, expect, test } from 'vitest';
import { MODELING_LIMITS, type ParametricModel } from '#lib/schemas/parametric-model.ts';
import { EXAMPLE_MODELS, exampleModel } from '#lib/showcases/3d/mcp/example-models.ts';
import { DEFAULT_ASSET_BUDGET, readGlb } from '../index.ts';
import { encodeStl } from '../stl.ts';
import {
	applyModelPatch,
	compileExpression,
	decodeModelLink,
	decodePreviewPrimitive,
	encodeModelLink,
	encodePreviewMesh,
	MAX_MODEL_LINK_CHARS,
	runParametricModel,
} from './index.ts';

const run = (model: unknown, budget = DEFAULT_ASSET_BUDGET) => runParametricModel(model, { budget });
const codes = (result: { diagnostics: { code: string }[] }) => result.diagnostics.map((d) => d.code);

async function sha256(bytes: Uint8Array) {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
	return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

const plate = (holes = 4): ParametricModel => ({
	version: 1,
	units: 'mm',
	parameters: { width: 80, height: 50, thickness: 8 },
	operations: [
		{ id: 'base', op: 'box', size: ['$width', '$height', '$thickness'] },
		{ id: 'hole', op: 'cylinder', r: 4, h: 12, segments: 64, at: [-30, 0, 0] },
		{ id: 'holes', op: 'pattern.linear', of: 'hole', count: holes, step: [20, 0, 0] },
		{ id: 'result', op: 'subtract', from: 'base', remove: ['holes'] },
	],
	output: 'result',
});

describe('the bounded expression language', () => {
	test('evaluates arithmetic, parameters, functions and coordinates', () => {
		expect(compileExpression('$w / 2 - 4', { w: 80 })()).toBe(36);
		expect(compileExpression('max($a, 2) * (1 + 1)', { a: 3 })()).toBe(6);
		expect(compileExpression('-2 * -3', {})()).toBe(6);
		expect(compileExpression('x + y * 2', {}, ['x', 'y'])({ x: 1, y: 2 })).toBe(5);
		expect(compileExpression('2 * pi', {})()).toBeCloseTo(2 * Math.PI);
	});

	test.each([
		['an unknown parameter', '$nope'],
		['code', 'constructor'],
		['property access', 'Math.sin(1)'],
		['a string', '"a"'],
		['an assignment', '$w = 1'],
		['an unknown function', 'eval(1)'],
		['a prototype key', '__proto__'],
		['coordinates outside a heightfield', 'x + 1'],
		['trailing input', '1 2'],
		['too deep', '-(-(-(-(-(-(-(-(-(-1)))))))))'],
		['too long', `${'1+'.repeat(80)}1`],
	])('refuses %s', (_label, source) => {
		expect(() => compileExpression(source, { w: 1 })).toThrow();
	});
});

describe('a valid model', () => {
	test('a plate minus four holes has the analytic volume and genus 4', async () => {
		const result = await run(plate());
		expect(result.outcome).toBe('succeeded');
		const summary = result.summary;
		expect(summary?.components[0].genus).toBe(4);
		expect(summary?.closedManifold).toBe(true);
		expect(summary?.size).toEqual([80, 50, 8]);
		// 64-gon holes: area = ½·n·r²·sin(2π/n).
		const hole = 0.5 * 64 * 16 * Math.sin((2 * Math.PI) / 64) * 8;
		expect(summary?.volume).toBeCloseTo(80 * 50 * 8 - 4 * hole, 2);
	});

	test('every example model builds, closed and manifold, with no finding', async () => {
		for (const example of EXAMPLE_MODELS) {
			const result = await run(example.model);
			expect(result.outcome, example.id).toBe('succeeded');
			expect(codes(result), example.id).toEqual([]);
			expect(result.summary?.closedManifold, example.id).toBe(true);
			expect(result.summary?.link?.length, example.id).toBeLessThan(MAX_MODEL_LINK_CHARS);
		}
	});

	test('the enclosure (the success case) has a 3 mm wall, four holes and a separate lid', async () => {
		const result = await run(exampleModel('enclosure').model);
		const [body, lid] = result.summary?.components ?? [];
		expect(body.name).toBe('body');
		expect(body.genus).toBe(4);
		expect(lid.name).toBe('lid');
		expect(body.size).toEqual([60, 60, 40]);
	});

	test('is deterministic: the same model gives the same GLB bytes and digest', async () => {
		const [a, b] = await Promise.all([run(exampleModel('bracket').model), run(exampleModel('bracket').model)]);
		expect(a.run?.glb && (await sha256(a.run.glb))).toBe(b.run?.glb && (await sha256(b.run.glb)));
		expect(a.summary?.digest).toBe(b.summary?.digest);
	});

	test('the GLB reads back and the STL has 50 bytes per triangle', async () => {
		const result = await run(plate());
		const glb = result.run?.glb as Uint8Array;
		expect(readGlb(glb).diagnostics).toEqual([]);
		const stl = encodeStl(result.run?.mesh as never);
		expect(stl.byteLength).toBe(84 + 50 * (result.summary?.triangles ?? 0));
	});

	test('the preview mesh decodes within its quantization step', async () => {
		const result = await run(plate());
		const mesh = result.run?.mesh;
		const preview = encodePreviewMesh(mesh as never);
		const decoded = decodePreviewPrimitive(preview.primitives[0]);
		expect(decoded.indices.length).toBe(mesh?.primitives[0].indices.length);
		const step = 0.08 / 65535; // the plate's largest extent, metres
		const max = Math.max(...decoded.positions.map(Math.abs));
		expect(max).toBeLessThanOrEqual(0.04 + step);
	});
});

describe('an invalid or oversized model is refused before the kernel runs', () => {
	test.each([
		['an unknown operation', { ...plate(), operations: [{ id: 'a', op: 'python', code: 'import os' }] }],
		['an unknown key', { ...plate(), script: 'x' }],
		[
			'a forward reference',
			{
				...plate(),
				operations: [
					{ id: 'a', op: 'union', of: ['b'] },
					{ id: 'b', op: 'box', size: [1, 1, 1] },
				],
				output: 'a',
			},
		],
		['a missing output', { ...plate(), output: 'nope' }],
		['a negative size', { ...plate(), operations: [{ id: 'a', op: 'box', size: [1, -1, 1] }], output: 'a' }],
		[
			'NaN through an expression',
			{ ...plate(), operations: [{ id: 'a', op: 'box', size: [1, 'sqrt(-1)', 1] }], output: 'a' },
		],
		['a huge magnitude', { ...plate(), operations: [{ id: 'a', op: 'box', size: [1, 1e9, 1] }], output: 'a' }],
		[
			'too many pattern copies',
			{
				...plate(),
				operations: [
					{ id: 'a', op: 'box', size: [1, 1, 1] },
					{ id: 'b', op: 'pattern.linear', of: 'a', count: 999, step: [2, 0, 0] },
				],
				output: 'b',
			},
		],
		[
			'a duplicate id',
			{
				...plate(),
				operations: [
					{ id: 'a', op: 'box', size: [1, 1, 1] },
					{ id: 'a', op: 'box', size: [1, 1, 1] },
				],
				output: 'a',
			},
		],
	])('%s', async (_label, model) => {
		const result = await run(model);
		expect(result.outcome).toBe('refused');
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.run?.stageMs.generate).toBeUndefined();
	});

	test('an estimate over budget is refused at check', async () => {
		const result = await run(plate(64), { ...DEFAULT_ASSET_BUDGET, maxTriangles: 1_000 });
		expect(result.outcome).toBe('refused');
		expect(codes(result)).toContain('budget.triangles');
		expect(result.run?.stageMs.generate).toBeUndefined();
	});

	test('a model over the byte limit is refused', async () => {
		const long = (i: number) => `${i}.${'0'.repeat(100)}1`;
		const operations = Array.from({ length: 64 }, (_, i) => ({
			id: `b${i}`,
			op: 'box' as const,
			size: [1, 1, 1] as [number, number, number],
			at: [long(i), long(i), long(i)] as [string, string, string],
		}));
		const result = await run({ version: 1, units: 'mm', operations, output: 'b0' });
		expect(codes(result)).toEqual(['model.limit']);
		expect(MODELING_LIMITS.maxModelBytes).toBe(16_384);
	});

	test('a deadline stops a run between operations and keeps nothing', async () => {
		const result = await runParametricModel(exampleModel('organic').model, {
			budget: DEFAULT_ASSET_BUDGET,
			deadlineAt: performance.now() - 1,
		});
		expect(result.outcome).toBe('cancelled');
		expect(result.run?.glb).toBeUndefined();
	});

	test('an empty Boolean result is a finding, not a crash', async () => {
		const result = await run({
			version: 1,
			units: 'mm',
			operations: [
				{ id: 'a', op: 'box', size: [1, 1, 1] },
				{ id: 'b', op: 'box', size: [1, 1, 1], at: [10, 0, 0] },
				{ id: 'c', op: 'intersect', of: ['a', 'b'] },
			],
			output: 'c',
		});
		expect(result.outcome).toBe('failed');
		expect(codes(result)).toContain('model.empty-result');
	});
});

describe('stateless modification', () => {
	test('a parameter patch regenerates from the supplied model only', async () => {
		const patched = applyModelPatch(plate(), { parameters: { thickness: 12 } });
		expect(patched.ok).toBe(true);
		const result = await run(patched.ok ? patched.value : null);
		expect(result.summary?.size).toEqual([80, 50, 12]);
	});

	test('operation edits, removals and additions apply in order', async () => {
		const patched = applyModelPatch(plate(), {
			operations: { hole: { r: 2 } },
			add: [{ id: 'boss', op: 'cylinder', r: 5, h: 10, center: false, at: [0, 0, 4] }],
			output: ['result', 'boss'],
		});
		const result = await run(patched.ok ? patched.value : null);
		expect(result.summary?.components.map((c) => c.name)).toEqual(['result', 'boss']);
	});

	test('a patch naming an unknown parameter or changing an op is refused', () => {
		expect(applyModelPatch(plate(), { parameters: { depth: 1 } }).ok).toBe(false);
		expect(applyModelPatch(plate(), { operations: { hole: { op: 'sphere' } } }).ok).toBe(false);
		expect(applyModelPatch(plate(), { remove: ['nope'] }).ok).toBe(false);
	});
});

describe('model links', () => {
	test('round-trip, and equal models give equal links whatever the key order', () => {
		const model = plate();
		const { output, operations, ...rest } = model;
		const reordered = JSON.parse(JSON.stringify({ output, operations, ...rest }));
		const link = encodeModelLink(model);
		expect(link.startsWith('m1.')).toBe(true);
		expect(encodeModelLink(reordered)).toBe(link);
		const decoded = decodeModelLink(`#${link}`);
		expect(decoded.ok && decoded.value).toEqual(JSON.parse(JSON.stringify(model)));
	});

	test.each([
		['not a model link', 'hello', 'not-a-model-link'],
		['a future version', 'm2.AAAA', 'unsupported-version'],
		['a bad alphabet', 'm1.***', 'malformed'],
		['truncated deflate', `m1.${encodeModelLink(plate()).slice(3, 20)}`, 'malformed'],
		['too long', `m1.${'A'.repeat(MAX_MODEL_LINK_CHARS)}`, 'too-long'],
	])('refuses %s', (_label, fragment, reason) => {
		const decoded = decodeModelLink(fragment);
		expect(decoded.ok).toBe(false);
		if (!decoded.ok) expect(decoded.reason).toBe(reason);
	});

	test('a compression bomb stops at the output limit', async () => {
		const { deflateSync } = await import('fflate');
		const bomb = deflateSync(new Uint8Array(5_000_000).fill(32), { level: 9 });
		const text = btoa(String.fromCharCode(...bomb))
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replaceAll('=', '');
		const decoded = decodeModelLink(`m1.${text}`);
		expect(decoded.ok).toBe(false);
		if (!decoded.ok) expect(decoded.reason).toBe('too-large');
	});
});
