# Architecture Engineering & Architecture Studio — plan and progress record

The durable plan for this work. Read it first when resuming after a context break: the
**Progress record** at the bottom says what is done and what is next. Research and the
internal inventory behind every choice here: [research.md](./research.md).

**Guiding rule:** *choose architecture from requirements and evidence, not technology
preference.* Architecture Engineering decides which approach fits; the Pattern Library says
how to build it; Architecture Studio lets a developer construct and evaluate it.

---

## 1. Relevant existing capabilities

See the inventory table in [research.md §1](./research.md#1-internal-inventory--what-already-exists).
In one line each: the pattern registry (fitness vocabulary, maturity, `requires`), the
deterministic MCP query layer, the drift guard, `product-composition` (the template for an
editable graph document), the attribute editor (undo/redo), the form-draft store (local
persistence), `FlowDiagram` over `@xyflow/svelte` (lazy canvas), and the wasm and
external-service showcases (evidence).

## 2. Missing capabilities

1. A **decision catalogue**: where a workload runs, how parts talk, where data lives, how it
   deploys, what it costs in performance — with alternatives, rejected options, triggers to
   revisit, and graded evidence. Nothing in the registry answers "where should this run".
2. A **deterministic decision engine** over structured workload factors, with explicit
   unknowns.
3. An **architecture model**: typed nodes, placements, connections, trust zones, linked
   decisions and patterns — separate from layout.
4. **Engineering checks** over that model, and a **comparison** of two models.
5. The **Studio** UI (Explore, Design, Engineer) and local drafts.
6. MCP access to the engine and the checks.
7. Evidence for app-vs-database processing — **stays missing** (stated, not invented).

## 3. Reused components

| Reused | How |
|---|---|
| `pattern-library/registry.json` | Every decision alternative and model node links patterns **by id**; validation fails on an unknown id. No content is copied |
| `PATTERN_REQUIREMENTS` | A node kind's operational requirements use the same closed vocabulary, so a comparison can say "variant B adds `container-host`" in the registry's own words |
| `pattern-library/validate.ts` | Extended to validate the decision catalogue (pattern ids, evidence refs) |
| `pattern-library/query.ts` tool contract | Two new deterministic tools added to `QUERY_TOOLS`/`REGISTRY_QUERIES` — both transports pick them up |
| `FlowDiagram.svelte` | Gains `onconnect` and `onnodedragstop` pass-throughs; stays lazily loaded |
| product-composition conventions | Format number, strict fail-closed parse, canonical stringify, pure operations returning `{ok}` or a refusal, fixed-severity findings in a stable sort |
| attribute-editor history | `$state.raw` model, `past`/`future`, coalesced edits |
| form-draft store conventions | Injected `Storage`, sanitised keys, corrupt entries dropped not thrown |
| Components barrel | `Tabs`, `Button`, `Select`, `Input`, `Textarea`, `Checkbox`, `Badge`, `Card`, `Accordion`, `Alert`, `ToggleGroup` — no raw controls |

## 4. Architecture and data contracts

### 4.1 Where the code lives

`pattern-library/architecture-engineering/` — framework-free, dependency-free TypeScript
plus one JSON catalogue. It sits beside the registry because the stdio MCP server (bare
Bun, no `node_modules`) must import it by relative path, exactly like `query.ts`; the app
reaches it as `#patterns/architecture-engineering/*`. Validation is hand-rolled like
`schema.ts` for the same reason (no valibot in the stdio container). Tests are co-located;
`vitest.config.ts` includes `pattern-library/**/*.test.ts`.

| File | Responsibility |
|---|---|
| `vocabulary.ts` | Closed vocabularies: engineering domains, workload factors and their values, node kinds (default placement, allowed placements, `requires`), placements, protocols, zone kinds, evidence kinds |
| `decisions.json` | The decision catalogue (data) |
| `decision-record.ts` | Decision record types and fail-closed parse; pattern-id resolution |
| `explore.ts` | The decision engine: workload profile → recommendation per decision |
| `workload-examples.ts` | The ten Explore examples (profiles, not recommendations — the engine derives those) |
| `architecture-model.ts` | Architecture model + layout types, fail-closed parse of untrusted JSON, canonical stringify |
| `model-operations.ts` | Pure operations: add/update/remove node, connection, zone; refusals as data |
| `findings.ts` | Finding codes, fixed severities and categories, stable sort |
| `checks.ts` | Engineering checks: model → `ArchitectureFinding[]` |
| `compare.ts` | Two models → structured differences + qualitative assessment |
| `model-from-recommendation.ts` | Deterministic transfer of an Explore result into a starting model |
| `evolution-examples.ts` | The four-stage evolution example (baseline → worker → Rust service → client compute) |
| `index.ts` | Barrel |

### 4.2 Decision record (`decisions.json`, `ARCHITECTURE_DECISION_FORMAT = 1`)

```ts
interface ArchitectureDecision {
  id: string;                       // kebab-case, stable
  revision: number;                 // bumps when rules or recommendation change
  domain: 'execution' | 'communication' | 'data' | 'deployment' | 'performance';
  title: string; question: string; description: string;
  problem: { workload: string; functional: string[]; nonfunctional: string[]; constraints: string[]; assumptions: string[] };
  alternatives: {
    id: string; approach: string; placement?: Placement; technologies: string[];
    benefits: string[]; drawbacks: string[]; prerequisites: string[]; contraindications: string[];
    patterns: string[];             // registry ids — must resolve
  }[];
  rules: { id: string; when: Partial<Record<WorkloadFactor, string[]>>; choose: string; because: string }[];
  fallback: { choose: string; because: string };   // the simplest alternative
  rejected: Record<string, string>; // why each non-default alternative loses by default
  changes_when: string[];           // conditions that flip the recommendation
  evidence: { kind: EvidenceKind; ref: string; claim: string; conditions?: string; limitations: string }[];
  evolution: { revisit_when: string[]; migrations: { from: string; to: string; path: string; implications: string }[] };
  confirmation?: string;            // how compliance is checked (MADR "confirmation")
}
type EvidenceKind = 'measured' | 'live-measurement' | 'reference-implementation' | 'documented-reasoning' | 'external-study' | 'estimate';
```

Evidence follows the *evidence status dimensions* discipline: kind, conditions and
limitations are separate fields; there is no score. `measured` requires `conditions`.

### 4.3 Decision engine (`explore.ts`)

Input: a `WorkloadProfile` — every factor is a closed value **or `unknown`**:
`workload`, `duration`, `dataVolume`, `dataOrigin`, `sensitivity`, `offline`, `latency`,
`compute`, `background`, `infrastructure`, `complexityTolerance`.

Per decision, rules are evaluated **in order**:

- a rule whose every named factor is known and matching **fires** → its alternative is
  chosen, its `because` recorded;
- a rule that could match but names an `unknown` factor is **undecided** → recorded as
  *missing information*: "if `background` were `required`, this would choose
  `background-job`";
- a rule contradicted by a known value is skipped;
- no rule fires → `fallback` (always the simplest alternative), flagged as a default.

Output (`ArchitectureRecommendation`): engine revision, the input profile echoed, and per
relevant decision: chosen alternative, fired rule id + reason, every other alternative
with its rejection reason, undecided rules (missing information), `changes_when`, evidence.
Same inputs + same catalogue revision ⇒ byte-identical output. No scores, no AI.

### 4.4 Architecture model (`ARCHITECTURE_MODEL_FORMAT = 1`)

```ts
interface ArchitectureModel {
  format: 1; id: string; name: string; description: string;
  derived_from?: string;            // the baseline a variant was duplicated from
  change_reason?: string;           // why this variant exists (evolution record)
  zones: { id: string; label: string; kind: 'client' | 'application' | 'data' | 'third-party' }[];
  nodes: {
    id: string; kind: NodeKind; label: string; zone: string;
    placement: Placement; responsibilities: string[];
    traits: { holds_secrets: boolean; cpu_intensive: boolean; long_running: boolean; stateful: boolean };
    decisions: string[]; patterns: string[];
  }[];
  connections: {
    id: string; from: string; to: string; protocol: Protocol; mode: 'sync' | 'async';
    data_flow: string;
    authenticated: 'yes' | 'no' | 'unknown';
    failure_handling: 'unknown' | 'none' | 'timeout' | 'retry' | 'timeout-and-retry' | 'queue-redelivery';
  }[];
  constraints: string[];
}
interface ArchitectureLayout { format: 1; positions: Record<string, { x: number; y: number }> }
```

Node kinds (12): `browser-app`, `browser-worker`, `wasm-module`, `app-server`,
`api-endpoint`, `background-worker`, `compute-service`, `relational-db`, `graph-db`,
`cache`, `object-storage`, `external-service`. Each declares allowed placements, a default,
and `requires` (from `PATTERN_REQUIREMENTS`).

The diagram is a projection: positions live only in `ArchitectureLayout`. Parsing treats
input as untrusted: strict objects, bounded sizes (nodes ≤ 200, strings ≤ 2 000 chars),
kebab-case ids, duplicate ids refused, dangling references refused, unknown format refused.
Nothing in a model is ever executed or rendered as HTML.

### 4.5 Engineering checks (`checks.ts`)

`checkArchitecture(model) → ArchitectureFinding[]`, each `{ code, severity, category,
subject, why, constraint, fix, patterns }`. Severities: `error` (a stated fact is
contradicted — e.g. a secret on a browser node), `warning` (a heuristic that usually
signals a problem), `recommendation` (simpler or safer option exists), `unknown` (the model
leaves a decisive property unstated). Categories keep **security** separate from
**runtime**, **communication**, **data** and **structure**. Initial codes:

| Code | Severity | Category |
|---|---|---|
| `secret.client-exposed` | error | security |
| `boundary.unauthenticated` | error | security |
| `boundary.auth-unknown` | unknown | security |
| `client.direct-data-access` | error | security |
| `main-thread.cpu` | warning | runtime |
| `request.long-running` | warning | runtime |
| `runtime.unsupported` | error | runtime |
| `protocol.incompatible` | error | communication |
| `boundary.failure-unknown` | unknown | communication |
| `boundary.no-failure-handling` | warning | communication |
| `boundary.unjustified-service` | recommendation | structure |
| `data.shared-ownership` | warning | data |
| `node.isolated` | recommendation | structure |

No check measures anything; none may claim performance numbers.

### 4.6 Comparison (`compare.ts`)

Two models → added/removed/changed nodes (by id), placement changes, connection changes,
zone changes, deployment units (distinct runtimes that must be deployed), network
boundaries crossed, synchronous network hops, operational requirements (union of node
`requires`, diffed), findings diff. Latency and complexity are reported as **qualitative**
statements labelled *qualitative — not measured*, with links to evidence where it exists.

### 4.7 Persistence

Local-first: `localStorage`, one index key plus one key per draft, labelled in the UI as
"saved in this browser only". Draft = `{ model, layout, savedAt }`. Export/import is one
JSON file `{ model, layout? }` parsed by the same fail-closed parser. No database schema,
no auth dependency. The model contract is storage-agnostic, so a server store can be added
later without touching it.

## 5. Registry changes

- **Schema: none.** Decisions reference patterns; the registry does not reference decisions.
- **One new deep record** `architecture-engineering` (category `architecture`) pointing at
  the code, docs, tests and the Studio route (`approute`).
- `validate.ts` gains the decision-catalogue check (ids resolve, evidence refs exist).

## 6. Navigation and UI integration

| Conceptual node | Actual home |
|---|---|
| Overview, Principles, Decisions, Labs | `/architecture` — one page: principles, the five domains, the decision catalogue (each decision expandable: question, alternatives, rejected reasons, evidence), and the existing labs (`/showcases/wasm`, `/showcases/external-service`) with the app-vs-database gap stated |
| Patterns | No new page — links into `/docs/pattern-library/<id>` |
| Architecture Studio | `/architecture/studio`, modes as tabs with `?mode=explore|design|engineer` in the URL |

One top-level nav item (`nav_architecture`), sitemap entries, i18n area `architecture`
(en/de/ru). Decision catalogue content is English, like the registry. UI chrome is
localized. Canvas loads only on the Studio route through `FlowDiagram`'s dynamic import.
Every canvas action has a keyboard path through the inspector forms (add node, connect via
selects, delete), so the canvas is never the only way to edit.

## 7. Implementation phases

1. **Audit and design** — this file and research.md.
2. **Foundation** — vocabulary, decision records, `decisions.json`, engine, validation, registry record, overview doc.
3. **Explore** — factor form, workload examples, recommendation view, transfer to Design.
4. **Design** — model + operations + parser, editor state with undo/redo, canvas, inspector, drafts, import/export.
5. **Engineer** — checks, findings view, variant duplicate + change reason, comparison, evolution example.
6. **Evidence and integration** — evidence links, `/architecture` overview page, MCP tools, nav/sitemap/i18n polish.
7. **Final review** — `validate`, `validate:build`, browser check, security/a11y/dead-code review, docs consistency.

## 8. Risks, dependencies, validation

| Risk | Mitigation |
|---|---|
| Recommendations read as authoritative | Every output shows the fired rule, the alternatives, and missing information; copy says "preliminary"; evidence kind always visible |
| Decision content drifts from patterns | `validate.ts` fails on unknown pattern ids and missing evidence files |
| Bundle growth | xyflow stays behind the existing dynamic import; engine and catalogue load only on `/architecture/*`; measured in `validate:build` against `total_client_js_kb` |
| MCP tool-count pins (≈10 tests) | Updated in one commit with the tools; parity test gains cases |
| Untrusted imports | Fail-closed parser with size bounds; text rendered as text only |
| Naming collisions | Terms chosen against `docs/naming.md` (research.md §1); new rows added there |
| Scope | No server persistence, no auto-layout engine, no AI recommendations, no new benchmarks |

Validation: unit tests for engine determinism, unknown handling, parser bounds and
integrity, operations, every check code, comparison; `validate`; `validate:build`;
a Playwright pass through the Studio flow (cloud quirks: see the team memory).

---

## Progress record

| Phase | State | Notes |
|---|---|---|
| 1 Audit and design | done | research.md, this plan |
| 2 Foundation | pending | |
| 3 Explore | pending | |
| 4 Design | pending | |
| 5 Engineer | pending | |
| 6 Evidence and integration | pending | |
| 7 Final review | pending | |
