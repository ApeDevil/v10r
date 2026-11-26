/**
 * Evaluate a parametric model in the browser — the same `runParametricModel` the MCP 3D server
 * runs, so the viewer's GLB is byte-identical to the server's (its sha256 is in both summaries).
 * Free of worker plumbing on purpose: the shell is `model-evaluation.worker.ts`; this half is
 * node-testable apart from the `?url` kernel source.
 */

import type { AssetDiagnostic } from '#lib/asset-production/diagnostics.ts';
import { DEFAULT_ASSET_BUDGET } from '#lib/asset-production/engine.ts';
import {
	loadModelingKernel,
	modelingKernelLoadMs,
	type ParametricModelSummary,
	runParametricModel,
} from '#lib/asset-production/modeling/index.ts';
import { encodeStl } from '#lib/asset-production/stl.ts';
import type { ParametricModel } from '#lib/schemas/parametric-model.ts';

export interface ModelEvaluation {
	outcome: 'succeeded' | 'refused' | 'failed' | 'cancelled';
	diagnostics: AssetDiagnostic[];
	model?: ParametricModel;
	summary?: ParametricModelSummary;
	glb?: Uint8Array;
	stl?: Uint8Array;
	/** Kernel compile + setup in this worker, once; undefined on later runs' first use. */
	kernelLoadMs?: number;
}

/** A browser run gets more time than a server call: it spends only the visitor's own CPU. */
export const BROWSER_RUN_MS = 20_000;

export async function evaluateInBrowser(model: unknown, wasmUrl: string): Promise<ModelEvaluation> {
	await loadModelingKernel({ wasmUrl });
	const result = await runParametricModel(model, {
		budget: DEFAULT_ASSET_BUDGET,
		deadlineAt: performance.now() + BROWSER_RUN_MS,
	});
	const mesh = result.run?.mesh;
	return {
		outcome: result.outcome,
		diagnostics: result.diagnostics,
		model: result.model,
		summary: result.summary,
		glb: result.summary ? result.run?.glb : undefined,
		stl: result.summary && mesh ? encodeStl(mesh) : undefined,
		kernelLoadMs: modelingKernelLoadMs(),
	};
}
