# Asset production pipeline

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** 3D · **Tier:** deep · **Maturity:** proven (verified 2026-10-29 @ 6a2cd80-dirty) · **Risk:** medium — real CPU per request (bounded by budget and rate limit); checks prove file and surface integrity, never structural strength

A structured, validated request becomes a checked 3D asset through the asset production engine, and one job shape around it — report, PROV-DM provenance, the derivation key, measurements and a write-once owner-scoped store when the asset is kept — serves an HTTP route, a CLI and MCP tools, in-process or in a killable worker process.

**When to use:** Use when an app must generate 3D assets from parameters — configurators that export, procedural parts, AI-requested variations — and every file must be reproducible, validated and attributable before anyone loads it.

**Needs:** required key-value-store (via rate-limiting), relational-db (via provenance-record)

## Avoid when

- The assets are authored by hand in a DCC tool and only need viewing — the model viewer pattern is enough
- The geometry needs B-rep CAD operations (fillets, STEP exchange, tolerances) — use a CAD kernel (OpenCascade via replicad) behind the same request and report
- The target needs one booleaned watertight solid (3D printing, volumes) — describe it as a parametric model (agentic-parametric-modeling), which runs Manifold through the same engine without keeping anything
- Imported user files must be converted, decimated, unwrapped or baked — that is Blender's job, in a container worker with typed operations

## Alternatives

- **OpenSCAD in a container, then a mesh converter to glTF** — prefer when the models already exist as OpenSCAD scripts and CSG is the core operation
- **Headless Blender (bpy) in a CPU/GPU container worker with a closed list of scripts** — prefer when the work is conversion, retopology, baking or rendering, not parametric generation
- **Three.js GLTFExporter in the browser** — prefer when the asset never leaves one user's tab and no server-side proof or storage is needed

## Docs

- `docs/blueprint/3d/asset-production.md` — The full pattern: engine comparison, pipeline, invariants, gates, environments, security, MCP, measurements, managed-service path, anti-patterns ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/asset-production.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/asset-production.md))

## Code

- `src/lib/server/asset-production/` — Job lifecycle, report and provenance, derivation, write-once stores, in-process and isolated environments, MCP tool registry ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/asset-production) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/asset-production))
- `src/routes/api/showcases/asset-production/+server.ts` — The rate-limited HTTP adapter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/showcases/asset-production/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/showcases/asset-production/+server.ts))
- `scripts/asset-production/produce.ts` — CLI with the directory store ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/produce.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/produce.ts))
- `scripts/asset-production/worker.ts` — The isolated worker entrypoint a container would run ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/worker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/worker.ts))
- `scripts/asset-production/bench.ts` — The measurements the doc quotes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/bench.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/bench.ts))

## Tests

- `src/lib/server/asset-production/run-job.test.ts` — Report and provenance, label-independent derivation, write-once stores, lifecycle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/run-job.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/run-job.test.ts))
- `src/lib/server/asset-production/isolated-process.test.ts` — Same bytes on Bun and Node; worker killed at deadline, on cancel and past its output cap ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/isolated-process.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/isolated-process.test.ts))
- `src/lib/server/asset-production/tools.test.ts` — MCP registry: typed operations only; code, unknown generators and over-budget requests refused ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/asset-production/tools.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/asset-production/tools.test.ts))
- `tests/browser/produce.spec.ts` — Playwright: generate, see the model and the report, refuse a conflict — bun run test:browser, outside validate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/tests/browser/produce.spec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/tests/browser/produce.spec.ts))

## Proof

- [`/showcases/3d/produce`](https://www.v10r.dev/showcases/3d/produce)

## Invariants

- Stores are write-once and owner-scoped: a repeat run reuses, different bytes under a kept key are refused, and a job never publishes.

## Emulation notes

- Start in-process; add the isolated worker (SIGKILL deadline, stripped env, capped output) before any untrusted or heavy engine, and only then a container.
- Expose AI access as typed operations through the same schema; mount the tool where calls are authenticated and metered, never on an anonymous endpoint.

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Rate limiting](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/rate-limiting.md) — Public generation is rate limited before anything is built; the target's own limiter satisfies it.

**Composes (constituents of its solution)**

- [Asset production engine](asset-production-engine.md) — required: Every job runs one engine request: the engine checks, builds, inspects and encodes; the job adds the report, provenance, derivation and store around it.
- [Derivation key](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/derivation-key.md) — required: The written GLB carries its derivation key and is current exactly while a recomputed key matches.
- [Provenance record](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/provenance-record.md) — required: Every job records PROV-DM provenance of the asset it produced.
- [Hosted MCP](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/hosted-mcp.md) — conditional when agents call the pipeline over MCP: The same job shape serves MCP tools; when agents must reach it, it is served by an MCP endpoint.
- [Threlte integration](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/threlte-integration.md) — optional when the app shows the produced asset in a native viewer: A viewer presents the checked asset; production and inspection do not need it.

**Assumes (platform conventions in scope)**

- [Multi-client core](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/multi-client-core.md) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `asset-production-pipeline` in `pattern-library/registry.json`._
