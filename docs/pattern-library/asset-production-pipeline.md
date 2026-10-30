---
title: "Asset production pipeline (typed request → checked GLB)"
description: "A structured, validated request becomes a checked 3D asset: a deterministic TypeScript generator builds parametric geometry, an inspector proves every shell…"
category: "3D"
---

# Asset production pipeline (typed request → checked GLB)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** 3D · **Tier:** deep · **Maturity:** proven (verified 2026-10-29 @ 6a2cd80-dirty) · **Risk:** medium — real CPU per request (bounded by budget and rate limit); checks prove file and surface integrity, never structural strength

A structured, validated request becomes a checked 3D asset: a deterministic TypeScript generator builds parametric geometry, an inspector proves every shell closed and outward, a DOM-free writer emits byte-stable GLB with its derivation key inside and reads it back, and one job shape — report, PROV-DM provenance, measurements, a write-once owner-scoped store — serves an HTTP route, a CLI and MCP tools, in-process or in a killable worker process.

**When to use:** Use when an app must generate 3D assets from parameters — configurators that export, procedural parts, AI-requested variations — and every file must be reproducible, validated and attributable before anyone loads it.

## Avoid when

- The assets are authored by hand in a DCC tool and only need viewing — the model viewer pattern is enough
- The geometry needs B-rep CAD operations (fillets, STEP exchange, tolerances) — use a CAD kernel (OpenCascade via replicad) behind the same request and report
- The target needs one booleaned watertight solid (3D printing, volumes) — add a CSG union (manifold-3d) first; this pipeline proves closed shells, not a union
- Imported user files must be converted, decimated, unwrapped or baked — that is Blender's job, in a container worker with typed operations

## Alternatives

- **OpenSCAD in a container, then a mesh converter to glTF** — prefer when the models already exist as OpenSCAD scripts and CSG is the core operation
- **Headless Blender (bpy) in a CPU/GPU container worker with a closed list of scripts** — prefer when the work is conversion, retopology, baking or rendering, not parametric generation
- **Three.js GLTFExporter in the browser** — prefer when the asset never leaves one user's tab and no server-side proof or storage is needed

## Docs

- [docs/blueprint/3d/asset-production.md](/docs/blueprint/3d/asset-production) — The full pattern: engine comparison, pipeline, invariants, gates, environments, security, MCP, measurements, managed-service path, anti-patterns ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/asset-production.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/asset-production.md))

## Code

- `src/lib/asset-production/` — Framework-free core: engine, generators, mesh intermediate, inspection, GLB writer and read-back gate ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/asset-production) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/asset-production))
- `src/lib/asset-production/README.md` — The core's boundaries and one responsibility per file ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/README.md))
- `src/lib/schemas/asset-production.ts` — The request schema and the one bounds table the UI and tools read ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/asset-production.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/asset-production.ts))
- `src/lib/server/asset-production/` — Job lifecycle, report and provenance, derivation, write-once stores, in-process and isolated environments, MCP tool registry ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/asset-production) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/asset-production))
- `src/routes/api/showcases/asset-production/+server.ts` — The rate-limited HTTP adapter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/showcases/asset-production/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/showcases/asset-production/+server.ts))
- `scripts/asset-production/produce.ts` — CLI with the directory store ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/produce.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/produce.ts))
- `scripts/asset-production/worker.ts` — The isolated worker entrypoint a container would run ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/worker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/worker.ts))
- `scripts/asset-production/bench.ts` — The measurements the doc quotes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/bench.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/bench.ts))

## Tests

- `src/lib/asset-production/engine.test.ts` — Determinism, exact estimates at the bounds, sixteen refusals, cancellation and deadline, the boundary gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/engine.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/engine.test.ts))
- `src/lib/asset-production/glb.test.ts` — Khronos validator: no error or warning; GLTFLoader loads it; damaged files refused ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/glb.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/glb.test.ts))
- `src/lib/asset-production/inspect.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/inspect.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/inspect.test.ts))
- `src/lib/server/asset-production/run-job.test.ts` — Report and provenance, label-independent derivation, write-once stores, lifecycle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/run-job.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/run-job.test.ts))
- `src/lib/server/asset-production/isolated-process.test.ts` — Same bytes on Bun and Node; worker killed at deadline, on cancel and past its output cap ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/isolated-process.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/isolated-process.test.ts))
- `src/lib/server/asset-production/tools.test.ts` — MCP registry: typed operations only; code, unknown generators and over-budget requests refused ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/tools.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/tools.test.ts))
- `tests/browser/produce.spec.ts` — Playwright: generate, see the model and the report, refuse a conflict — bun run test:browser, outside validate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/tests/browser/produce.spec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/tests/browser/produce.spec.ts))

## Proof

- [`/showcases/3d/produce`](/showcases/3d/produce)

## Invariants

- Callers ask through one strict request schema — a generator id and bounded parameters; no request can name a script, a file or an engine flag.
- The budget is checked from an exact estimate before anything is built and from the real mesh after; an over-budget request costs one arithmetic pass.
- Same request, same bytes — in-process or in a worker, on V8 or JSC; the label is presentation and never enters the derivation key.
- Every exported GLB passes inspection (closed outward shells, finite values, declared envelope) and its own read-back gate; tests hold it to the Khronos validator with zero errors and warnings.
- Findings are data with a fixed severity per code; a refused or failed run returns no bytes, and a cancelled one keeps nothing.
- Stores are write-once and owner-scoped: a repeat run reuses, different bytes under a kept key are refused, and a job never publishes.
- The core imports no framework, DOM or runtime API, so the same engine runs in a function, a worker process, a terminal and a browser.

## Emulation notes

- Write the request schema and its single bounds table first; let the UI sliders and the tool description read the same table.
- Give every generator an exact estimate and test estimate = actual at every bound — that is what makes the a-priori budget honest.
- Write your own byte-stable GLB writer for generated meshes rather than exporting a scene graph; run the Khronos validator in tests.
- Start in-process; add the isolated worker (SIGKILL deadline, stripped env, capped output) before any untrusted or heavy engine, and only then a container.
- Expose AI access as typed operations through the same schema; mount the tool where calls are authenticated and metered, never on an anonymous endpoint.

## Depends on

- [Threlte integration (SSR-off, code-split model registry)](/docs/pattern-library/3d-threlte-integration)
- [Derivation key (freshness by input fingerprint)](/docs/pattern-library/derivation-key)
- [Provenance record (entity, activity, agent — PROV-DM core)](/docs/pattern-library/provenance-record)
- [Rate limiting (sliding window, fail-closed)](/docs/pattern-library/anti-abuse-rate-limiting)
- [Hosted MCP (two trust surfaces: public read-only · bearer admin)](/docs/pattern-library/architecture-hosted-mcp)

---

_Machine-readable record: `asset-production-pipeline` in `pattern-library/registry.json`._
