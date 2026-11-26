/**
 * The solid-modeling kernel: Manifold (`manifold-3d`, Apache-2.0), compiled to WebAssembly.
 * Chosen over JSCAD and three-bvh-csg by measurement (docs/blueprint/3d/parametric-modeling.md
 * § Engine choice): 50–80× faster on Boolean workloads, and its output is a guaranteed closed
 * 2-manifold where three-bvh-csg leaves open edges.
 *
 * The module is the same everywhere; only where the `.wasm` bytes come from differs, so each
 * execution environment passes a `ModelingKernelSource`:
 *
 * - Node / Bun / vitest / a Vercel function: nothing — the package reads its own
 *   `manifold.wasm` beside `manifold.js` (`new URL('manifold.wasm', import.meta.url)`, which the
 *   function's file tracing follows; the production build check in the report pins it).
 * - A caller holding the bytes already: `wasmBinary`.
 * - A browser or Web Worker: `wasmUrl`, a same-origin asset URL (the page's CSP admits
 *   `'wasm-unsafe-eval'`).
 *
 * Loaded once per JavaScript realm and reused: a warm instance pays the compile once.
 */
import type { ManifoldToplevel } from 'manifold-3d';

export type ModelingKernel = ManifoldToplevel;

export interface ModelingKernelSource {
	wasmBinary?: Uint8Array;
	wasmUrl?: string;
}

/** Name and version a report, a derivation key and `describe_modeling` print. */
export const MODELING_KERNEL = { id: 'manifold', version: '3.5.5', label: 'Manifold 3.5.5 (WebAssembly)' } as const;

let loading: Promise<ModelingKernel> | undefined;
let loadedMs: number | undefined;

/** The kernel, compiling it on first use. A failed load is forgotten so a retry can succeed. */
export function loadModelingKernel(source: ModelingKernelSource = {}): Promise<ModelingKernel> {
	if (!loading) {
		const started = performance.now();
		loading = (async () => {
			const { default: create } = await import('manifold-3d');
			const options: Record<string, unknown> = {};
			if (source.wasmBinary) options.wasmBinary = source.wasmBinary;
			if (source.wasmUrl) {
				const url = source.wasmUrl;
				options.locateFile = () => url;
			}
			const kernel = await (create as (options: Record<string, unknown>) => Promise<ModelingKernel>)(options);
			kernel.setup();
			loadedMs = performance.now() - started;
			return kernel;
		})().catch((error) => {
			loading = undefined;
			throw error;
		});
	}
	return loading;
}

/** How long the first load took in this realm (compile + setup), or undefined before it finished. */
export const modelingKernelLoadMs = () => loadedMs;
