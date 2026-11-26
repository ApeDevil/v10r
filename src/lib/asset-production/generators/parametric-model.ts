/**
 * The parametric-model generator: an asset production generator whose parameters are a whole
 * `ParametricModel` (a feature graph) instead of a fixed parameter set. Everything around it —
 * the engine's stages and budget, inspection, the byte-stable GLB writer, the read-back gate,
 * the derivation key, the report — is the asset production pipeline, unchanged.
 *
 * The geometry comes from the Manifold kernel (WebAssembly), loaded by `prepare` — once per
 * JavaScript realm. An execution environment that needs a specific source for the `.wasm`
 * bytes (a Vercel function, a browser worker) loads it first with `loadModelingKernel(source)`;
 * `prepare` then reuses that instance.
 */

import { MODELING_LIMITS, type ParametricModel } from '#lib/schemas/parametric-model.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { assetDiagnostic } from '../diagnostics.ts';
import { evaluateModel } from '../modeling/evaluate.ts';
import { loadModelingKernel, type ModelingKernel } from '../modeling/kernel.ts';
import { resolveModel } from '../modeling/resolve.ts';
import type { AssetGenerator } from './generator.ts';

let kernel: ModelingKernel | undefined;

/** Vertices per triangle after creases are split: measured 0.5–1.2 on the showcase models. */
const VERTICES_PER_TRIANGLE = 1.25;

/** Real triangles one operation may produce: the engine budget is per run, this is per step. */
const MAX_OPERATION_TRIANGLES = 400_000;

export const parametricModelGenerator: AssetGenerator<ParametricModel> = {
	id: 'parametric-model',
	version: 1,
	label: 'Parametric model (feature graph on the Manifold kernel)',
	estimateKind: 'heuristic',
	check(model) {
		const bytes = new TextEncoder().encode(canonicalJson(model)).byteLength;
		if (bytes > MODELING_LIMITS.maxModelBytes) {
			return [
				assetDiagnostic(
					'model.limit',
					'model',
					`The model is ${bytes} bytes; at most ${MODELING_LIMITS.maxModelBytes}.`,
				),
			];
		}
		return resolveModel(model).diagnostics;
	},
	estimate(model) {
		const triangles = resolveModel(model).resolved?.estimatedTriangles ?? 0;
		return { triangles, vertices: Math.ceil(triangles * VERTICES_PER_TRIANGLE) };
	},
	async prepare() {
		kernel ??= await loadModelingKernel();
	},
	generate(model, checkpoint) {
		const { resolved } = resolveModel(model);
		if (!resolved || !kernel) throw new Error('The parametric model generator ran before check or prepare.');
		return evaluateModel(kernel, resolved, { checkpoint, maxTriangles: MAX_OPERATION_TRIANGLES });
	},
};
