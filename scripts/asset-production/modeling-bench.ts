#!/usr/bin/env bun
/**
 * MCP 3D modeling measurements: kernel load, cold and warm evaluation per stage, CPU, peak RSS,
 * triangle count, GLB / STL / preview / definition / link sizes and determinism, for every
 * example model (the workloads of docs/blueprint/3d/parametric-modeling.md § Performance).
 * Numbers are from the machine and runtime it runs on; the docs quote a dated run and say where.
 *
 *   bun run scripts/asset-production/modeling-bench.ts [--runs 10] [--json]
 *   node --experimental-strip-types scripts/asset-production/modeling-bench.ts   (Node, same code)
 */
import { DEFAULT_ASSET_BUDGET } from '../../src/lib/asset-production/engine.ts';
import {
	encodeModelLink,
	encodePreviewMesh,
	loadModelingKernel,
	modelingKernelLoadMs,
	runParametricModel,
} from '../../src/lib/asset-production/modeling/index.ts';
import { encodeStl } from '../../src/lib/asset-production/stl.ts';
import { EXAMPLE_MODELS } from '../../src/lib/showcases/3d/mcp/example-models.ts';
import { canonicalJson } from '../../src/lib/utils/canonical-json.ts';

const flag = (name: string) => process.argv.indexOf(name);
const runs = Number(process.argv[flag('--runs') + 1]) || 10;
const asJson = flag('--json') !== -1;
const runtime = typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;

const pct = (values: number[], p: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const round = (n: number) => Math.round(n * 10) / 10;

const importStarted = performance.now();
await loadModelingKernel();
const kernelMs = modelingKernelLoadMs() ?? performance.now() - importStarted;

const rows = [];
let peakRss = process.memoryUsage().rss;
for (const example of EXAMPLE_MODELS) {
	const totals: number[] = [];
	const generate: number[] = [];
	const inspect: number[] = [];
	const encode: number[] = [];
	const cpu: number[] = [];
	const hashes = new Set<string>();
	let first: number | undefined;
	let last: Awaited<ReturnType<typeof runParametricModel>> | undefined;
	for (let i = 0; i < runs + 1; i++) {
		const cpuStarted = process.cpuUsage();
		const started = performance.now();
		const result = await runParametricModel(example.model, { budget: DEFAULT_ASSET_BUDGET });
		const elapsed = performance.now() - started;
		const used = process.cpuUsage(cpuStarted);
		if (result.outcome !== 'succeeded' || !result.summary) {
			throw new Error(`${example.id}: ${JSON.stringify(result.diagnostics)}`);
		}
		peakRss = Math.max(peakRss, process.memoryUsage().rss);
		if (i === 0) {
			first = elapsed;
		} else {
			totals.push(elapsed);
			generate.push(result.run?.stageMs.generate ?? 0);
			inspect.push(result.run?.stageMs.inspect ?? 0);
			encode.push(result.run?.stageMs.encode ?? 0);
			cpu.push((used.user + used.system) / 1000);
		}
		hashes.add(result.summary.glbSha256);
		last = result;
	}
	const summary = last?.summary;
	const mesh = last?.run?.mesh;
	if (!summary || !mesh) continue;
	const preview = JSON.stringify(encodePreviewMesh(mesh));
	const definition = canonicalJson(example.model);
	rows.push({
		workload: example.workload,
		id: example.id,
		triangles: summary.triangles,
		vertices: summary.vertices,
		components: summary.components.length,
		firstMs: round(first ?? 0),
		p50Ms: round(pct(totals, 50)),
		p95Ms: round(pct(totals, 95)),
		generateP50Ms: round(pct(generate, 50)),
		inspectP50Ms: round(pct(inspect, 50)),
		encodeP50Ms: round(pct(encode, 50)),
		cpuP50Ms: round(pct(cpu, 50)),
		glbBytes: summary.glbBytes,
		stlBytes: encodeStl(mesh).byteLength,
		previewJsonBytes: preview.length,
		definitionBytes: definition.length,
		linkChars: encodeModelLink(example.model).length,
		glbSha256: summary.glbSha256,
		deterministic: hashes.size === 1,
		closedManifold: summary.closedManifold,
	});
}

const report = {
	runtime,
	platform: `${process.platform} ${process.arch}`,
	date: new Date().toISOString().slice(0, 10),
	runs,
	kernelLoadMs: round(kernelMs),
	peakRssMiB: round(peakRss / 1024 / 1024),
	rows,
};
if (asJson) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`# MCP 3D modeling bench — ${runtime}, ${report.platform}, ${report.date}, ${runs} warm runs`);
	console.log(`kernel load ${report.kernelLoadMs} ms · peak RSS ${report.peakRssMiB} MiB\n`);
	console.log(
		'| workload | model | tris | first ms | p50 ms | p95 ms | generate | inspect | encode | cpu | GLB | STL | preview | definition | link | det. |',
	);
	console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
	for (const r of rows) {
		console.log(
			`| ${r.workload} | ${r.id} | ${r.triangles} | ${r.firstMs} | ${r.p50Ms} | ${r.p95Ms} | ${r.generateP50Ms} | ${r.inspectP50Ms} | ${r.encodeP50Ms} | ${r.cpuP50Ms} | ${r.glbBytes} | ${r.stlBytes} | ${r.previewJsonBytes} | ${r.definitionBytes} | ${r.linkChars} | ${r.deterministic ? 'yes' : 'NO'} |`,
		);
	}
}
