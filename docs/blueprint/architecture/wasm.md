# WebAssembly (Rust)

A Rust compute kernel compiled to wasm, vendored into the repo, benchmarked honestly against its own line-for-line JS twin. The showcase is `/showcases/wasm`; the crate is `crates/kernel`; the client module is `src/lib/wasm/`.

Wasm is not performance pixie dust — a warmed JS JIT compiles numeric loops to machine code that can approach, and sometimes beat, wasm. Wasm earns its place when work is **compute-dense over typed data that rarely crosses the JS↔wasm boundary**: convolution, physics, signal processing, hashing. It loses on strings (UTF-16→UTF-8 transcode + copy per crossing), on chatty per-call buffer copies, and on allocation-heavy object graphs, where engine GCs are deeply optimized while a wasm module ships and warms its own allocator. How much wasm wins is **empirical, not intrinsic**: the IMC '21 measurements (Yan et al. — Chrome 79-era engines, so the exact ratios are historical) swing from JS-parity to >20× with browser, platform, compiler and input size. This kernel's blur lands around 2–4× in 2026 engines — that is this workload's number, not a wasm constant; a 10× claim usually hides an unwarmed JS baseline, uncounted copies, or a strawman.

---

## Toolchain

`cargo build --target wasm32-unknown-unknown` + `wasm-bindgen-cli --target web`. Nothing else.

- **wasm-bindgen is alive** (new `wasm-bindgen` GitHub org after the 2025 rustwasm sunset; monthly releases). The CLI version must exactly equal the `wasm-bindgen` crate version — it hard-errors on mismatch, so both are pinned to the same literal.
- **wasm-pack is skipped deliberately**: its bundled wasm-opt goes stale against new rustc output (bulk-memory, reference-types), and it emits an npm `package.json` plus a `.gitignore` into its own output dir that silently un-commits vendored artifacts unless `--no-gitignore` is passed. The raw two-step pipeline is what wasm-pack runs internally anyway.
- **No Vite plugins.** `vite-plugin-wasm` + `vite-plugin-top-level-await` exist for `--target bundler` output; the TLA plugin's async-IIFE rewrite breaks component construction under Svelte 5 (sveltejs/kit#13015). `--target web` output needs neither.
- **wasm-opt is skipped** for now: the kernel is ~20 KB and speed-profiled; binaryen version skew is a recurring failure class not worth buying for nothing.

## Build and vendoring

`scripts/wasm/build.sh` (host-side, NOT a `vr` command) runs the whole build in an **ephemeral `rust:` container** — the v10r dev container stays Rust-free and `bun run validate` never needs a toolchain. Output lands in `src/lib/wasm/kernel/` and is **committed**: glue JS, `.d.ts`, the `.wasm` binary, and `build-manifest.json`, exactly like generated autoconf output in C projects whose contributors lack autotools.

Reproducibility is pinned four ways, changed together: the builder image **digest** in `build.sh` (a tag is a mutable alias; the recorded digest is what actually constrains the bytes), `crates/kernel/rust-toolchain.toml`, `crates/kernel/Cargo.lock`, and the wasm-bindgen version (crate + CLI). Named podman volumes cache the crate registry and the compiled CLI, so rebuilds are seconds, not minutes.

The manifest is the freshness contract: `build.sh` records sha256 hashes of the crate sources and the emitted artifacts, and `kernel-manifest.test.ts` recomputes them in the gate. A Rust-only edit without a rebuild goes red even though the gate never runs Rust — the parity test alone cannot catch it, because it compares the JS twins against the (stale) committed binary and passes.

Rules the vendored directory lives by:

- `src/lib/wasm/kernel` is biome-excluded (`biome.json` `files.includes`), next to the paraglide precedent — machine-formatted glue must not fight the formatter.
- **Never add the vendored package to `package.json`.** A `file:` dependency would rewrite `bun.lock` and trip the container's `--frozen-lockfile` startup guard. Import by path only.
- Never reference the `.wasm` binary from a deep-tier pattern record — the excerpt builder rejects binaries.
- `crates/kernel/target/` is gitignored; the vendored artifacts are not.

## Loading

`src/lib/wasm/index.ts` is the only loader, and its shape closes every known dev-vs-build wasm divergence in Vite/SvelteKit at once:

```ts
import wasmUrl from './kernel/kernel_bg.wasm?url';
// lazy:  import('./kernel/kernel.js') → await mod.default({ module_or_path: wasmUrl })
```

- `?url` emits the binary as a hashed immutable asset and hands back a string — nothing to execute at SSR time. The glue's own internal `new URL('…_bg.wasm', import.meta.url)` fallback is exactly what breaks elsewhere (executed during prerender, rewritten to `{}.url` by some build paths, 404s when the glue lives in `node_modules`); passing an explicit URL bypasses it entirely.
- The **object argument form is required** — `init(url)` is deprecated since wasm-bindgen 0.2.93 and logs a console warning.
- Dynamic import + module-level singleton: the glue never enters the SSR module graph, and SPA remounts don't refetch/recompile. A failed init resets the singleton so retry is possible.
- Workers import the same loader. The message handler must be installed **synchronously** at worker top level with init awaited *inside* the handler — awaiting init before installing the handler drops any message posted during compile.

Server-side wasm is deliberately not a runtime pattern here (undici's `fetch` rejects `file:` URLs, so the default init path dies under Node). It IS proven as a test path: `kernel-parity.test.ts` loads the module in vitest's node env via `readFile` → `WebAssembly.compile` → `init({ module_or_path: module })`.

## Memory discipline

All heavy data is **resident in wasm linear memory**; JS reads/writes through `TypedArray` views and calls cross the boundary with scalars only. Two invalidation rules, both encoded in the kernel's doc comments:

1. **Growth detaches.** Any wasm allocation that grows memory detaches every outstanding view over `memory.buffer`. The kernel preallocates all scratch in its constructor so no compute call can grow.
2. **Pointers move.** `box_blur` swaps its internal buffers, so `pixels_ptr()` differs between calls. Views are re-taken from a fresh `ptr()` call around every kernel invocation — never cached.

The deliberate counter-example stays in the code: `scale_copied(&[f32]) -> Vec<f32>` makes wasm-bindgen copy the array in and out per call, and the showcase shows it losing to plain JS. Do not "fix" it.

## Honest benchmarking

The parity + protocol rules the showcase enforces, reusable for any future kernel:

1. **Identical algorithm both sides, proven** — integer math (or exactly-representable floats) and a vitest parity gate comparing outputs byte-for-byte; the page's FNV-1a checksums are only the concise UI indicator. The parity gate is paired with the freshness manifest above — parity against a committed artifact cannot see a stale binary on its own.
2. **Warm both engines untimed** — cold JS runs in the interpreter and loses by default.
3. **Counterbalance timed rounds** — which lane goes first alternates every round (rotations for three lanes), timings stored by lane, not position. Adjacent-but-fixed order keeps position bias (cache warmth, thermal drift) even in dedicated bench libraries.
4. **Medians with min–max spread**, never means.
5. **Show the one-time init cost and the per-call boundary copies as their own numbers** — end-to-end wins are the only wins that count. "End-to-end" means JS-owned input to JS-owned output: the JS lane carries no copy stages because its data never leaves JS memory — that asymmetry is the exhibit, and harness resets stay untimed on both sides. The grayscale filter ships as the control (memory-bound, wasm ≈ JS) next to the blur hero (compute-bound, wasm wins) so the page argues the boundary, not just the victory.

## Production notes

- **CSP**: `script-src 'wasm-unsafe-eval'` is required and already set in `svelte.config.js`. Never "fix" an eval problem by adding `'unsafe-eval'` — it overrides and widens the wasm grant.
- **MIME**: `WebAssembly.instantiateStreaming` requires `Content-Type: application/wasm`; the glue falls back to `ArrayBuffer` instantiation with a console warning if a host mis-serves it. A wasm error quoting unexpected magic bytes is a mis-served *body*: `4e 6f 74 20` is "Not " (a 404 page), `3c 21 44 4f` is "<!DO" (an HTML error page).
- **Service worker**: the `?url` asset is Vite build output and therefore precached by the PWA service worker — ~20 KB per deploy, accepted. A multi-MB module should move to `static/` + manual fetch instead (not precached, but also not hashed).
- **Old Safari tail**: Rust ≥1.82 emits reference-types and multivalue by default, and the wasm32 default feature set keeps growing (bulk memory, non-trapping float-to-int are also on). Per webassembly.org's feature table all of these landed by **Safari 15**, so Safari ≤14 fails to instantiate — 16.4 is the fixed-width-SIMD milestone and irrelevant to this artifact. Init failures surface as the showcase's unsupported/error state, not a blank page.
- **Not done, on purpose**: SIMD (`+simd128` is baseline-safe in 2026 browsers but needs a two-artifact `WebAssembly.validate()` feature-detect to keep the ~5% tail; add only with a workload that earns it) and threads (`SharedArrayBuffer` needs site-wide COOP/COEP, which would break third-party embeds — rejected).
