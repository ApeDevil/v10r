import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { DEFAULT_ASSET_BUDGET, readGlb } from '#lib/asset-production/index.ts';
import { STRUCTURAL_RING_DEFAULTS } from '#lib/schemas/asset-production.ts';
import {
	type AssetJobOptions,
	type AssetStore,
	assetKey,
	createAssetJob,
	createDirectoryAssetStore,
	createMemoryAssetStore,
	inProcessEnvironment,
	isTerminalAssetJobStatus,
	moveAssetJob,
	runAssetJob,
} from './index.ts';

const request = (parameters = {}, label?: string) => ({
	format: 1,
	generator: 'structural-ring',
	...(label ? { label } : {}),
	parameters: { ...STRUCTURAL_RING_DEFAULTS, ...parameters },
});
let jobs = 0;
const options = (overrides: Partial<AssetJobOptions> = {}): AssetJobOptions => ({
	environment: inProcessEnvironment,
	budget: DEFAULT_ASSET_BUDGET,
	runMs: 5_000,
	owner: 'user-1',
	agent: { kind: 'software', label: 'test' },
	jobId: `job-${++jobs}`,
	now: () => new Date('2026-10-29T12:00:00Z'),
	...overrides,
});

describe('the report', () => {
	test('carries output, derivation, provenance and measurements — and the GLB carries the derivation', async () => {
		const { job, report, glb } = await runAssetJob(request(), options());
		expect(job.status).toBe('succeeded');
		expect(job.history.map((h) => h.status)).toEqual(['queued', 'running', 'succeeded']);
		expect(report.output?.sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(report.output?.bytes).toBe(glb?.byteLength);
		expect(report.provenance.entity?.sha256).toBe(report.output?.sha256);
		expect(report.provenance.activity.transform).toBe('procedural-ts@1/structural-ring@1');
		expect(report.measurements.cpuUserMs).toBeGreaterThan(0);
		expect(report.measurements.stageMs.generate).toBeGreaterThan(0);
		const extras = glb && readGlb(glb).summary?.json.asset?.extras;
		expect(extras).toEqual({ v10r: report.derivation && { ...report.derivation } });
	});

	test('the label is presentation: it changes neither the derivation key nor the bytes', async () => {
		const [a, b] = await Promise.all([
			runAssetJob(request(), options()),
			runAssetJob(request({}, 'Station Alpha'), options()),
		]);
		expect(b.report.derivation?.derivationKey).toBe(a.report.derivation?.derivationKey);
		expect(b.report.output?.sha256).toBe(a.report.output?.sha256);
	});

	test('a refused request is reported with its findings and no output', async () => {
		const { job, report, glb } = await runAssetJob(request({ spokes: 1 }), options());
		expect(job.status).toBe('refused');
		expect(report.output).toBeUndefined();
		expect(glb).toBeUndefined();
		expect(report.diagnostics.map((d) => d.code)).toEqual(['parameter.conflict']);
	});
});

describe('the store is write-once', () => {
	test('a repeat run reuses the kept asset; another owner gets its own', async () => {
		const store = createMemoryAssetStore();
		const first = await runAssetJob(request(), options({ store }));
		const again = await runAssetJob(request(), options({ store }));
		const other = await runAssetJob(request(), options({ store, owner: 'user-2' }));
		expect(first.report.output?.stored?.kind).toBe('created');
		expect(again.report.output?.stored?.kind).toBe('reused');
		expect(other.report.output?.stored).toMatchObject({ kind: 'created', key: expect.stringMatching(/^user-2\//) });
	});

	test('different bytes under a kept key are refused and the kept asset is untouched', async () => {
		const store = createMemoryAssetStore();
		const first = await runAssetJob(request(), options({ store }));
		const key = first.report.output?.stored?.key as string;
		const tampered: AssetStore = {
			id: 'memory',
			put: (k, glb, _sha, report) => store.put(k, glb, 'f'.repeat(64), report),
			get: store.get,
		};
		const second = await runAssetJob(request(), options({ store: tampered }));
		expect(second.job.status).toBe('failed');
		expect(second.report.diagnostics.map((d) => d.code)).toEqual(['store.conflict']);
		expect(second.glb).toBeUndefined();
		expect((await store.get(key))?.glb.byteLength).toBe(first.glb?.byteLength);
	});

	test('keys cannot climb out of their owner', () => {
		expect(() => assetKey('../etc', 'abc')).toThrow();
		expect(() => assetKey('user-1', 'a/b')).toThrow();
		expect(() => assetKey('User', 'abc')).toThrow();
	});

	describe('on disk', () => {
		let root = '';
		afterAll(() => rm(root, { recursive: true, force: true }));

		test('keeps asset.glb and report.json, reuses on repeat, leaves no staging behind', async () => {
			root = await mkdtemp(join(tmpdir(), 'asset-store-'));
			const store = createDirectoryAssetStore(root);
			const first = await runAssetJob(request(), options({ store }));
			const again = await runAssetJob(request(), options({ store }));
			const key = first.report.output?.stored?.key as string;
			expect(again.report.output?.stored?.kind).toBe('reused');
			expect(await readdir(join(root, key))).toEqual(['asset.glb', 'report.json']);
			expect(await readdir(join(root, 'user-1'))).toEqual([key.split('/')[1]]);
			const kept = JSON.parse(await readFile(join(root, key, 'report.json'), 'utf8'));
			expect(kept.output.sha256).toBe(first.report.output?.sha256);
		});
	});
});

describe('the job lifecycle', () => {
	test('moves only forward, and terminal states have no exit', () => {
		const at = new Date('2026-10-29T12:00:00Z');
		const queued = createAssetJob('j', 'user-1', { kind: 'human', label: 't' }, at);
		expect(moveAssetJob(queued, 'succeeded', at)).toBeUndefined();
		const cancelled = moveAssetJob(queued, 'cancelled', at);
		expect(cancelled && isTerminalAssetJobStatus(cancelled.status)).toBe(true);
		expect(cancelled && moveAssetJob(cancelled, 'running', at)).toBeUndefined();
	});

	test('a cancelled run keeps nothing', async () => {
		const store = createMemoryAssetStore();
		const controller = new AbortController();
		controller.abort();
		const { job, report } = await runAssetJob(request(), options({ store, signal: controller.signal }));
		expect(job.status).toBe('cancelled');
		expect(report.output).toBeUndefined();
	});
});
