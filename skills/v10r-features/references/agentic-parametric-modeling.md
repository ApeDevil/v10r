# Agentic parametric modeling

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** 3D · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — per-account CPU per call (bounded by schema, estimate, budget, deadline, per-account and surface limits); mesh checks prove closed manifolds, never printability or strength; not yet exercised in a real MCP host with authorization

An assistant describes a solid as a typed feature graph — parameters, operations, outputs — never as code; one deterministic Manifold (WASM) engine inside the asset production pipeline validates, builds, inspects and encodes it on a separate stateless MCP service, in the visitor's browser and in tests alike, and a model link in the URL fragment reproduces it anywhere without storage. An MCP App draws a server-side preview mesh; the native viewer runs the kernel in a Web Worker.

**When to use:** Use when an AI assistant should create or modify 3D geometry to view and export — parts, enclosures, procedural forms — and every result must be validated, bounded, reproducible and free of executed code, with no model database.

**Needs:** required email-delivery (via passwordless-auth), key-value-store (via rate-limiting), relational-db (via mcp-authorization, passwordless-auth, provenance-record) · conditional web-worker (when the app shows the model in the native viewer, where the kernel runs in a Web Worker)

## Avoid when

- The geometry needs B-rep CAD (fillets, chamfers, STEP, tolerances) — put a CAD kernel (OpenCascade/replicad) behind the same contract
- Models must be private, versioned or collaborative — that needs storage and retention, which this pattern deliberately has none of
- The input is existing meshes or scans to repair, convert or bake — that is a Blender or mesh-processing worker, not a feature graph

## Alternatives

- **The assistant writes Blender Python or Three.js/JSCAD code and a sandbox runs it** — prefer when the operations cannot be enumerated in advance and a hardened, isolated code sandbox already exists
- **A per-user model store with ids and edit history** — prefer when models must outlive the conversation privately or be edited by several people
- **Asset production pipeline with fixed generators** — prefer when the object family is fixed (a configurator) and only its parameters change

## Docs

- `docs/blueprint/3d/parametric-modeling.md` — The full pattern: responsibilities, model format, engine measurement, evaluation, the MCP 3D service and access (an account, via OAuth), viewing, statelessness, limits, performance, token cost, host compatibility, exports, deployment ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/parametric-modeling.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/parametric-modeling.md))

## Code

- `src/lib/schemas/parametric-model.ts` — The model contract and every limit ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/parametric-model.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/parametric-model.ts))
- `src/lib/asset-production/modeling/` — Framework-free domain: expressions, resolution and estimate, Manifold evaluation, model links, patches, preview mesh, runParametricModel ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/asset-production/modeling) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/asset-production/modeling))
- `src/lib/asset-production/generators/parametric-model.ts` — The model as an asset production generator ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/generators/parametric-model.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/generators/parametric-model.ts))
- `src/lib/server/mcp/modeling/tools.ts` — The MCP 3D tool registry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/modeling/tools.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/modeling/tools.ts))
- `src/routes/api/mcp/3d/+server.ts` — The protected endpoint: entry limit, resource access, per-account limits, in-flight bound, no telemetry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/mcp/3d/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/mcp/3d/+server.ts))
- `src/lib/server/mcp/apps/model-viewer.ts` — The 3D Viewer MCP App resource ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/apps/model-viewer.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/apps/model-viewer.ts))
- `src/lib/server/mcp/apps/view/model-viewer.ts` — The View program (Three.js, ext-apps bridge) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/apps/view/model-viewer.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/apps/view/model-viewer.ts))
- `src/lib/workers/model-evaluation.worker.ts` — The browser execution environment ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/workers/model-evaluation.worker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/workers/model-evaluation.worker.ts))
- `src/lib/components/3d/ModelViewer.svelte` — The native viewer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/3d/ModelViewer.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/3d/ModelViewer.svelte))
- `src/routes/[[locale=locale]]/(public)/3d/view/+page.svelte` — The model-link viewer /3d/view#m1.… ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/(public)/3d/view/+page.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/(public)/3d/view/+page.svelte))
- `scripts/asset-production/modeling-bench.ts` — Performance measurements ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/modeling-bench.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/modeling-bench.ts))
- `scripts/asset-production/modeling-tokens.ts` — Token-cost measurements against code baselines ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/asset-production/modeling-tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/asset-production/modeling-tokens.ts))

## Tests

- `src/lib/asset-production/modeling/modeling.test.ts` — Expressions and refusals, analytic volume and genus, all examples closed, determinism, GLB/STL, preview, budget, deadline, patches, links and the compression bomb ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/modeling/modeling.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/modeling/modeling.test.ts))
- `src/lib/server/mcp/modeling/tools.test.ts` — Catalogue separation from the Pattern MCP, App wiring and app-only visibility, answers, refusals, patches, exact downloads ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/modeling/tools.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/modeling/tools.test.ts))
- `src/lib/asset-production/modeling/link-compatibility.test.ts` — The m1 compatibility pin: every example's triangles, manifold status, size, volume and genus ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/asset-production/modeling/link-compatibility.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/asset-production/modeling/link-compatibility.test.ts))

## Proof

- [`/showcases/3d/mcp`](https://www.v10r.dev/showcases/3d/mcp)

## Invariants

- The assistant sends a definition, never code: no field, operation or expression can name a script, a file, a URL or an engine flag.
- One engine for every surface: MCP tools, the App's geometry, the native viewer, the showcase and the tests all call runParametricModel, and the same model gives the same GLB bytes on Node, Bun and the browser.
- Nothing is stored: every call carries the whole model, modify_model returns the whole new model, and a model link carries it in the URL fragment.
- A model over any limit is refused before the kernel runs, with the path of the field; the real triangle count and a deadline are checked between operations.
- Model definitions are never logged, traced or recorded.
- The MCP 3D service shares protocol infrastructure with the Pattern MCP and nothing else: separate endpoint, identity, registry, App and limits.
- The MCP 3D service requires a Velociraptor account: an OAuth access token for its audience on every request (mcp-authorization).

Inherited from [Asset production pipeline](asset-production-pipeline.md) (specializes):

- Callers ask through one strict request schema — a generator id and bounded parameters; no request can name a script, a file or an engine flag.
- The budget is checked from an exact estimate before anything is built and from the real mesh after; an over-budget request costs one arithmetic pass.
- Same request, same bytes — in-process or in a worker, on V8 or JSC; the label is presentation and never enters the derivation key.
- Every exported GLB passes inspection (closed outward shells, finite values, declared envelope) and its own read-back gate; tests hold it to the Khronos validator with zero errors and warnings.
- Findings are data with a fixed severity per code; a refused or failed run returns no bytes, and a cancelled one keeps nothing.
- Stores are write-once and owner-scoped: a repeat run reuses, different bytes under a kept key are refused, and a job never publishes.
- The core imports no framework, DOM or runtime API, so the same engine runs in a function, a worker process, a terminal and a browser.

## Emulation notes

- Advertise the model argument as a plain object and serve the vocabulary from a describe tool: a full JSON Schema in tools/list costs ~9k tokens per connection.
- Do not run WASM inside an MCP App: host CSPs refuse compilation; return a compact preview mesh from an app-only tool.
- Put shared models in the URL fragment, never the query string, and bound the decoder (length, inflate size, ratio).
- Measure token cost and host behaviour before claiming either; the numbers in the doc are dated development measurements.

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Hosted MCP](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/hosted-mcp.md) — The modeling tools run on a separate stateless MCP service; any MCP server endpoint satisfies it.

**Composes (constituents of its solution)**

- [MCP authorization](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/mcp-authorization.md) — required: The modeling service is an OAuth protected resource: every request carries an access token for its audience.
- [MCP App provider](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/mcp-app-provider.md) — optional when the MCP host renders Views: An MCP App draws a server-side preview mesh; the text and structured answer are complete without it.
- [Threlte integration](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/threlte-integration.md) — optional when the model is shown in the native viewer: The native viewer runs the same kernel in a web worker; the MCP tools work without it.

**Specializes (its invariants hold here; it is never built twice)**

- [Asset production pipeline](asset-production-pipeline.md) — Every parametric model is an asset production request: one strict request schema, same bytes, inspection before encoding.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/design-philosophy.md) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Multi-client core](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/multi-client-core.md) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.
- [Component-first UI system](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/component-system.md) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `agentic-parametric-modeling` in `pattern-library/registry.json`._
