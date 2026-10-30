import { describe, expect, test } from 'vitest';
import { DEFAULT_ASSET_BUDGET } from '#lib/asset-production/index.ts';
import { STRUCTURAL_RING_DEFAULTS } from '#lib/schemas/asset-production.ts';
import { type AssetJobOptions, createIsolatedProcessEnvironment, inProcessEnvironment, runAssetJob } from './index.ts';

const request = { format: 1, generator: 'structural-ring', parameters: STRUCTURAL_RING_DEFAULTS };
const options = (overrides: Partial<AssetJobOptions>): AssetJobOptions => ({
	environment: inProcessEnvironment,
	budget: DEFAULT_ASSET_BUDGET,
	runMs: 4_000,
	owner: 'user-1',
	agent: { kind: 'software', label: 'test' },
	jobId: 'job-isolated',
	...overrides,
});

/** A worker that never answers: what a hung engine looks like from the parent. */
const HUNG = ['bun', '-e', 'setInterval(() => {}, 1000)'] as const;

describe('the isolated worker process', () => {
	test('gives the same bytes as in-process, on another JS engine (Bun JSC vs Node V8)', async () => {
		const [isolated, local] = await Promise.all([
			runAssetJob(request, options({ environment: createIsolatedProcessEnvironment() })),
			runAssetJob(request, options({})),
		]);
		expect(isolated.report.outcome).toBe('succeeded');
		expect(isolated.report.environment.runtime).toMatch(/^bun /);
		expect(isolated.report.output?.sha256).toBe(local.report.output?.sha256);
		expect(isolated.report.measurements.rssBytes).toBeGreaterThan(0);
	});

	test('is killed at its deadline, whatever it is doing', async () => {
		const started = performance.now();
		const { report } = await runAssetJob(
			request,
			options({ environment: createIsolatedProcessEnvironment({ command: HUNG }), runMs: 300 }),
		);
		expect(report.outcome).toBe('cancelled');
		expect(report.diagnostics.map((d) => d.code)).toEqual(['run.deadline']);
		expect(performance.now() - started).toBeLessThan(3_000);
	});

	test('is killed on cancel', async () => {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 100);
		const { report } = await runAssetJob(
			request,
			options({ environment: createIsolatedProcessEnvironment({ command: HUNG }), signal: controller.signal }),
		);
		expect(report.diagnostics.map((d) => d.code)).toEqual(['run.cancelled']);
	});

	test('is killed when it writes past its output cap', async () => {
		const loud = ['bun', '-e', 'process.stdout.write("x".repeat(100000))'] as const;
		const { report } = await runAssetJob(
			request,
			options({ environment: createIsolatedProcessEnvironment({ command: loud, maxOutputBytes: 1_000 }) }),
		);
		expect(report.outcome).toBe('failed');
		expect(report.diagnostics[0]?.message).toMatch(/more than 1000 bytes/);
	});

	test('a worker that cannot start is a failed run, not a thrown error', async () => {
		const { report } = await runAssetJob(
			request,
			options({ environment: createIsolatedProcessEnvironment({ command: ['no-such-program-v10r'] }) }),
		);
		expect(report.outcome).toBe('failed');
		expect(report.diagnostics.map((d) => d.code)).toEqual(['run.failed']);
	});
});
