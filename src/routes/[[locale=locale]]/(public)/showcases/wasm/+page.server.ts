/**
 * WASM showcase — pre-highlighted pattern snippets.
 *
 * The snippets are curated excerpts, not file reads: the page teaches the three
 * load-bearing moves (resident memory, Rust-free build, plugin-free loader), and
 * each excerpt is trimmed to exactly that move. The full sources are one docs
 * click away.
 */
import { highlight } from '$lib/server/shiki';
import type { PageServerLoad } from './$types';

const KERNEL_RS = `#[wasm_bindgen]
pub struct PixelKernel {
    width: u32,
    height: u32,
    pixels: Vec<u8>,   // JS writes through a view over pixels_ptr() — once
    scratch: Vec<u8>,  // preallocated: no filter call may grow wasm memory
}

#[wasm_bindgen]
impl PixelKernel {
    /// Filter calls cross the boundary with two scalars, never with the frame.
    pub fn box_blur(&mut self, radius: u32) { /* (2r+1)² taps per pixel */ }
    pub fn grayscale(&mut self) { /* Rec.601 integer luma */ }
}`;

const BUILD_SH = `# scripts/wasm/build.sh — the v10r container stays Rust-free
RUST_IMAGE="docker.io/library/rust:1.97-slim@sha256:8e8cf8…"  # digest-pinned

podman run --rm -v "$PWD:/work" -w /work/crates/kernel "$RUST_IMAGE" bash -c '
    cargo build --release --target wasm32-unknown-unknown
    wasm-bindgen --target web --out-dir /work/src/lib/wasm/kernel \\
      target/wasm32-unknown-unknown/release/v10r_kernel.wasm'

# kernel.js + kernel_bg.wasm (+ .d.ts) are COMMITTED, plus build-manifest.json:
# sha256 of sources and artifacts — a vitest gate recomputes them, so a Rust
# edit without a rebuild goes red. \`bun run validate\` never needs Rust.`;

const LOADER_TS = `import wasmUrl from './kernel/kernel_bg.wasm?url';

let ready: Promise<Kernel> | null = null;

export function loadKernel(): Promise<Kernel> {
	// ?url + explicit init: no Vite wasm plugins, no top-level await (broken
	// under Svelte 5 — sveltejs/kit#13015), nothing executed during SSR, and
	// the binary ships as a hashed immutable asset.
	if (!ready) {
		ready = import('./kernel/kernel.js').then(async (mod) => {
			const out = await mod.default({ module_or_path: wasmUrl });
			return { mod, memory: out.memory };
		});
	}
	return ready;
}`;

export const load: PageServerLoad = async () => {
	return {
		title: 'WebAssembly - Showcases',
		snippets: {
			kernel: await highlight(KERNEL_RS, 'rust'),
			build: await highlight(BUILD_SH, 'bash'),
			loader: await highlight(LOADER_TS, 'typescript'),
		},
	};
};
