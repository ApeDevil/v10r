/**
 * One asset production job, end to end: claim → execute in an environment → hash → keep (or
 * not) → report. Every caller — the HTTP route, the CLI, the MCP tool — goes through here, so
 * every asset gets the same report, provenance and store rule.
 *
 * The report is the output metadata: what was asked (the parsed request and its digest), what
 * produced it (engine, generator, versions, environment, runtime), what came out (bytes,
 * sha256, counts, inspection), what it cost (per-stage time, CPU, memory), every finding, and
 * a PROV-DM provenance record. Nothing in it is invented: a field the environment could not
 * measure is absent.
 */
import {
	ASSET_REPORT_FORMAT,
	type AssetAgent,
	type AssetBudget,
	type AssetReport,
	assetDiagnostic,
	type EngineOutcome,
	GLB_MEDIA_TYPE,
	generatorFor,
	proceduralEngine,
} from '#lib/asset-production/index.ts';
import { deriveAsset, sha256Hex } from './derivation.ts';
import type { AssetExecutionEnvironment } from './environment.ts';
import { type AssetJob, type AssetJobStatus, createAssetJob, moveAssetJob } from './job.ts';
import { type AssetStore, assetKey } from './store.ts';

export interface AssetJobOptions {
	environment: AssetExecutionEnvironment;
	budget: AssetBudget;
	runMs: number;
	owner: string;
	agent: AssetAgent;
	jobId: string;
	signal?: AbortSignal;
	/** Without a store the GLB is returned to the caller only — the showcase case. */
	store?: AssetStore;
	now?: () => Date;
}

export interface AssetJobResult {
	job: AssetJob;
	report: AssetReport;
	glb?: Uint8Array;
}

const STATUS_OF: Record<EngineOutcome, AssetJobStatus> = {
	succeeded: 'succeeded',
	refused: 'refused',
	cancelled: 'cancelled',
	failed: 'failed',
};

export async function runAssetJob(input: unknown, options: AssetJobOptions): Promise<AssetJobResult> {
	const now = options.now ?? (() => new Date());
	const queued = createAssetJob(options.jobId, options.owner, options.agent, now());
	const startedAt = now();
	let job = moveAssetJob(queued, 'running', startedAt) ?? queued;

	const executed = await options.environment.execute(input, {
		budget: options.budget,
		runMs: options.runMs,
		signal: options.signal,
	});
	const { run } = executed;
	const diagnostics = [...run.diagnostics];
	let outcome = run.outcome;
	let glb = outcome === 'succeeded' ? run.glb : undefined;
	const derivation = run.request ? await deriveAsset(run.request) : undefined;
	const generator = run.request ? generatorFor(run.request) : undefined;

	let output: AssetReport['output'];
	if (glb && run.glbSummary) {
		output = { mediaType: GLB_MEDIA_TYPE, bytes: glb.byteLength, sha256: await sha256Hex(glb), ...run.glbSummary };
	}

	const endedAt = now();
	const report: AssetReport = {
		format: ASSET_REPORT_FORMAT,
		jobId: job.id,
		outcome,
		request: run.request,
		derivation,
		engine: { id: proceduralEngine.id, version: proceduralEngine.version, label: proceduralEngine.label },
		generator: generator && { id: generator.id, version: generator.version, label: generator.label },
		environment: { id: options.environment.id, runtime: executed.runtime, budget: options.budget },
		output,
		estimate: run.estimate,
		inspection: run.inspection,
		diagnostics,
		measurements: { ...executed.measurements, stageMs: run.stageMs },
		provenance: {
			entity: output && { sha256: output.sha256 },
			activity: {
				transform: derivation?.transform,
				startedAt: startedAt.toISOString(),
				endedAt: endedAt.toISOString(),
			},
			agent: options.agent,
		},
	};

	if (options.store && glb && output && derivation) {
		const key = assetKey(options.owner, derivation.derivationKey);
		const kept = await options.store.put(
			key,
			glb,
			output.sha256,
			JSON.stringify({ ...report, output: { ...output, stored: { store: options.store.id, key, kind: 'created' } } }),
		);
		if (kept.kind === 'conflict') {
			// The kept asset stays; this run's bytes are dropped and the run fails loudly.
			diagnostics.push(
				assetDiagnostic(
					'store.conflict',
					key,
					'An asset with this derivation key but different bytes is already kept; the producing code changed without a version bump.',
				),
			);
			outcome = 'failed';
			glb = undefined;
			report.output = undefined;
			report.provenance.entity = undefined;
		} else {
			output.stored = { store: options.store.id, key, kind: kept.kind };
		}
		report.outcome = outcome;
	}

	job = moveAssetJob(job, STATUS_OF[outcome], endedAt) ?? job;
	return { job, report, glb };
}
