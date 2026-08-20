/**
 * Browser loader for the vendored wasm kernel (see crates/kernel and
 * scripts/wasm/build.sh for how the artifacts in ./kernel/ are produced).
 *
 * The load shape is deliberate and each part is load-bearing:
 *
 * - `?url` + explicit `init({ module_or_path })`, never a bare glue import that
 *   relies on its internal `new URL('…_bg.wasm', import.meta.url)`: that
 *   expression is executed during SSR/prerender (sveltejs/kit#4512) and gets
 *   rewritten to a broken `{}.url` by some build paths (vitejs/vite#5075).
 *   `?url` emits the binary as a hashed immutable asset and hands us the string.
 * - Dynamic `import()` of the glue, never static from a component graph: no
 *   Vite wasm/top-level-await plugins needed — the TLA plugin breaks under
 *   Svelte 5 (sveltejs/kit#13015) — and the glue stays out of SSR entirely.
 * - Module-level singleton: SPA navigation remounts components freely;
 *   re-initing would refetch and recompile the module every visit.
 *
 * The object argument form is required — `init(url)` is deprecated since
 * wasm-bindgen 0.2.93 and logs a console warning.
 */
import wasmUrl from './kernel/kernel_bg.wasm?url';

export type KernelModule = typeof import('./kernel/kernel.js');

export interface Kernel {
	mod: KernelModule;
	/** Linear memory — views over `.buffer` go stale after any allocating call; always take a fresh view. */
	memory: WebAssembly.Memory;
}

let ready: Promise<Kernel> | null = null;

export function loadKernel(): Promise<Kernel> {
	if (!ready) {
		ready = import('./kernel/kernel.js').then(async (mod) => {
			const out = await mod.default({ module_or_path: wasmUrl });
			return { mod, memory: out.memory };
		});
		// A failed fetch/compile must not poison every later attempt with a
		// rejected singleton — reset so a retry can succeed.
		ready.catch(() => {
			ready = null;
		});
	}
	return ready;
}
