import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	STRUCTURAL_RING_BOUNDS,
	STRUCTURAL_RING_DEFAULTS,
	type StructuralRingParameters,
} from '#lib/schemas/asset-production.ts';
import { type AssetBudget, DEFAULT_ASSET_BUDGET, proceduralEngine, readGlb, structuralRingGenerator } from './index.ts';

const request = (parameters: Partial<StructuralRingParameters> = {}) => ({
	format: 1,
	generator: 'structural-ring',
	parameters: { ...STRUCTURAL_RING_DEFAULTS, ...parameters },
});
const produce = (input: unknown, budget: AssetBudget = DEFAULT_ASSET_BUDGET, signal?: AbortSignal) =>
	proceduralEngine.produce(input, { budget, signal });
const codes = (run: { diagnostics: { code: string }[] }) => run.diagnostics.map((d) => d.code);

async function sha256(bytes: Uint8Array) {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
	return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('a valid request', () => {
	test('produces a GLB whose read-back matches the inspection and the estimate', async () => {
		const run = await produce(request());
		expect(run.outcome).toBe('succeeded');
		expect(run.diagnostics).toEqual([]);
		expect(run.glbSummary?.triangles).toBe(run.inspection?.triangles);
		expect(run.inspection?.triangles).toBe(run.estimate?.triangles);
		expect(run.inspection?.vertices).toBe(run.estimate?.vertices);
		expect(run.inspection?.primitives.map((p) => p.name)).toEqual(['truss', 'spokes', 'hub', 'modules']);
		expect(Object.keys(run.stageMs)).toEqual(['check', 'generate', 'inspect', 'encode', 'verify']);
	});

	test('is deterministic: the same request gives the same bytes', async () => {
		const [a, b] = await Promise.all([produce(request()), produce(request())]);
		expect(a.glb && (await sha256(a.glb))).toBe(b.glb && (await sha256(b.glb)));
	});

	test('the estimate is exact at every parameter bound', async () => {
		const corners: Partial<StructuralRingParameters>[] = [
			{ bays: STRUCTURAL_RING_BOUNDS.bays.min, modules: 0, spokes: 0, detail: STRUCTURAL_RING_BOUNDS.detail.min },
			{
				bays: STRUCTURAL_RING_BOUNDS.bays.max,
				modules: 64,
				spokes: 12,
				detail: 16,
				bracing: 'x-brace',
				ringRadius: 30,
				strutRadius: 0.05,
			},
			{ bracing: 'pratt', spokes: 2, modules: 1 },
		];
		for (const corner of corners) {
			const run = await produce(request(corner));
			expect(run.outcome, JSON.stringify(run.diagnostics)).toBe('succeeded');
			expect(run.inspection?.triangles).toBe(run.estimate?.triangles);
			expect(run.inspection?.vertices).toBe(run.estimate?.vertices);
		}
	});

	test('parameters drive the variation: more bays, more braces, more triangles', async () => {
		const base = structuralRingGenerator.estimate(request().parameters);
		const x = structuralRingGenerator.estimate(request({ bracing: 'x-brace' }).parameters);
		const finer = structuralRingGenerator.estimate(request({ detail: 12 }).parameters);
		expect(x.triangles).toBeGreaterThan(base.triangles);
		expect(finer.triangles).toBeGreaterThan(base.triangles);
		const [warren, pratt] = await Promise.all([produce(request()), produce(request({ bracing: 'pratt' }))]);
		// Same counts, different geometry.
		expect(pratt.inspection?.triangles).toBe(warren.inspection?.triangles);
		expect(pratt.glb && (await sha256(pratt.glb))).not.toBe(warren.glb && (await sha256(warren.glb)));
	});

	test('the GLB carries the provenance the caller derives', async () => {
		const run = await proceduralEngine.produce(request(), {
			budget: DEFAULT_ASSET_BUDGET,
			extras: (parsed) => ({ derivationKey: 'k', generator: parsed.generator }),
		});
		const read = run.glb ? readGlb(run.glb) : undefined;
		expect(read?.summary?.json.asset?.extras).toEqual({ derivationKey: 'k', generator: 'structural-ring' });
	});
});

describe('untrusted input is refused before any geometry is built', () => {
	test.each([
		['an unknown key', { ...request(), script: 'import bpy' }],
		['an unknown parameter', request({ ...STRUCTURAL_RING_DEFAULTS, ...({ python: 'x' } as object) })],
		['an unknown generator', { ...request(), generator: 'blender-python' }],
		['a number as a string', request({ bays: '24' as unknown as number })],
		['a value past its bound', request({ bays: 10_000 })],
		['a fraction where an integer belongs', request({ detail: 7.5 })],
		['NaN', request({ ringRadius: Number.NaN })],
		['Infinity', request({ ringRadius: Number.POSITIVE_INFINITY })],
		['a wrong format', { ...request(), format: 2 }],
		['not an object', 'ring please'],
		['null', null],
	])('%s', async (_, input) => {
		const run = await produce(input);
		expect(run.outcome).toBe('refused');
		expect(codes(run)).toContain('request.invalid');
		expect(run.stageMs.generate).toBeUndefined();
		expect(run.glb).toBeUndefined();
	});

	test.each([
		['one spoke', { spokes: 1 }, 'spokes'],
		['a hub wider than the ring', { hubRadius: 5, ringRadius: 4 }, 'hubRadius'],
		['members thicker than the section', { strutRadius: 0.2, trussDepth: 0.4 }, 'strutRadius'],
		['more modules than bays', { modules: 30, bays: 24 }, 'modules'],
		['bays shorter than their members', { bays: 64, ringRadius: 2, strutRadius: 0.05, trussDepth: 0.3 }, 'bays'],
	])('a parameter conflict: %s', async (_, parameters, subject) => {
		const run = await produce(request(parameters));
		expect(run.outcome).toBe('refused');
		expect(run.diagnostics).toContainEqual(expect.objectContaining({ code: 'parameter.conflict', subject }));
		expect(run.stageMs.generate).toBeUndefined();
	});

	test('a request over the triangle budget is refused from its estimate alone', async () => {
		const run = await produce(request(), { ...DEFAULT_ASSET_BUDGET, maxTriangles: 1_000 });
		expect(codes(run)).toContain('budget.triangles');
		expect(run.stageMs.generate).toBeUndefined();
	});
});

describe('failures keep nothing', () => {
	test('a GLB over the byte budget is not returned', async () => {
		const run = await produce(request(), { ...DEFAULT_ASSET_BUDGET, maxGlbBytes: 10_000 });
		expect(run.outcome).toBe('failed');
		expect(codes(run)).toEqual(['budget.bytes']);
		expect(run.glb).toBeUndefined();
	});

	test('an already-cancelled run builds nothing', async () => {
		const controller = new AbortController();
		controller.abort();
		const run = await produce(request(), DEFAULT_ASSET_BUDGET, controller.signal);
		expect(run.outcome).toBe('cancelled');
		expect(codes(run)).toEqual(['run.cancelled']);
		expect(run.stageMs.check).toBeUndefined();
	});

	test('a cancel mid-generation stops at the next checkpoint', async () => {
		let reads = 0;
		// Cancelled on the tenth look: inside the generator's bay loop, not between stages.
		const signal = {
			get aborted() {
				return ++reads > 10;
			},
		} as AbortSignal;
		const run = await produce(request({ bays: 64, ringRadius: 20 }), DEFAULT_ASSET_BUDGET, signal);
		expect(run.outcome).toBe('cancelled');
		expect(run.stageMs.generate).toBeDefined();
		expect(run.stageMs.inspect).toBeUndefined();
		expect(run.glb).toBeUndefined();
	});

	test('a passed deadline stops the run', async () => {
		const run = await proceduralEngine.produce(request(), {
			budget: DEFAULT_ASSET_BUDGET,
			deadlineAt: performance.now() - 1,
		});
		expect(run.outcome).toBe('cancelled');
		expect(codes(run)).toEqual(['run.deadline']);
	});
});

/**
 * The boundary gate: the core imports only itself, its schemas, Valibot and Three.js's
 * `Vector3` — no framework, no DOM, no Node API — so the same engine runs in a server, a
 * worker process or a browser.
 */
test('the core imports no framework, renderer or runtime API', () => {
	const ALLOWED = /^(\.\.?\/[a-z-/]+\.ts|#lib\/schemas\/(asset-production|product-composition)\.ts|valibot|three)$/;
	const directory = join(process.cwd(), 'src/lib/asset-production');
	const files = readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter(
		(name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
	);
	expect(files.length).toBeGreaterThan(5);
	for (const file of files) {
		const source = readFileSync(join(directory, file), 'utf8');
		for (const [, names, specifier] of source.matchAll(
			/(?:import|export)\s+(?:type\s+)?\{?([^'"]*?)\}?\s+from\s+'([^']+)'/g,
		)) {
			expect(specifier, `${file} imports ${specifier}`).toMatch(ALLOWED);
			if (specifier === 'three') expect(names.trim(), file).toBe('Vector3');
		}
		expect(source, `${file} reads a global it must not`).not.toMatch(/\b(document|window|process|Bun|Deno)\.[a-z]/);
	}
});
