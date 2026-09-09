---
title: "Main-thread budget (worker → WASM, each step measured)"
description: "Expensive browser work moves off the main thread only where measurement justifies it: cheap stays inline, noticeable CPU work goes to a Web Worker, and WASM…"
category: "Runtime Velocity"
---

# Main-thread budget (worker → WASM, each step measured)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — a worker boundary is a serialization contract

Expensive browser work moves off the main thread only where measurement justifies it: cheap stays inline, noticeable CPU work goes to a Web Worker, and WASM is reached for last — benchmarked against a line-for-line JS implementation including transfer cost.

**When to use:** Use for large parsing, image processing, graph layout, data crunching or expensive editor operations — anything that would otherwise block input and rendering.

## Docs

- [docs/blueprint/velocity/runtime.md#main-thread-budget--compute-isolation](/docs/blueprint/velocity/runtime) — The decision hierarchy and what a benchmark must include ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))
- [docs/blueprint/architecture/workers.md](/docs/blueprint/architecture/workers) — The worker implementation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/workers.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/workers.md))

## Code

- `src/lib/workers/` — Image analysis off the main thread ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/workers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/workers))
- `src/lib/wasm/` — Vendored Rust kernel, loaded via ?url with explicit init ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/wasm) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/wasm))

## Tests

- `src/lib/wasm/kernel-parity.test.ts` — The WASM and JS implementations must agree before either is benchmarked ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel-parity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel-parity.test.ts))

## Proof

- [`/showcases/workers`](/showcases/workers)
- [`/showcases/wasm`](/showcases/wasm)

## Invariants

- Heavy compute does not unnecessarily block user input.
- Worker and WASM boundaries are justified by measurement, not by expectation.
- Serialization and transfer costs are inside the benchmark — without them a WASM comparison measures two different problems.
- Parity between the fast implementation and the reference one is proven before speed is claimed.

## Emulation notes

- Pin the worker output format explicitly (`worker.format: 'es'`); a dev/prod format difference is a trap that only appears in the production build.
- Vendor WASM artifacts rather than building them at install time: the toolchain is a much larger dependency than the output, and the build can run in an ephemeral container instead.

---

_Machine-readable record: `main-thread-budget` in `pattern-library/registry.json`._
