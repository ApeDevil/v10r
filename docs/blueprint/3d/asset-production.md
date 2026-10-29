# Asset Production

A structured, validated request becomes a checked 3D asset: parametric geometry built in
code, inspected, written as GLB with its provenance inside, measured, optionally kept in a
write-once store, and loaded into the existing Threlte viewer. One engine, one job shape, three
callers (HTTP, CLI, MCP tool). Pattern record: `asset-production-pipeline`.

## Contents

- [Why this shape](#why-this-shape) - the concerns kept apart
- [Engine choice](#engine-choice) - what was compared, and why plain TypeScript won
- [The pipeline](#the-pipeline) - request → check → generate → inspect → encode → verify → keep
- [Invariants](#invariants) - what holds, and which test holds it
- [Quality gates](#quality-gates) - what every exported asset must pass
- [Execution environments](#execution-environments) - in-process and isolated worker; GPU not built
- [Security and reliability](#security-and-reliability) - untrusted input, limits, no overwrite
- [AI and MCP](#ai-and-mcp) - typed operations, never code
- [Measurements](#measurements) - real numbers, where they come from
- [Showcase](#showcase) - `/showcases/3d/produce`
- [Toward a managed service](#toward-a-managed-service) - proposals, not built
- [Anti-patterns](#anti-patterns)
- [Proof](#proof) - the tests and pages behind the record
- [Emulating it](#emulating-it)

## Why this shape

"Generate a model" tends to become one function that reads form fields, builds meshes, calls an
exporter, writes a file and returns a URL. Each concern then blocks the others: the exporter
cannot be swapped, the job cannot move to a worker, an AI cannot call it safely, and nobody can
say which code made a file. This pattern keeps ten things apart:

| Concern | Lives in | Knows nothing about |
|---|---|---|
| Request schema — the only way to ask | `src/lib/schemas/asset-production.ts` | how geometry is made |
| Generator — parameters → mesh, deterministic | `src/lib/asset-production/generators/` | GLB, storage, HTTP |
| Mesh intermediate — primitives, shells, envelope | `src/lib/asset-production/mesh.ts` | which generator or engine made it |
| Inspection and gates | `inspect.ts`, `glb.ts` (`readGlb`), `engine.ts` | the request's meaning |
| Engine adapter — stages, budget, cancellation | `engine.ts` (`AssetProductionEngine`) | where it runs |
| Execution environment | `src/lib/server/asset-production/{in-process,isolated-process}.ts` | the geometry |
| Output artifact — byte-stable GLB with `asset.extras` | `glb.ts` (`encodeGlb`) | the store |
| Storage adapter — write-once, owner-scoped | `store.ts` (`AssetStore`) | how assets are made |
| Job lifecycle and report | `job.ts`, `run-job.ts`, `src/lib/asset-production/report.ts` | the transport |
| Provenance and measurements | `derivation.ts`, the report | the viewer |
| Viewer / presentation | `src/routes/…/showcases/3d/produce/` | how the GLB was made |

The core (`src/lib/asset-production/`) imports only its schema, Valibot and Three.js's
`Vector3`: no Svelte, no DOM, no Node API. The same engine runs in a serverless function, a
child process, a terminal and a browser — the showcase uses it client-side for the live
estimate and the parameter rules before it sends anything.

Vocabulary: **asset production** — always qualified, because bare `production` is the deployed
environment. `AssetRequest`, `AssetGenerator`, `AssetProductionEngine`, `EngineRun`,
`AssetExecutionEnvironment`, `AssetJob`, `AssetReport`, `AssetStore`. See `docs/naming.md`.

## Engine choice

Decision principle: the simplest engine that meets the initial requirements — parametric,
deterministic, GLB out, cheap to run, no new infrastructure. Compared against those, not
against feature lists.

| Option | Headless + scriptable | GLB out | Footprint | Determinism | Runs on Vercel / in the browser | Verdict |
|---|---|---|---|---|---|---|
| **A. Plain TypeScript** (Three.js math + own builders + own GLB writer) | yes | yes, own writer (~200 lines) | 0 new runtime deps (Three.js is already shipped) | byte-identical across Bun (JSC) and Node (V8) — measured | yes / yes | **chosen** |
| A′. Three.js `GLTFExporter` | yes | yes | in repo | — | needs `Blob`/`FileReader`; not DOM-free on the server | rejected: the DOM dependency is the problem the writer removes |
| A″. CSG in JS (`manifold-3d` WASM 2.8 MB unpacked, `three-bvh-csg`, `@jscad/modeling` 1.6 MB) | yes | via a writer | +1 dep each | manifold: deterministic | yes / yes | not needed yet: overlapping closed shells render correctly; add **manifold-3d** when a target needs one booleaned solid (3D printing, volume) |
| A‴. OpenCascade (`replicad` 6.8 MB, `opencascade.js` 67 MB unpacked) | yes | via STEP/STL → convert | heavy WASM | B-rep kernel | serverless cold start suffers | only for true CAD (fillets, STEP exchange) |
| **B. OpenSCAD** | yes (CLI) | no native glTF: STL/OFF/AMF/3MF, then a converter | native binary (tens of MB) + container | the Manifold backend is fast; CGAL is slow | no — needs a container worker | rejected now: a second language, a container, and a conversion step for no capability this slice needs |
| **C. Blender** (`blender -b --python`, or `bpy` from PyPI) | yes | yes (built-in exporter) | several hundred MB; Python pinned to Blender's | add-on and version-dependent | no — a container worker, ideally per job | rejected now; it is the right tool for **conversion, retopology, baking, rendering previews** of imported assets — see below |
| D. Server-side CAD APIs (Onshape, APS) | yes | yes | paid API, network | vendor's | no | rejected: paid, external, not portable |

Footprints for B and C are from the projects' published distributions, not measured in this
repository; the npm sizes are `npm view <pkg> dist.unpackedSize` on 2026-10-29.

**When Blender earns its place.** When a demonstrated requirement needs what only a DCC tool
does — importing arbitrary user files (FBX, OBJ, USD), decimation, UV unwrapping, baking,
thumbnails rendered with Cycles. Then: a separate CPU container worker (`--network=none`,
memory and CPU caps, read-only image, scratch volume), driven by a **closed list of typed
operations** that map to fixed, versioned Python scripts in the image. Never `--python-expr`
with caller text, never an MCP tool that forwards Python, never add-ons installed at run time.
It slots in as another `AssetExecutionEnvironment` plus an engine adapter; the request schema,
report, store and viewer stay.

## The pipeline

```
AssetRequest (untrusted JSON)
  └─ check     strict Valibot parse · cross-parameter rules · exact estimate vs budget
  └─ generate  generator(parameters, checkpoint) → GeneratedMesh { primitives, envelope }
  └─ inspect   counts · bounds · closed + outward shells · finite · unit normals · envelope
  └─ encode    byte-stable GLB · asset.extras.v10r = { transform, requestDigest, derivationKey }
  └─ verify    read the GLB back · byte budget
  └─ keep?     AssetStore.put(owner/derivationKey) — created | reused | conflict
  └─ AssetReport { output, derivation, engine, generator, environment, inspection,
                   diagnostics, measurements, provenance (PROV-DM) }
```

Stages are timed separately. A refused request never reaches `generate`; a failed one never
returns bytes. Findings are `AssetDiagnostic`s with a fixed severity per code
(`diagnostics.ts`), never exceptions.

The demonstration generator is a **structural ring**: a square-section truss bent into a ring
(Warren, single-direction or X bracing), spokes to a capped hub with docking ports, and boxed
modules on the outer chords. Nine bounded numeric parameters and one pick list; from 1,248 to
68,352 triangles. Every strut is a capped tube, every module a box: each is a closed shell.

**Derivation and provenance.** The derivation key is the repository's `derivationKey`
(`src/lib/server/db/content-hash.ts`) over `procedural-ts@1/structural-ring@1` and the request's
canonical JSON (sorted keys, label excluded — it is presentation). Same key ⇒ same bytes; that
is what makes a repeat run a cache hit and a byte mismatch a loud `store.conflict`. The report's
`provenance` is the PROV-DM core of `docs/blueprint/integrity/derivation.md`: the entity
(sha256), the activity (transform, start, end), the agent (`human` / `software` / `ai`, with
`onBehalfOf`) — never an IP or an email.

## Invariants

| # | Invariant | Held by |
|---|---|---|
| 1 | The core imports no framework, DOM or runtime API | the boundary gate in `engine.test.ts` |
| 2 | Untrusted input is refused before any geometry is built: unknown keys, unknown generators, strings for numbers, NaN, ±Infinity, out-of-range values, cross-parameter conflicts, over-budget estimates | `engine.test.ts` (16 refusal cases) |
| 3 | The budget is checked from an exact estimate before building and from the real mesh after | `engine.test.ts` (estimate = actual at the bounds) |
| 4 | Deterministic: the same request gives the same bytes, in-process and in a worker, on V8 and on JSC | `engine.test.ts`, `isolated-process.test.ts` |
| 5 | Every exported file passes the Khronos glTF validator with no error or warning, and loads in Three.js `GLTFLoader` | `glb.test.ts` |
| 6 | A damaged GLB is refused by the read-back gate | `glb.test.ts` |
| 7 | Cancellation and deadlines stop a run and keep nothing; an isolated worker is killed, never orphaned | `engine.test.ts`, `isolated-process.test.ts` |
| 8 | The store never overwrites: repeat = reuse, mismatch = conflict with the kept asset untouched; keys cannot leave their owner | `run-job.test.ts` |
| 9 | A job never publishes: kept assets are owner-scoped drafts | `run-job.test.ts`, `tools.test.ts` |
| 10 | An agent can ask only for typed operations; code, unknown tools and unknown generators are refused | `tools.test.ts` |

## Quality gates

| Gate | Where | Severity |
|---|---|---|
| Strict schema, bounded numbers, integer fields | `check` | error `request.invalid` |
| Cross-parameter rules (one spoke, hub through the truss, members thicker than the section, bays shorter than members, more modules than bays) | generator `check` | error `parameter.conflict` |
| Triangle and vertex budget, from the estimate | `check` | error `budget.*` |
| Finite positions and normals; indices in range; no zero-area triangle | `inspect` | error |
| Every shell closed (each welded edge used exactly twice) and outward (positive signed volume) | `inspect` | error `mesh.open-shell` / `mesh.inverted-shell` |
| Inside the envelope the generator declared from its parameters | `inspect` | error `mesh.outside-envelope` |
| Normals unit length; estimate equals what was built | `inspect` | warning |
| GLB framing, JSON, bufferViews, accessors, POSITION min/max, indices — read back | `verify` | error `glb.malformed` |
| GLB byte budget | `verify` | error `budget.bytes` |
| Khronos validator: 0 errors, 0 warnings | tests (`gltf-validator`, dev only) | — |

"Closed" is per shell. Overlapping struts are separate closed shells, not one booleaned solid:
right for rendering, not for 3D printing (add a CSG union first).

## Execution environments

| Environment | Isolation | Stops by | Built |
|---|---|---|---|
| `in-process` (the HTTP function, the CLI default) | none beyond the budget | cooperative checkpoints (per bay, per stage) against the deadline and `AbortSignal` | yes |
| `isolated-process` (`createIsolatedProcessEnvironment`, CLI `--isolated`) | own process and heap, env stripped to `PATH`, capped stdout | SIGKILL at the deadline, on cancel, or past the output cap; exit awaited | yes |
| CPU container worker | + `--network=none --memory --cpus --read-only` | same protocol as the isolated worker (`scripts/asset-production/worker.ts` is the entrypoint) | no — documented |
| GPU worker | — | — | no: no operation here needs a GPU |

## Security and reliability

- **Inputs are untrusted.** Strict objects, closed numeric ranges, a discriminated generator id.
  The request cannot name a file, a script, a URL or an engine flag. Bodies over 4 KiB are
  refused before parsing; the HTTP route rate-limits per IP before any geometry (20 / minute).
- **Work is bounded before it starts.** The estimate is exact, so an oversized request costs
  one arithmetic pass. Inside a run the deadline is carved from the request's own `Deadline`.
- **No uncontrolled processes.** The isolated worker is killed with SIGKILL at its deadline and
  its exit is awaited before the job resolves.
- **No overwrite, no publish.** Write-once by derivation key; a directory store writes to a
  staging directory renamed into place in one step; keys are `[a-z0-9-]` segments resolved
  under the root. A kept asset is a draft; publishing is a separate, explicit act (not built).
- **Imported assets.** This slice imports none. A future import path reads GLB with the same
  `readGlb` gate first, in the isolated environment, with the same byte budget.
- **Privacy.** The showcase stores nothing and reports no identity; the agent is "showcase
  visitor".

## AI and MCP

`createAssetToolRegistry()` is a `ToolRegistry` for the hosted MCP transport with two tools:
`describe_asset_generators` (parameters, bounds, budget) and `produce_asset` (the request schema
as its JSON Schema input; returns the report as text and keeps an owner-scoped draft). An agent
creates a variation by changing typed parameters, reads the findings, and tries again — the same
propose → check → revise loop as the PIM transform recipe, with no free-form code anywhere.

It is **not mounted** on the public `/api/mcp` endpoint, by decision: `produce_asset` spends
CPU per call, and anonymous compute belongs behind the showcase route's rate limit. Mount it on
an authenticated endpoint (admin, or per-user with a quota) — one registry line. No AI provider
is involved anywhere; everything works without one.

## Measurements

`bun run asset:bench --runs 20`, 2026-10-29, cloud container: Intel Xeon @ 2.80 GHz, 4 vCPUs,
Linux x64. p50 / p95 over 20 in-process runs (5 isolated), first run included. Node 22.22
(what Vercel runs) via `node --experimental-strip-types scripts/asset-production/bench.ts`:

| Case | Triangles | GLB | In-process total p50 / p95 | CPU p50 | Isolated worker total p50 | Same bytes every run |
|---|---|---|---|---|---|---|
| minimal (8 bays, 3 facets) | 1,248 | 43 KiB | 10.2 / 22.7 ms | 7.4 ms | 119 ms | yes |
| default (24 bays) | 9,800 | 306 KiB | 18.6 / 26.1 ms | 15.7 ms | 153 ms | yes |
| largest in bounds | 68,352 | 2,457 KiB | 71.0 / 104.4 ms | 85.8 ms | 315 ms | yes |

Under Bun 1.3.12 the in-process totals are 10.3 / 24.4 / 103.8 ms. Largest-case stage split on
Node: generate 22 ms, inspect 34 ms, encode 3 ms, verify 2 ms. Inspection dominates; it is the
price of the shell check. The isolated worker adds ~100–150 ms of process start and module load
per run (its RSS after a run: 67–130 MiB).

What this implies, not measured on Vercel: the largest request is ~0.1 s of CPU in a function,
so the showcase is cheap per run; the cost risk is volume, which the rate limit bounds. The GLB
travels base64 in JSON — 2.5 MB becomes ~3.3 MB, under Vercel's 4.5 MB response cap. Browser
parse and paint times are shown live on the page; they are not quoted here because they depend
on the visitor's device. Browsers: anything that runs the existing Threlte showcases (WebGL 2);
without WebGL the page still produces the asset and shows its report.

## Showcase

`/showcases/3d/produce`: presets (outpost, default, station), a slider per parameter and the
bracing pick list, a live estimate and the parameter rules computed in the browser by the same
core, Generate / Cancel, the model in a Threlte canvas (on-demand rendering, studio light,
`<svelte:boundary>` fallback), and four panels — validation (every gate, or every finding),
output (size, counts, shells, extent, sha256, derivation key, download GLB and report), engine
(engine, generator, environment, runtime, budget), measurements (server stages and CPU, round
trip, browser parse, time to paint).

## Toward a managed service

Proposals — none of this is built, and none needs a paid provider for the slice above.

| Need | Extension point | Reuse |
|---|---|---|
| Queued, user-scoped jobs | persist `AssetJob` rows; claim with a lease | `durable-step-execution` |
| Scheduling, retries, sweeping stale jobs | a job slug | `jobs-scheduler` |
| Persistent project storage | an `AssetStore` on R2 with `If-None-Match: *` puts | `databases-object-storage` (`#lib/server/store`) |
| Bounded CPU / memory / disk | the isolated worker in a container with limits | `architecture-external-service` |
| Quotas and cost accounting | per-owner triangle·seconds from `measurements`, checked before `check` | `anti-abuse-ai-budget` |
| Approval for expensive runs | estimate → proposal → approve → run | `deskbot-approval-gate` |
| Cancellation of queued jobs | `queued → cancelled`; running → kill the worker | `job.ts` moves |
| GPU work (baking, rendering) | another environment + a Blender adapter with typed operations | above |

## Anti-patterns

- **Unrestricted engine scripting** — a tool or form field that forwards Python or OpenSCAD
  source. Typed operations only.
- **A heavy engine for light geometry** — Blender or a CAD kernel for meshes plain code builds
  in milliseconds.
- **Exporting from the scene graph** — `GLTFExporter` in the server drags the DOM in and makes
  bytes depend on renderer state.
- **Trusting the estimate alone** — the budget is checked again on what was really built.
- **Overwriting by name** — `ring.glb` replaced in place. Key by derivation, write once.
- **Timestamps in the asset** — they break byte identity; times belong in the report.
- **Publishing from the job** — a job produces a draft; publishing is the owner's act.
- **Claiming structural validity** — the gates check the file and its surfaces, never strength.

## Proof

| Surface | What it shows |
|---|---|
| `src/lib/asset-production/engine.test.ts` | the pipeline, determinism, exact estimates, 16 refusals, cancellation and deadline, the boundary gate |
| `src/lib/asset-production/glb.test.ts` | Khronos validator clean (16- and 32-bit indices), `GLTFLoader` loads it, damaged files refused |
| `src/lib/asset-production/inspect.test.ts` | every inspection finding on a crafted defect |
| `src/lib/server/asset-production/run-job.test.ts` | report, provenance, label-independent derivation, write-once memory and directory stores, lifecycle |
| `src/lib/server/asset-production/isolated-process.test.ts` | same bytes on Bun and Node; kill at deadline, on cancel, past the output cap; failed start |
| `src/lib/server/asset-production/tools.test.ts` | the MCP registry: schema, describe, produce a draft, refuse code / unknown generator / over budget / unknown tool |
| `/showcases/3d/produce` | the live slice, generation to presentation |
| `tests/browser/produce.spec.ts` | Playwright: the page generates, shows the model and the report, refuses a conflict (`bun run test:browser`) |
| `bun run asset:produce`, `bun run asset:bench` | the CLI with the directory store; the measurements above |

## Emulating it

1. Write the request schema first: a discriminated generator id, strict objects, closed ranges
   from one bounds table your UI and tool description also read.
2. Write the generator against a mesh intermediate with shells and a declared envelope, plus an
   exact `estimate`. Test estimate = actual at every bound.
3. Add inspection and a DOM-free, byte-stable GLB writer with a read-back gate; run the Khronos
   validator in tests.
4. Wrap it in an engine with timed stages, a budget checked twice and checkpoints.
5. Put the job, report, derivation key and write-once store around it; then the callers (route
   with a rate limit, CLI, MCP registry).
6. Present last: the viewer loads the GLB the job returned, nothing else.
