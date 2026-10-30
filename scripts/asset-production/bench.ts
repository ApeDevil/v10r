#!/usr/bin/env bun
/**
 * Asset production measurements: per-stage time, CPU, memory, output size and complexity for
 * a fixed set of requests, in-process and in the isolated worker. Numbers are from the machine
 * it runs on; the docs quote a dated run and say where.
 *
 *   bun run asset:bench [--runs 20]
 */
import { DEFAULT_ASSET_BUDGET } from '../../src/lib/asset-production/index.ts';
import { STRUCTURAL_RING_DEFAULTS, type StructuralRingParameters } from '../../src/lib/schemas/asset-production.ts';
import {
	type AssetExecutionEnvironment,
	createIsolatedProcessEnvironment,
	inProcessEnvironment,
	runAssetJob,
	runtimeLabel,
} from '../../src/lib/server/asset-production/index.ts';

const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 20;
const CASES: Record<string, Partial<StructuralRingParameters>> = {
	minimal: { bays: 8, detail: 3, spokes: 0, modules: 0, ringRadius: 4 },
	default: {},
	largest: {
		ringRadius: 30,
		bays: 64,
		detail: 16,
		bracing: 'x-brace',
		spokes: 12,
		modules: 64,
		hubRadius: 5,
		strutRadius: 0.05,
	},
};

const pct = (values: number[], p: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const ms = (n: number) => n.toFixed(1);

async function measure(name: string, environment: AssetExecutionEnvironment, count: number) {
	const parameters = { ...STRUCTURAL_RING_DEFAULTS, ...CASES[name] };
	const totals: number[] = [];
	const cpu: number[] = [];
	const stages: Record<string, number[]> = {};
	let last: Awaited<ReturnType<typeof runAssetJob>>['report'] | undefined;
	const hashes = new Set<string>();
	for (let i = 0; i < count; i++) {
		const { report } = await runAssetJob(
			{ format: 1, generator: 'structural-ring', parameters },
			{
				environment,
				budget: DEFAULT_ASSET_BUDGET,
				runMs: 30_000,
				owner: 'bench',
				agent: { kind: 'software', label: 'bench' },
				jobId: `bench-${i}`,
			},
		);
		if (report.outcome !== 'succeeded') throw new Error(`${name}: ${JSON.stringify(report.diagnostics)}`);
		totals.push(report.measurements.totalMs);
		cpu.push((report.measurements.cpuUserMs ?? 0) + (report.measurements.cpuSystemMs ?? 0));
		for (const [stage, value] of Object.entries(report.measurements.stageMs)) {
			stages[stage] = [...(stages[stage] ?? []), value ?? 0];
		}
		hashes.add(report.output?.sha256 ?? '');
		last = report;
	}
	const o = last?.output;
	console.log(
		`| ${name} | ${environment.id} | ${o?.triangles} | ${o?.vertices} | ${((o?.bytes ?? 0) / 1024).toFixed(0)} KiB | ` +
			`${ms(pct(totals, 50))} / ${ms(pct(totals, 95))} | ${ms(pct(cpu, 50))} | ` +
			`${Object.entries(stages)
				.map(([s, v]) => `${s} ${ms(pct(v, 50))}`)
				.join(', ')} | ` +
			`${((last?.measurements.rssBytes ?? 0) / 1024 / 1024).toFixed(0)} MiB | ${hashes.size === 1 ? 'yes' : 'NO'} |`,
	);
}

console.log(
	`Runtime ${runtimeLabel()} · ${process.platform}/${process.arch} · ${navigator.hardwareConcurrency} CPUs · ${runs} runs per in-process row, 5 per isolated row (first run included)\n`,
);
console.log(
	'| Case | Environment | Triangles | Vertices | GLB | Total p50 / p95 ms | CPU p50 ms | Stage p50 ms | RSS after run | Same bytes every run |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const name of Object.keys(CASES)) await measure(name, inProcessEnvironment, runs);
const isolated = createIsolatedProcessEnvironment();
for (const name of Object.keys(CASES)) await measure(name, isolated, 5);
