# Architecture Engineering — research

Phase 1 research behind [plan.md](./plan.md): what v10r already has, and what established
practice says. Tags: **[established]** = widely practised engineering; **[speculative]** = an
extrapolation or heuristic this design adopts deliberately and labels as such.

---

## 1. Internal inventory — what already exists

| Need | Existing capability | Verdict |
|---|---|---|
| A catalogue of approaches with "when not to" | `pattern-library/registry.json` + `schema.ts`: `avoid_when`, `alternatives {approach, prefer_when}`, `requires` (closed `PATTERN_REQUIREMENTS` vocabulary), `maturity` (`planned`/`implemented`/`proven`, machine-checked) | **Reuse.** Decisions reference pattern ids; they never copy pattern content. `requires` is the operational-requirements vocabulary for node kinds |
| Deterministic recommendation | `pattern-library/query.ts` `recommendPlan` — capability match → `depends_on` closure → topological order, fitness block, `target_infra` vs `requires`, no inference | **Reuse the stance and the MCP tool contract** (`QUERY_TOOLS`, `REGISTRY_QUERIES`, `diag` + `next` actions). Plan assembly answers "how to build"; it does not answer "where should it run" |
| Drift guard for references | `pattern-library/validate.ts` (`patterns:validate`): paths exist, showcase hrefs registered, `approute` dirs exist | **Extend** with the decision catalogue: every pattern id resolves, every evidence ref exists |
| Editable graph document with fail-closed parse, canonical stringify, pure operations, diagnostics with fixed severities | `#lib/product-composition/` (`serialize.ts`, `operations.ts`, `validate.ts`, `diagnostics.ts`) + `#lib/schemas/product-composition.ts` | **Emulate** (not import): the same shape for the architecture model — format number, strict objects, ids as keys, `{ok, …} | {ok:false, issues}`, sorted findings |
| Undo/redo | `components/composites/attributes/attribute-editor.svelte.ts` — `$state.raw` record, `past`/`future`, coalescing window, injectable clock | **Emulate** in the Studio editor state |
| Local drafts | `#lib/state/form-draft.ts` (injected storage, sanitising), `document-drafts.ts`, `unsaved-work.ts`, `leave-guard.svelte.ts` | **Emulate** the injected-storage store; local-first persistence, clearly labelled |
| Interactive canvas | `@xyflow/svelte` 1.5 behind `components/viz/diagram/flow/FlowDiagram.svelte` (dynamic import in `onMount`, SVG skeleton, controlled selection, token theming) | **Extend** `FlowDiagram` with two pass-through callbacks (connect, drag stop). No new graph library |
| Measured evidence: JS vs Rust/Wasm | `/showcases/wasm` — live, byte-parity-gated, counterbalanced benchmark (`src/lib/wasm/bench.ts`); figures computed in the reader's browser, none committed (doc prose: "blur around 2–4×") | **Link**; grade it as *live measurement on the reader's device* |
| Measured evidence: app server vs external service | `/showcases/external-service` + `docs/blueprint/architecture/external-service.md` §Measurement — loopback, controlled-lab and hosted (Render Frankfurt, 2026-10-23) tables with conditions, plus an explicit "still unmeasured" list | **Link**; grade *measured with stated conditions*; carry its limitations |
| Evidence: app vs database processing | None as a showcase. `query-budget` (round-trip counts, PGlite gate), `velocity-compute-locality` (region placement, not computation placement) | **Gap, stated explicitly.** No new benchmark infrastructure in this work |
| How evidence is reported honestly | `docs/blueprint/integrity/truth.md` §Evidence status dimensions — separate fields, never one score, "missing coverage is a value" | **Adopt**: evidence kind, conditions and limitations are separate fields; no composite score anywhere |
| Navigation | `#lib/nav/nav.ts` `navItems`; `#lib/workflows/catalog.ts` precedent for a top-level hub; sitemap `src/routes/sitemap.xml/+server.ts` | **Extend** with one top-level item |
| Perf ratchet | `src/lib/server/perf/budgets.json` — aggregate ceilings (`total_client_js_kb` 2280, last 2210.8) | **Respect**: canvas stays behind the existing dynamic import; measure in `validate:build` |

### Names already spoken for (`docs/naming.md`)

- `scenario` = one adverse condition measured by `perf/scenarios.ts` → Explore examples are **workload examples**.
- `lab` / `runtime lab` = the external service and its showcase → the overview links *to* the existing labs; no new "lab" concept is introduced.
- `preset`, `evaluation` = the runtime lab's request bodies → not reused.
- bare `model` = an AI model → always **architecture model**.
- `LocalityRow` = which region a system runs in → **placement** is the term for which runtime executes a node.
- `CompositionDiagnostic` = composition validation → architecture checks report **`ArchitectureFinding`**.
- `architecture` = an existing registry category (`architecture-*` ids) and `docs/blueprint/architecture/` → the new capability is always the compound **Architecture Engineering**; its code lives in `architecture-engineering/` directories.

---

## 2. External research

| Practice | Core idea | Extracted principle | Not adopted |
|---|---|---|---|
| ADR (Nygard 2011), MADR 4.0 **[established]** | One short record per decision: context, considered options, outcome, consequences; superseded, never edited; MADR adds *decision drivers* and *confirmation* | Decision records carry drivers (here: workload factors), all considered options, rejected options with reasons, and how compliance is confirmed (an executable check) | Governance workflow; free-text-only records |
| C4 model; Structurizr "model vs views" **[established]** | One model, diagrams are projections; layout lives in views | The architecture model holds no coordinates; layout is a separate object keyed by node id | Four zoom levels (one container-level view is enough for the MVP) |
| Fitness functions (Ford, Parsons, Kua); ArchUnit **[established]** | An objective, automated check of an architectural characteristic | Engineering checks are pure functions over the model; v10r's `*.gate.test.ts` already practise this on the codebase itself | Runtime/chaos fitness functions |
| DDD bounded contexts; hexagonal (Cockburn) **[established]** | Boundaries of one language; ports/adapters, dependencies inward | Trust zones are explicit model objects; v10r's own domain/adapter split is cited as the in-process alternative to a network boundary | Tactical-DDD ceremony |
| AWS Well-Architected, Azure compute decision tree, Google framework **[established]** | Fixed quality pillars; explicit yes/no decision trees | Recommendations are an ordered rule path with recorded reasons; trade-offs are named per pillar-like dimension, never totalled | Vendor catalogues; weighted totals presented as objective |
| Architecture-as-code (Structurizr DSL, LikeC4); Threat Dragon / STRIDE DFDs **[established]** | Text-first model; trust boundaries first-class; boundary-crossing flows prompt threats | A connection crossing zones must state authentication and failure handling; unknown stays `unknown` | Own layout engine; drawing-only tools as source of truth |
| Wasm vs JS measurements — Jangda et al., USENIX ATC '19; Surma "Is postMessage slow?"; Mozilla Hacks 2018 **[established measurements, speculative thresholds]** | Wasm is not uniformly faster; boundary marshalling dominates small calls; postMessage payload ≲100 KiB fits a 100 ms interaction | Default JS on the main thread → Worker past the budget → Wasm only for a measured hot loop over resident typed data. Thresholds are cited heuristics, not constants | Universal speed-up claims |
| MonolithFirst, microservice premium (Fowler) **[established]** | Start with a (modular) monolith; split on an explicit trigger | The default deployment recommendation is the modular monolith; a separate service needs a named trigger (runtime, isolation, independent scaling) | Distribution before a trigger |

Sources: cognitect.com/blog/2011/11/15/documenting-architecture-decisions · adr.github.io/madr ·
c4model.com · docs.structurizr.com/dsl/language · evolutionaryarchitecture.com ·
archunit.org · martinfowler.com/bliki/BoundedContext.html · alistair.cockburn.us/hexagonal-architecture ·
docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html ·
learn.microsoft.com/azure/architecture/guide/technology-choices/compute-decision-tree ·
likec4.dev · usenix.org/conference/atc19/presentation/jangda · surma.dev/things/is-postmessage-slow ·
martinfowler.com/bliki/MonolithFirst.html · martinfowler.com/articles/microservice-premium.html
