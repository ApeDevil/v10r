/**
 * The production engine: one untrusted input in, one checked GLB (or the reasons there is
 * none) out. Stages, in order, each timed:
 *
 *   check     parse the request (fail-closed), cross-parameter rules, the a-priori budget
 *   generate  the generator builds the mesh, calling `checkpoint` between units of work
 *   inspect   counts, bounds, closed and outward shells, the declared envelope
 *   encode    byte-stable GLB with provenance in `asset.extras`
 *   verify    read the GLB back; the byte budget
 *
 * The budget is checked twice on purpose: before anything is built, from the generator's exact
 * estimate (so an oversized request costs nothing), and after, from what was really built (so
 * a wrong estimate cannot slip through).
 *
 * The engine is pure computation — no clock but `performance.now`, no filesystem, no network —
 * so the same code runs in-process on a server, in a worker process, or in a browser.
 */
import * as v from 'valibot';
import { type AssetRequest, assetRequestSchema } from '#lib/schemas/asset-production.ts';
import { type AssetDiagnostic, assetDiagnostic, hasAssetErrors } from './diagnostics.ts';
import { generatorFor } from './generators/index.ts';
import { encodeGlb, type GlbSummary, readGlb } from './glb.ts';
import { inspectMesh, type MeshInspection } from './inspect.ts';
import type { MeshCost } from './mesh.ts';

/** What one run may spend. Set by the operator of an execution environment, never by the request. */
export interface AssetBudget {
	maxTriangles: number;
	maxVertices: number;
	maxGlbBytes: number;
}

/**
 * Sized so the largest in-bounds ring (about 68k triangles, 2.5 MB) fits, and so its GLB,
 * base64-encoded, still travels in one serverless HTTP response (Vercel caps those at 4.5 MB).
 */
export const DEFAULT_ASSET_BUDGET: AssetBudget = {
	maxTriangles: 100_000,
	maxVertices: 120_000,
	maxGlbBytes: 3 * 1024 * 1024,
};

export type AssetStageId = 'check' | 'generate' | 'inspect' | 'encode' | 'verify';

export interface EngineContext {
	budget: AssetBudget;
	/** Cancellation from the caller: a closed connection, a user's Cancel, a job being stopped. */
	signal?: AbortSignal;
	/** `performance.now()` value after which the run stops at its next checkpoint. */
	deadlineAt?: number;
	/** Provenance written into the GLB's `asset.extras`; derived by the caller from the parsed request. */
	extras?: (request: AssetRequest) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export type EngineOutcome = 'succeeded' | 'refused' | 'cancelled' | 'failed';

export interface EngineRun {
	outcome: EngineOutcome;
	/** Present once the input parsed. */
	request?: AssetRequest;
	estimate?: MeshCost;
	inspection?: MeshInspection;
	glb?: Uint8Array;
	glbSummary?: Omit<GlbSummary, 'json'>;
	diagnostics: AssetDiagnostic[];
	/** Wall time per stage, milliseconds. A stage that did not run is absent. */
	stageMs: Partial<Record<AssetStageId, number>>;
}

/** Thrown by `checkpoint` only, caught by the engine: a stop is an outcome, not an exception to callers. */
class RunStopped extends Error {
	readonly reason: 'cancelled' | 'deadline';
	constructor(reason: 'cancelled' | 'deadline') {
		super(reason);
		this.reason = reason;
	}
}

export interface AssetProductionEngine {
	/** `procedural-ts` — what a report and the derivation key call it. */
	id: string;
	/** Bumped when the stages, the inspector or the encoder change an output byte. */
	version: number;
	label: string;
	produce(input: unknown, context: EngineContext): Promise<EngineRun>;
}

/** Let a pending abort (a timer, a closed socket) land before the next synchronous stage. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function produce(input: unknown, context: EngineContext): Promise<EngineRun> {
	const stageMs: EngineRun['stageMs'] = {};
	const diagnostics: AssetDiagnostic[] = [];
	const run: EngineRun = { outcome: 'refused', diagnostics, stageMs };
	const checkpoint = () => {
		if (context.signal?.aborted) throw new RunStopped('cancelled');
		if (context.deadlineAt !== undefined && performance.now() > context.deadlineAt) throw new RunStopped('deadline');
	};
	const stage = async <T>(id: AssetStageId, work: () => T | Promise<T>): Promise<T> => {
		await yieldToEventLoop();
		checkpoint();
		const started = performance.now();
		try {
			return await work();
		} finally {
			stageMs[id] = performance.now() - started;
		}
	};

	try {
		const request = await stage('check', () => {
			const parsed = v.safeParse(assetRequestSchema, input);
			if (!parsed.success) {
				for (const issue of parsed.issues) {
					diagnostics.push(assetDiagnostic('request.invalid', v.getDotPath(issue) ?? 'request', issue.message));
				}
				return undefined;
			}
			const generator = generatorFor(parsed.output);
			diagnostics.push(...generator.check(parsed.output.parameters));
			const estimate = generator.estimate(parsed.output.parameters);
			run.estimate = estimate;
			if (estimate.triangles > context.budget.maxTriangles) {
				diagnostics.push(
					assetDiagnostic(
						'budget.triangles',
						'request',
						`Needs ${estimate.triangles} triangles; this environment allows ${context.budget.maxTriangles}.`,
					),
				);
			}
			if (estimate.vertices > context.budget.maxVertices) {
				diagnostics.push(
					assetDiagnostic(
						'budget.vertices',
						'request',
						`Needs ${estimate.vertices} vertices; this environment allows ${context.budget.maxVertices}.`,
					),
				);
			}
			return parsed.output;
		});
		if (!request) return run;
		run.request = request;
		if (hasAssetErrors(diagnostics)) return run;

		const generator = generatorFor(request);
		const mesh = await stage('generate', () => generator.generate(request.parameters, checkpoint));

		const inspected = await stage('inspect', () => inspectMesh(mesh));
		run.inspection = inspected.inspection;
		diagnostics.push(...inspected.diagnostics);
		const estimate = run.estimate;
		if (
			estimate &&
			(estimate.triangles !== inspected.inspection.triangles || estimate.vertices !== inspected.inspection.vertices)
		) {
			diagnostics.push(
				assetDiagnostic(
					'mesh.estimate-mismatch',
					'mesh',
					'The built mesh differs from the estimate the budget was checked against.',
				),
			);
		}
		if (inspected.inspection.triangles > context.budget.maxTriangles) {
			diagnostics.push(assetDiagnostic('budget.triangles', 'mesh', 'The built mesh exceeds the triangle budget.'));
		}
		if (hasAssetErrors(diagnostics)) return { ...run, outcome: 'failed' };

		const extras = context.extras ? await context.extras(request) : undefined;
		const glb = await stage('encode', () => encodeGlb(mesh, { name: request.generator, extras }));

		const read = await stage('verify', () => readGlb(glb));
		diagnostics.push(...read.diagnostics);
		if (glb.byteLength > context.budget.maxGlbBytes) {
			diagnostics.push(
				assetDiagnostic(
					'budget.bytes',
					'glb',
					`The GLB is ${glb.byteLength} bytes; this environment allows ${context.budget.maxGlbBytes}.`,
				),
			);
		}
		if (!read.summary || hasAssetErrors(diagnostics)) return { ...run, outcome: 'failed' };
		const { json: _json, ...summary } = read.summary;
		return { ...run, outcome: 'succeeded', glb, glbSummary: summary };
	} catch (error) {
		if (error instanceof RunStopped) {
			diagnostics.push(
				error.reason === 'deadline'
					? assetDiagnostic('run.deadline', 'run', 'The run reached its deadline and stopped; nothing was kept.')
					: assetDiagnostic('run.cancelled', 'run', 'The run was cancelled; nothing was kept.'),
			);
			return { ...run, outcome: 'cancelled' };
		}
		diagnostics.push(
			assetDiagnostic('run.failed', 'run', error instanceof Error ? error.message : 'The engine failed.'),
		);
		return { ...run, outcome: 'failed' };
	}
}

export const proceduralEngine: AssetProductionEngine = {
	id: 'procedural-ts',
	version: 1,
	label: 'Procedural TypeScript (Three.js math, own GLB writer)',
	produce,
};
