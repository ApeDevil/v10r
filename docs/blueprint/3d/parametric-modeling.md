# Parametric Modeling (MCP 3D)

An assistant describes a solid as a **parametric model** — a typed feature graph of
parameters, operations and outputs, never code — and one deterministic engine builds it,
wherever it runs: the MCP 3D server, the visitor's browser, a test, a CLI. Nothing is stored.
The definition *is* the model; every call and every **model link** carries all of it.

> Status (2026-11-26): implemented and tested on the feature branch, now behind OAuth
> ([mcp-authorization.md](../architecture/mcp-authorization.md)); not deployed, and not yet
> exercised in a real MCP host with authorization (§ Host compatibility). Registry maturity: `implemented`.

## Contents

- [Responsibilities](#responsibilities) — who does what, and where each layer lives
- [The parametric model](#the-parametric-model) — the definition format and its limits
- [Engine choice](#engine-choice) — Manifold over JSCAD and three-bvh-csg, by measurement
- [Evaluation](#evaluation) — from definition to checked GLB
- [MCP 3D](#mcp-3d) — the separate service, its tools and its access (an account, via OAuth)
- [Viewing](#viewing) — the MCP App, the native viewer, model links
- [Statelessness](#statelessness) — what is never kept, and how a model is reproduced
- [Safety](#safety) — limits, refusal, cancellation, no logging
- [Performance](#performance) — measured, per workload and runtime
- [Token cost](#token-cost) — measured against code-generating approaches
- [Host compatibility](#host-compatibility) — verified, researched, unverified
- [Exports](#exports) — GLB, STL, JSON; 3MF and STEP researched
- [Deployment](#deployment) — why no container service
- [Anti-patterns](#anti-patterns)
- [Emulating it](#emulating-it)

## Responsibilities

```text
AI assistant        intent → a parametric model; revises parameters; reads findings
Geometry engine     resolves, evaluates, inspects, encodes (deterministic, framework-free)
Viewer              renders, interacts, exports
```

No inference service is involved: the assistant that is already in the conversation writes the
model. The server only computes.

| Layer | Where | Depends on |
|---|---|---|
| Model schema (the contract) | `src/lib/schemas/parametric-model.ts` | Valibot |
| Domain logic: expressions, resolution, evaluation, links, patches, preview mesh | `src/lib/asset-production/modeling/` | manifold-3d, fflate — no framework, no DOM |
| Kernel adapter | `modeling/kernel.ts` (one per realm; the caller supplies the `.wasm` source) | manifold-3d |
| Pipeline (check → generate → inspect → encode → verify) | `src/lib/asset-production/engine.ts` + `generators/parametric-model.ts` | the asset production core |
| Export encoders | `glb.ts` (exact, read back), `stl.ts` | — |
| Tool registry (the MCP 3D service) | `src/lib/server/mcp/modeling/tools.ts` | the domain, the transport contract |
| Endpoint | `src/routes/api/mcp/3d/+server.ts` | rate limiter, the registry |
| Protocol infrastructure (shared with the Pattern MCP) | `mcp/tool-server.ts`, `src/lib/server/mcp/http.adapter.ts` | official MCP SDK, ext-apps |
| MCP App (3D Viewer) | `src/lib/server/mcp/apps/model-viewer.ts`, `apps/view/model-viewer.{ts,css}` → `model-viewer.view.html` | ext-apps app bridge, Three.js |
| Execution environment (browser) | `src/lib/workers/model-evaluation{,.worker}.ts`, `model-evaluator.ts` | the domain |
| Native viewer | `src/lib/components/3d/ModelViewer.svelte`, `/3d/view` | Threlte, the worker |
| Showcase | `/showcases/3d/mcp` | the viewer, the examples |
| Examples (one per workload) | `src/lib/showcases/3d/mcp/example-models.ts` | the schema |

The domain is the single authority: the MCP tools, the App's geometry, the native viewer, the
showcase, the tests and the benchmarks all call `runParametricModel`. A GLB built in the
browser worker has the same sha256 as the one the server builds (verified in Chromium against
Bun, and Bun against Node; § Performance).

## The parametric model

```json
{ "version": 1, "name": "Cylindrical enclosure with lid", "units": "mm",
  "parameters": { "diameter": 60, "height": 40, "wall": 3 },
  "operations": [
    { "id": "outer",  "op": "cylinder", "r": "$diameter / 2", "h": "$height", "center": false, "segments": 96 },
    { "id": "cavity", "op": "cylinder", "r": "$diameter / 2 - $wall", "h": "$height", "center": false, "at": [0, 0, "$wall"] },
    { "id": "body",   "op": "subtract", "from": "outer", "remove": ["cavity"], "material": "plastic" }
  ],
  "output": "body" }
```

- **Feature graph.** Operations run in order; an operation may reference only earlier ids, so
  the graph is acyclic by construction and resolution is one pass. Each output is a component.
- **Vocabulary** (`modeling/vocabulary.ts`, served by `describe_modeling`): primitives (box,
  sphere, cylinder/cone, torus), profiles (extrude with twist and taper, revolve; rect with
  rounded corners, circle, polygon), Booleans (union, subtract, intersect), hull, transform,
  mirror, linear and radial patterns, and procedural operations: heightfield (a surface from
  an expression in x, y), blend (spheres fused by a smooth-minimum SDF), smooth (subdivide and
  round), deform (twist, taper, bend). Placement (`at`, `rotate`, `scale`, `material`) is on
  every operation.
- **Expressions.** A number may be a string in a bounded language: `+ - * / ( )`, `$param`,
  `pi`, eleven functions, `x`/`y` inside a heightfield. A hand-written recursive-descent parser
  with length, token and depth limits and `Object.hasOwn` lookups — no `eval`, no `Function`,
  no property access, no strings.
- **Units** mm, cm, m, in; Z up in the model. Exports convert: glTF Y-up metres, STL Z-up mm.
- **Not supported, on purpose** (and listed for the agent): fillets and chamfers, shelling,
  sweep and loft, text and imported meshes, exact CAD exchange, constraints. A mesh kernel
  cannot do the first honestly; the rest would widen the attack and maintenance surface
  before a workload asks for it.
- **Patches** (`modify_model`): `{ parameters?, operations?: { id: fields }, remove?, add?,
  output?, name? }`, applied by `applyModelPatch` to the model the caller sends. A patch that
  names an unknown parameter or changes an operation's id or op is refused.

## Engine choice

Measured on the workload that dominates mechanical parts — a plate minus an n × n grid of
holes, Node 22, cloud container, 2026-11-26 (`p50` of warm runs):

| Holes | Manifold 3.5.5 (WASM) | JSCAD 2.13 | three-bvh-csg 0.0.19 |
|---|---|---|---|
| 4 | 5.7 ms, genus 4 | 12.6 ms | 22.3 ms |
| 25 | 21.6 ms, genus 25 | 212 ms | 460 ms |
| 100 | 88.8 ms, genus 100 | 5 152 ms | 7 632 ms |

Manifold is 10–80× faster as the work grows, its output is a guaranteed closed, oriented
2-manifold with exact topology queries (genus, volume, surface area), and it runs unchanged in
Node, Bun and the browser. three-bvh-csg returns an unindexed mesh that failed the
closed-manifold check without a separate weld and repair step (1 968 edges not shared by
exactly two triangles at 4 holes, by exact position). OpenCascade (replicad) would add
fillets and STEP at 10–20 MB of WASM and seconds of initialisation; it is the upgrade path
when a workload needs B-rep (§ Exports), not the default.

## Evaluation

`runParametricModel(input, { budget, deadlineAt })`:

1. **Parse** with the strict schema; findings name the path inside the model.
2. **Check** (`resolveModel`): references, duplicate ids, output ids, every expression
   compiled and evaluated against the parameters, finite values in range, pattern counts,
   graph depth, total pattern instances, and an **estimate** of triangles (exact for
   primitives, a heuristic for Booleans). Over budget → refused before the kernel runs.
3. **Generate** (`evaluateModel`): one kernel object per operation, placement applied scale →
   rotate → translate, `status()` and the real triangle count checked after every operation,
   the deadline checked between operations; every kernel object deleted.
4. **Mesh**: outputs simplified at 1e-6 of their extent, converted to Y-up metres, zero edges
   collapsed, sliver triangles flipped, normals split at 40° creases; the kernel's topology
   travels with the mesh so the inspector welds by it.
5. **Inspect, encode, verify**: the asset production inspector (closed shells, finite values,
   envelope ±50 m), the byte-stable GLB writer with its provenance in `asset.extras`, and the
   read-back gate. A refused or failed run returns no bytes.

The run answers a `ParametricModelSummary`: per component size, material, triangles, closed-manifold,
genus, volume; overall size; GLB bytes and sha256; the model digest (sha256 of canonical
JSON); the model link; timings.

## MCP 3D

A **separate MCP service**, not a Pattern MCP feature: `POST /api/mcp/3d`, identity
`v10r-mcp-3d`, its own instructions, registry, App and rate limit. It reuses the protocol
infrastructure — the same SDK bridge, HTTP adapter, both protocol eras, Origin check and body
budget — and nothing else. `tools.test.ts` pins the separation in both directions; the Pattern
MCP's catalogue and tests are unchanged.

| Tool | Visibility | Does |
|---|---|---|
| `describe_modeling` | model | The vocabulary, limits, units, materials, unsupported operations and a complete example. Read once. |
| `generate_model {model}` | model, renders the App | Builds; answers facts + a viewer link (text and the same as `structuredContent`). |
| `modify_model {model, patch}` | model, renders the App | Applies the patch to the supplied model, builds, answers the **new model** too. |
| `render_model {model, format}` | app only (`_meta.ui.visibility: ["app"]`) | The preview mesh the App draws, or the exact GLB / STL it downloads. |

Answers never carry vertex data to the model. `tools/list` is 641 tokens because model
arguments are advertised as `{type: "object"}` with a one-line shape: the full JSON Schema of
the model would be 9 324 tokens on every connection. The vocabulary is served once by
`describe_modeling` instead (staged discovery, § Token cost), and the server validates
strictly whatever it is sent.

**Access: a Velociraptor account** (decision 2026-11-26, superseding "public,
unauthenticated", which was not approved). `/api/mcp/3d` is an OAuth protected resource: the
host signs the user in through standard OAuth 2.1 (PKCE, resource indicators) and every
JSON-RPC request, `initialize` and the app-only `render_model` included, needs an access token
for this audience with scope `mcp:3d:use`. Before any work: a per-IP entry limit (300/min),
the token, per-account limits (30/min, 1 000/day — shared by all of one user's clients), a
surface ceiling (600/min), an in-flight bound (4 per instance, 2 per account), then the
per-call budget (100 000 triangles, 2.5 MB GLB, 8 s deadline). The whole design — the
authorization server, registration, revocation, quotas and the worst case:
[mcp-authorization.md](../architecture/mcp-authorization.md). Model links, the native viewer
and browser-local generation stay public; no token ever appears in a link.

**No telemetry.** The endpoint mounts `noopMcpObserver`: model definitions are the caller's
work and never reach `mcp.call_log`, application logs, error reports or traces. (Recording
anonymous counts would need the `mcp.call_log` surface enum extended — a migration, deferred.)

## Viewing

**3D Viewer MCP App** (`ui://v10r/3d-viewer.html`). A host's sandbox admits no WebAssembly
compile (the spec's default CSP has no `wasm-unsafe-eval`), so the App does not run the
kernel. It reads the model from the tool input (or the new model in a `modify_model` result),
asks `render_model` for a **preview mesh** (positions welded and quantized to 16 bits per
bounding box, deflated, base64 — about a fifth of the GLB; normals rebuilt with the same 40°
crease), and draws it with Three.js: orbit, wireframe, reset, dimensions, findings, parameter
edits (re-rendered through `render_model`, reported to the agent with
`ui/update-model-context`), GLB / STL / JSON through `ui/download-file` where the host offers
it, and the full viewer through `ui/open-link`. Every CSP list is empty; the document refuses
every network fetch itself. 855 KB (223 KB gzip), almost all Three.js.

**Native viewer** (`/3d/view#m1.…`). Decodes the link, evaluates in a Web Worker
(`manifold.wasm?url`, the page CSP admits `wasm-unsafe-eval`), loads the GLB into Threlte:
orbit, wireframe, grid, reset, parameter edits that rewrite the fragment, copy link, copy
definition, GLB / STL / JSON download from memory, JSON import (64 KB cap), a precise message
per malformed-link reason, and a standing notice that the link is not private. Cancel is
`Worker.terminate()` — a WebAssembly call cannot be interrupted from inside.

**Model link.** `m1.` + base64url(deflate-raw(canonical JSON)), in the URL **fragment**,
which browsers never send to a server. Equal models give equal links whatever their key
order. Decoding is bounded: 8 000 characters, inflate stopped at 16 KiB, ratio ≤ 40 (a
compression bomb fails as `too-large`). The examples' links are 385–634 characters.

**Link versioning.** `m1` names both the encoding (deflate-raw + base64url) and the model
format it carries (`version: 1`). The policy:
- An `m1` link stays decodable **forever**: it is a published artifact (shared, bookmarked, pasted into chats), and the viewer is its only reader.
- Every change that a version-1 reader would misread is a new prefix (`m2.`), whether it is a different compression, a different canonicalization, or model `version: 2`. The viewer keeps every decoder it ever shipped.
- An additive model feature that old readers refuse cleanly (an unknown `op` is a validation finding, never a misbuild) stays `m1`.
- A prefix is never reused, and links carry no credential, expiry or server reference, so no version ever needs the server.

The decoder refuses an unknown prefix with its own message (`unsupported-version`), so a newer
link opened on an older deployment says so instead of failing as malformed.

`m1` names a serialization and a modeling schema. It does **not** name an engine or kernel
version: those can change under it, but only if they keep the geometry. The geometry is
pinned by `link-compatibility.test.ts`, which records each example's triangle count,
closed-manifold status, and per-component size, volume and genus. A Manifold upgrade or an
engine change that moves any of these fails the gate. The test's header says how to decide:
- if the change is incidental, re-pin in the same commit with a reason;
- if what a link denotes changed, keep a versioned evaluation path for `m1`, or move to `m2` with a tested migration.

Re-pinning silently is never allowed.

## Statelessness

- No model database, no stored file, no model id that refers to anything: the digest is a
  checksum of the definition, not a key.
- `modify_model` takes the model it modifies; the server forgets both after answering.
- Reproduction after process termination: the link, or the definition, rebuilds the model
  byte-for-byte (test: same GLB sha256 across runs; Bun ↔ Node ↔ Chromium worker measured).
- Downloads are produced from the definition at the moment they are asked for.

## Safety

`MODELING_LIMITS` (schema): 16 KiB definition, 64 operations, 32 parameters, 16 outputs,
graph depth 24, 32 operands, expressions of 120 characters / 48 tokens / depth 8, magnitudes
≤ 1e5, segments 3–128, 64 copies per pattern and 512 in total, 256 profile points, 64 extrude
divisions, 32 blend spheres, resolution 4–96, refine ≤ 4, extent ≤ 50 m. Then the budget and
the deadline. Refusals carry the path, the reason and a named next step (`describe_modeling`).
There is no tool, field or expression that can name code, a file, a URL or an engine flag.
Peak memory is bounded by the triangle budget (measured peak RSS ≈ 220 MiB for the whole
example set in one process), not enforced separately.

## Performance

Cloud container (linux x64), 2026-11-26, 10 warm runs, `scripts/asset-production/modeling-bench.ts`.
Development measurements, not production: the hosted function and real MCP hosts were not
measured (§ Host compatibility).

| Workload | Model | Triangles | Node p50 / p95 ms | Bun p50 / p95 ms | GLB | Preview JSON | Link |
|---|---|---|---|---|---|---|---|
| primitive | primitives | 3 306 | 23 / 30 | 26 / 29 | 66 KB | 26 KB | 385 |
| mechanical | bracket | 444 | 14 / 18 | 15 / 20 | 15 KB | 3 KB | 599 |
| repeated | perforated | 9 740 | 126 / 133 | 119 / 169 | 284 KB | 76 KB | 474 |
| organic | organic | 24 010 | 243 / 257 | 237 / 260 | 459 KB | 197 KB | 515 |
| assembly | enclosure | 2 312 | 29 / 37 | 26 / 32 | 71 KB | 18 KB | 589 |
| complex | lamp | 5 660 | 58 / 78 | 62 / 75 | 147 KB | 47 KB | 634 |

Kernel load 10 ms (Node) / 26 ms (Bun), once per instance. Generation is 85–95 % of a run;
inspection and encoding stay under 8 ms. Every model is deterministic across runs and
byte-identical between Node and Bun. In Chromium (SwiftShader, dev server) the worker built
the enclosure in 96 ms after a 27 ms kernel load, and a fresh browser context opening a model
link showed geometry 4 s after navigation (dev-server module loading dominates; a production
build was not measured).

## Token cost

`scripts/asset-production/modeling-tokens.ts`, tokenizer `gpt-tokenizer` o200k_base — an
**estimate** (Claude's tokenizer is not public; provider-reported usage was not measured).

| | Enclosure | Bracket | Perforated |
|---|---|---|---|
| Parametric model (canonical JSON) | 427 | 453 | 239 |
| Blender Python | 558 | 707 | 481 |
| Three.js + three-bvh-csg | 509 | 590 | 601 |
| JSCAD | 490 | 493 | 364 |
| `generate_model` answer as the model sees it (text / structured) | 570 / 617 | 551 / 595 | 463 / 504 |
| … of which the viewer link | 405 | 416 | 328 |
| Parameter patch alone | 7 | 8 | 7 |
| `modify_model` arguments (model + patch) | 438 | 465 | 250 |

One-time: `tools/list` 641, instructions 117, `describe_modeling` 1 408; a refusal 77.

Reading: the definition is 10–60 % smaller than the code an assistant would write for the same
part, and unlike code it is validated before anything runs and answered with facts. The
patch itself is tiny, but statelessness means the model is resent with it — the saving of a
parameter change over regenerating code is the code-vs-definition difference, not 98 %. The
viewer link is the largest single item in an answer (incompressible base64); it is the price
of reproducibility without storage. Advertising the full schema in `tools/list` would cost
9 324 tokens per connection; staged discovery costs 1 408 once, when the agent needs it.

**A whole session** (tools/list + instructions + `describe_modeling` + one `generate_model`
+ three `modify_model` rounds, arguments included), by what the host puts in context:

| | text only | `structuredContent` only (Claude Code) | both | text without the link | both, link once | both, no link |
|---|---|---|---|---|---|---|
| Enclosure | 7 503 | 7 655 | 11 437 | 5 829 | 9 619 | 7 945 |
| Bracket | 7 602 | 7 730 | 11 543 | 5 905 | 9 663 | 7 966 |
| Perforated | 5 813 | 5 941 | 8 731 | 4 399 | 7 227 | 5 813 |

These are tokenizer estimates (o200k_base). Provider-reported usage, which adds the host's system prompt and
wrapping, was not measured: it needs an authorized host session against a deployment.

**Viewer link in app-only `_meta` — measured, deferred.** The link is 22 % of a text-client
session and 31 % of one where the host forwards both text and `structuredContent`. Moving it
to the result's `_meta` (which MCP Apps hosts hand to the View, not the model) would save
that on App hosts. But the model could then no longer give the user the link, and the View's
"open full viewer" button would be the only path. Hosts without Apps — Claude Code, every
CLI — must keep it in model-visible content, so the server has to know the client's
capabilities (the `io.modelcontextprotocol/ui` extension, per request in the 2026-07-28 era).
Deferred until two things are verified on an authorized deployment: a host forwards `_meta` to
the View, and the button works there. The cheaper half — sending the link once rather than in
both text and `structuredContent` — saves 16 % on hosts that forward both. It is deferred with
it because Claude Code reads only `structuredContent` and other hosts only text, so neither
copy can go without capability detection. Measure: `bun run
scripts/asset-production/modeling-tokens.ts`.

## Host compatibility

| Host / surface | Status |
|---|---|
| Official ext-apps `AppBridge` test host (Chromium) → the real `/api/mcp/3d` over HTTP | **Verified** 2026-11-26: View renders, wireframe, parameter edit → `render_model` + `ui/update-model-context`, GLB / STL / JSON via `ui/download-file`, `ui/open-link` |
| MCP protocol (both eras, SDK conformance path) | Verified by `tools.test.ts` through the production HTTP path |
| Claude (web, desktop) custom connector + MCP Apps | **Not verified** — needs a publicly reachable deployment. Researched: MCP Apps on all Claude surfaces; `openLink` always confirms; tool results over ~150 k characters break hydration (the preview of the largest example is ~197 k characters, returned to the App, not hydrated — unverified) |
| ChatGPT developer mode | **Not verified, no compatibility claimed.** Researched: MCP Apps via `_meta.ui.resourceUri`, app-only visibility supported, `downloadFile` reported unsupported (staff, 2026-04) → the App's buttons are hidden by capability and the full-viewer link does exports |
| Authorization (OAuth 2.1, DCR + CIMD, refresh, revocation) | **Verified in-process** (`mcp-authorization.pglite.test.ts`); **not verified with any real host** — Claude, ChatGPT, Claude Code and MCP Inspector each need a deployment with the schema applied ([mcp-authorization.md](../architecture/mcp-authorization.md)) |
| Claude Code (CLI 2.1.332, `claude -p` over HTTP) | **Verified before authorization was required** — 2026-11-26 against the dev server: unprompted `describe_modeling` → `generate_model` → `modify_model` built a lidded enclosure with four floor holes (closed manifold, genus 4) and resized it. Tools only, no App; answers complete as `structuredContent`. Not yet run against a deployment |

## Exports

- **GLB** — exact, the engine's verified bytes. **STL** — binary, mm, Z up, 84 + 50 bytes per
  triangle. **JSON** — the definition.
- **3MF** — researched, deferred: an OPC zip with an XML mesh, writable with fflate in ~150
  lines; adds units and per-component objects over STL. Worth it when printing is a workload.
- **STEP** — researched, rejected for this pattern: exact B-rep exchange needs a CAD kernel
  (OpenCascade WASM, 10–20 MB); meshes exported as STEP faces are not what CAD users expect.

## Deployment

No container service is needed. The heaviest example runs in < 260 ms p95 with ~220 MiB
peak RSS; the kernel is 543 KB of WASM traced into the function; Vercel functions (Node 22,
`maxDuration` 30 s) hold it comfortably. A Render container becomes the answer only if a
workload needs a CAD kernel (B-rep, STEP), multi-second jobs, or GPU work — none of which
this pattern does.

## Anti-patterns

- Letting the model write code (Blender Python, JS) and running it: unbounded, unvalidated,
  and the answer is a stack trace instead of a finding.
- Storing models server-side to make edits cheap: it turns a stateless compute surface into
  a database with retention, privacy and abuse obligations.
- Putting the full schema in `tools/list`: 9 k tokens on every connection for a vocabulary
  the agent reads once.
- Running the kernel inside an MCP App: host CSPs refuse WASM compilation.
- Putting the model in a query string: it reaches server logs; the fragment does not.

## Emulating it

1. Copy the schema, the `modeling/` directory and the generator; keep the domain free of
   framework imports (the asset production boundary gate checks it).
2. Pick operations by workload; every new operation needs an estimate, limits and a refusal
   test.
3. Mount a separate MCP registry and endpoint with its own limiter; reuse the protocol layer.
4. Ship the App as a self-contained View that asks the server for geometry; ship the native
   viewer with the kernel in a worker.
5. Measure with the bench and token scripts before claiming numbers; test in each host before
   claiming it works there.
