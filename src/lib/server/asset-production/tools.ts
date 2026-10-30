/**
 * Asset production as MCP tools: an agent asks for supported modeling operations through the
 * same request schema every other caller uses — typed, bounded parameters of a named
 * generator — and never through code. There is no "run this script" tool, no Blender Python,
 * no file path argument: what a generator does not implement cannot be asked for.
 *
 * Shaped as a `ToolRegistry` (`#lib/server/mcp`'s transport contract — structurally, so this
 * domain does not import the transport; `tools.test.ts` pins the fit), so mounting it is one
 * line in an endpoint. It is deliberately NOT mounted on the public endpoint: `produce_asset`
 * spends CPU per call, and anonymous compute belongs behind the showcase route's rate limit.
 * The admin endpoint, or a per-user authenticated one, is where it fits.
 *
 * - `describe_asset_generators` — what can be asked for: each generator, each parameter's
 *   bounds and default, and this surface's budget. Free.
 * - `produce_asset` — run one job. The asset is kept as an owner-scoped draft when a store is
 *   given (never published, never overwriting); the answer is the report, as text.
 */
import { toJsonSchema } from '@valibot/to-json-schema';
import type { AssetAgent } from '#lib/asset-production/index.ts';
import { ASSET_GENERATORS, type AssetBudget, type AssetReport, hasAssetErrors } from '#lib/asset-production/index.ts';
import { assetRequestSchema, BRACING_PATTERNS, STRUCTURAL_RING_BOUNDS } from '#lib/schemas/asset-production.ts';
import type { ToolDef } from '#patterns/query.ts';
import { inProcessEnvironment } from './in-process.ts';
import { runAssetJob } from './run-job.ts';
import type { AssetStore } from './store.ts';

export interface AssetToolOptions {
	owner: string;
	agent: AssetAgent;
	budget: AssetBudget;
	runMs: number;
	store?: AssetStore;
	/** Job ids for this registry's runs; deterministic in tests. */
	nextJobId: () => string;
}

/** A tool answer: what `#lib/server/mcp`'s `ToolResult` accepts. */
interface AssetToolAnswer {
	content: { type: 'text'; text: string }[];
	isError?: boolean;
	diag?: 'invalid_args' | 'unknown_tool';
}

const text = (body: string, isError = false): AssetToolAnswer => ({
	content: [{ type: 'text', text: body }],
	...(isError ? { isError } : {}),
});

function describe(budget: AssetBudget): string {
	const lines = ['# Asset generators', ''];
	for (const generator of Object.values(ASSET_GENERATORS)) {
		lines.push(
			`## ${generator.id} (v${generator.version}) — ${generator.label}`,
			'',
			'| Parameter | Min | Max | Step | Default |',
			'|---|---|---|---|---|',
		);
		for (const [name, bound] of Object.entries(STRUCTURAL_RING_BOUNDS)) {
			lines.push(`| ${name} | ${bound.min} | ${bound.max} | ${bound.step} | ${bound.default} |`);
		}
		lines.push(`| bracing | ${BRACING_PATTERNS.join(' · ')} | | | warren |`, '');
	}
	lines.push(
		'## Budget on this surface',
		'',
		`At most ${budget.maxTriangles} triangles, ${budget.maxVertices} vertices and ${budget.maxGlbBytes} GLB bytes per run. A request over budget is refused before anything is built.`,
		'',
		'Request shape: `{ "format": 1, "generator": "<id>", "parameters": { … }, "label"?: "…" }`. Unknown keys are refused.',
	);
	return lines.join('\n');
}

export function summariseAssetReport(report: AssetReport): string {
	const lines = [`# Asset job ${report.jobId}: ${report.outcome}`, ''];
	if (report.output) {
		const o = report.output;
		lines.push(
			`- Output: ${o.mediaType}, ${o.bytes} bytes, ${o.triangles} triangles, ${o.vertices} vertices, ${o.meshes} meshes`,
			`- sha256: ${o.sha256}`,
		);
		if (o.stored) lines.push(`- Kept as a draft: ${o.stored.key} (${o.stored.kind}); nothing was published`);
	}
	if (report.derivation)
		lines.push(`- Derivation key: ${report.derivation.derivationKey} (${report.derivation.transform})`);
	lines.push(
		`- Engine: ${report.engine.id}@${report.engine.version} in ${report.environment.id} (${report.environment.runtime})`,
	);
	lines.push(`- Time: ${report.measurements.totalMs.toFixed(1)} ms`);
	if (report.diagnostics.length > 0) {
		lines.push('', '## Findings', '');
		for (const d of report.diagnostics) lines.push(`- ${d.severity} \`${d.code}\` (${d.subject}): ${d.message}`);
	}
	return lines.join('\n');
}

export function createAssetToolRegistry(options: AssetToolOptions): {
	tools: readonly ToolDef[];
	dispatch(name: string, args: unknown): Promise<AssetToolAnswer>;
} {
	const tools: ToolDef[] = [
		{
			name: 'describe_asset_generators',
			description:
				'List the 3D asset generators this server can run, every parameter with its bounds and default, and the per-run budget.',
			inputSchema: { type: 'object', additionalProperties: false, properties: {} },
		},
		{
			name: 'produce_asset',
			description:
				'Generate one 3D asset (GLB) from a typed request: a generator id and its bounded parameters. Returns the report — counts, size, sha256, derivation key, findings and timings. The asset is kept as a private draft, never published.',
			inputSchema: toJsonSchema(assetRequestSchema, {
				errorMode: 'throw',
				// The label's printable-text regex needs the `u` flag, which JSON Schema cannot carry; the server still enforces it.
				ignoreActions: ['regex'],
			}) as Record<string, unknown>,
		},
	];

	return {
		tools,
		async dispatch(name, args) {
			if (name === 'describe_asset_generators') return text(describe(options.budget));
			if (name !== 'produce_asset') return { ...text(`Unknown tool: ${name}`, true), diag: 'unknown_tool' };
			const { report } = await runAssetJob(args, {
				environment: inProcessEnvironment,
				budget: options.budget,
				runMs: options.runMs,
				owner: options.owner,
				agent: options.agent,
				jobId: options.nextJobId(),
				store: options.store,
			});
			const failed = hasAssetErrors(report.diagnostics);
			return {
				...text(summariseAssetReport(report), failed),
				...(report.outcome === 'refused' ? { diag: 'invalid_args' as const } : {}),
			};
		},
	};
}
