---
title: "Rust→wasm compute kernel (vendored, plugin-free)"
description: "Rust crate compiled to wasm in an ephemeral container, artifacts vendored into src/lib/wasm/kernel/, loaded via ?url + explicit init with zero Vite plugins…"
category: "Architecture & Request Pipeline"
---

# Rust→wasm compute kernel (vendored, plugin-free)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** low — browser-only compute, no external services; rebuilds need only podman

Rust crate compiled to wasm in an ephemeral container, artifacts vendored into src/lib/wasm/kernel/, loaded via ?url + explicit init with zero Vite plugins, benchmarked honestly against a line-for-line JS twin with a vitest parity gate.

**When to use:** Reach for it when a browser workload is compute-dense over typed data (convolution, physics, hashing) and the data can stay resident in wasm linear memory — and to see why string-heavy or per-call-copy workloads should stay in JS.

## Docs

- [docs/blueprint/architecture/wasm.md](/docs/blueprint/architecture/wasm) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/wasm.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/wasm.md))

## Code

- `crates/kernel/src/lib.rs` — The Rust kernel — resident buffers, scalars-only boundary, deliberate marshalling counter-example. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/crates/kernel/src/lib.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/crates/kernel/src/lib.rs))
- `src/lib/wasm/index.ts` — The loader: ?url + init({ module_or_path }), dynamic import, singleton — no Vite plugins. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/index.ts))
- `src/lib/wasm/filters.ts` — Line-for-line JS twins of the kernel; integer math keeps both engines byte-identical. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/filters.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/filters.ts))
- `src/lib/wasm/kernel-bench.worker.ts` — Worker shell — handler installed synchronously, counterbalanced warm-up/timed protocol. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel-bench.worker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel-bench.worker.ts))
- `scripts/wasm/build.sh` — Ephemeral rust: container build; digest-pinned image + rust-toolchain.toml + Cargo.lock + bindgen version; emits the freshness manifest. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/wasm/build.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/wasm/build.sh))

## Tests

- `src/lib/wasm/kernel-parity.test.ts` — Parity gate: committed wasm artifact vs JS twins, byte-identical, loaded under plain Node. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel-parity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel-parity.test.ts))
- `src/lib/wasm/kernel-manifest.test.ts` — Freshness gate: recomputes build-manifest.json hashes so a Rust edit without a rebuild goes red — without Rust in the gate. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel-manifest.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel-manifest.test.ts))
- `src/lib/wasm/filters.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/filters.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/filters.test.ts))

## Proof

- [`/showcases/wasm`](/showcases/wasm)

---

_Machine-readable record: `architecture-wasm-kernel` in `mcp/patterns.registry.json`._
