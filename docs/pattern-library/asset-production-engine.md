---
title: "Asset production engine"
description: "One untrusted structured request in, one checked GLB or the reasons there is none out: a generator builds a mesh from bounded parameters, the budget is…"
category: "3D"
---

# Asset production engine

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Kind:** pattern — build it in the target project

**Category:** 3D · **Tier:** deep · **Maturity:** proven (verified 2026-10-29 @ 6a2cd80-dirty) · **Risk:** medium — real CPU per run, bounded by the budget; checks prove file and surface integrity, never structural strength

One untrusted structured request in, one checked GLB or the reasons there is none out: a generator builds a mesh from bounded parameters, the budget is checked from an exact estimate before building and from the real mesh after, an inspector proves every shell closed and outward, and a DOM-free writer emits byte-stable GLB with its provenance in asset.extras and reads it back — pure computation, so the same engine runs on a server, in a worker and in a browser.

**When to use:** Use when 3D geometry is generated from parameters by code you control and every output must be bounded, deterministic and validated before anyone loads it, whether or not the result is kept.

## Avoid when

- The assets are authored by hand in a DCC tool and only need viewing — a model viewer is enough
- The geometry needs B-rep CAD operations (fillets, STEP exchange, tolerances) — put a CAD kernel behind the same request contract
- The input is existing meshes or scans to convert, decimate or bake — that is a Blender or mesh-processing worker, not a generator

## Alternatives

- **Three.js GLTFExporter in the browser** — prefer when the asset never leaves one user's tab and no server-side proof or storage is needed

## Docs

- [docs/blueprint/3d/asset-production.md](/docs/blueprint/3d/asset-production) — Engine choice, the pipeline stages, invariants 1–7 and the quality gates ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/asset-production.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/asset-production.md))

## Code

- `src/lib/asset-production/` — Framework-free core: engine, generators, mesh intermediate, inspection, GLB writer and read-back gate ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/asset-production) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/asset-production))
- `src/lib/asset-production/README.md` — The core's boundaries and one responsibility per file ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/README.md))
- `src/lib/schemas/asset-production.ts` — The request schema and the one bounds table the UI and tools read ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/asset-production.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/asset-production.ts))
- `src/lib/asset-production/engine.ts` — AssetProductionEngine: stages, the budget checked twice, cancellation and deadline checkpoints ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/engine.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/engine.ts))

## Tests

- `src/lib/asset-production/engine.test.ts` — Determinism, exact estimates at the bounds, sixteen refusals, cancellation and deadline, the boundary gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/engine.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/engine.test.ts))
- `src/lib/asset-production/glb.test.ts` — Khronos validator: no error or warning; GLTFLoader loads it; damaged files refused ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/glb.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/glb.test.ts))
- `src/lib/asset-production/inspect.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/inspect.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/inspect.test.ts))

## Invariants

- Callers ask through one strict request schema — a generator id and bounded parameters; no request can name a script, a file or an engine flag.
- The budget is checked from an exact estimate before anything is built and from the real mesh after; an over-budget request costs one arithmetic pass.
- Same request, same bytes — in-process or in a worker, on V8 or JSC; the label is presentation and never enters the derivation key.
- Every exported GLB passes inspection (closed outward shells, finite values, declared envelope) and its own read-back gate; tests hold it to the Khronos validator with zero errors and warnings.
- Findings are data with a fixed severity per code; a refused or failed run returns no bytes, and a cancelled one keeps nothing.
- The core imports no framework, DOM or runtime API, so the same engine runs in a function, a worker process, a terminal and a browser.

## Emulation notes

- Write the request schema and its single bounds table first; let the UI sliders and the tool description read the same table.
- Give every generator an exact estimate and test estimate = actual at every bound — that is what makes the a-priori budget honest.
- Write your own byte-stable GLB writer for generated meshes rather than exporting a scene graph; run the Khronos validator in tests.

## Relationships

**Part of**

- [Asset production pipeline](/docs/pattern-library/asset-production-pipeline) (required)

**Specialized by**

- [Agentic parametric modeling](/docs/pattern-library/agentic-parametric-modeling)


---

_Machine-readable record: `asset-production-engine` in `pattern-library/registry.json`._
