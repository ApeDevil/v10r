# Slice 3 — Typed relationships, recursive composition and one graph module

Authorized by ApeDevil on 2026-11-28 together with the Slice 2 acceptance. Branch
`claude/cloud/pattern-ontology-engineering`, continued from `786b603`. Stops at the Slice 3 review
checkpoint: Slice 4 (plan assembly and selection), a merge into `main` and a deploy each need his word.

**In one paragraph.** `depends_on` is gone. Every relationship is now one of four authored types —
`builds_on`, `composes` (required, conditional or optional), `specializes`, `references` — each with its
rationale, and platform conventions and principles apply through five scoped assumptions instead of edges.
Every one of the 90 former edges was migrated by its meaning (`reconciliation/relationships.json`), not
mechanically. One framework-free module, `pattern-library/pattern-graph.ts`, is now the only code that
interprets relationships; the duplicated walkers (`topoSort`, `adoptionNeeds`, the explorer's own BFS, the
skills and page generators' closures) are removed and a gate keeps it that way. All six need-merging gaps of
Slice 2 are resolved: the 11 former expected-fail fixtures pass unchanged as ordinary tests. Plans stop
building generalizations, optional constituents and platform assumptions as steps, so design-set precision
rises from 52.9 to 62.8 with holdout scores unchanged; selection quality (holdout recall 50%) remains Slice 4's
problem.

## 1. Slice 2 refinements

| Item | What changed | Where |
|---|---|---|
| Manifest snapshot states | Each entry says which record it snapshots: `recordState: slice-1` or `corrected-before-reconciliation`. For `architecture-hosted-mcp` (S3 correction) and `db-ops-branch-refresh` (branch-API need) the entry adds `historical {commit: 742cf8b, differences[]}`, each difference with the Slice 1 value and the reason. A gate test proves the snapshot differs from the record at `742cf8b` in exactly the listed fields | `reconciliation/manifest.json`, `preservation.gate.test.ts` |
| Capability ownership | Every retired and merged record's capabilities reviewed in five classes. 35 items that were not capabilities of the target moved to `keywords` (reference implementation features, composite solution features, showcase/demo terms, discovery terms); 5 need assertions were corrected. Each move is a `reclassified` entry `{field, value, to, class, reason}` the gate verifies | §1.1 |
| Preservation gate | Now checks semantics, not words: §1.2 | `preservation.gate.test.ts` |

### 1.1 Capability ownership corrections

"Preserving knowledge does not require preserving an incorrect assertion." No new abstraction was added: a
contextual item became a keyword (still searchable), and its record kept the knowledge in docs and notes.

| Class | Count | Examples (record ← retired source) |
|---|---|---|
| Genuine capability | kept | `rate limiting`, `tiered cache`, `job registry` stay capabilities of their owners |
| Reference implementation feature | 19 | `data tables`, `dropdown menus`, `resizable panes` (component-system ← ui-*); `scatter plot`, `webgl base map`, `timeline rendering` (data-visualization ← viz-*); `retention jobs`, `cleanup jobs` (job-scheduling); `orbit controls`, `animation playback` (threlte-integration); `decorative elements` (visitor-style-resolution) |
| Composite solution feature | 7 | `feedback form` (honeypot ← admin-privacy-feedback); `user account management` (gdpr-data-rights); `ai cropping`, `embedding` (image-metadata-reader); `user preferences`, `theme cookie`, `accessibility settings` (visitor-style-resolution ← app-shell-settings) |
| Showcase / demonstration | 3 | `request visualization`, `developer education` (multi-client-core ← request-cycle visualizer); `live feed` (notification-stream) |
| Keyword / discovery term | 6 | `request lifecycle`, `file placement lookup` (multi-client-core); `spacing`; `basic form patterns`; `database schema`; `ephemeral state` |
| Need corrections | 5 | honeypot's relational-db → implementation (the feedback form's database); notification-stream's key-value-store stays conditional; job-scheduling's relational-db subsumed by its own required need; hierarchical-cache's redis pin removed (any shared key-value store, conditional); data-visualization's tile server → implementation |

Every row is listed with its reason in `manifest.json` (`reclassified`).

### 1.2 What the gate now proves

For every manifest entry, every item of the old record survives on its target(s) **with its semantics**, or
is a recorded intentional correction:

- **refs** keep path, kind, anchor and annotation; tests and showcases stay evidence (a test moved into `docs` fails);
- **needs** keep level, condition and pin, and the justification of a pin or a weak level; a need carried by a
  relationship counts when the target's resolved needs state it at the same level and pin;
- **invariants** hold on the target, own or inherited through `specializes`;
- **alternatives** keep the approach *and* `prefer_when`;
- **maturity**: a proven record's verification survives only on a proven, verified target;
- **relationships**: every old `depends_on` target is adopted, referenced, assumed or an alternative of the
  target, or `relationships.json` records its fate with a reason;
- old ids inside text are normalized to new ids first (a rename is not a loss);
- a `dropped` item needs a reason; a `reclassified` item's claim is checked (the keyword is there, the need
  is there at the named level). Anything else is accidental loss and fails.

Sensitivity was checked by mutation (not committed): changing one need level, moving one test ref into
`docs` and editing one `prefer_when` each failed the gate with the precise reason.

A second block proves `relationships.json` and the registry agree: every current relationship is recorded
exactly once with its type, level and condition; every `depends_on` edge of `786b603` has exactly one fate; a
dropped edge names a home that exists (the assumption applies, the alternative links it, the reference
exists either way, the decision catalogue names it, or the edge is inherited).

## 2. The relationship model

The meaning of each type is one constant, `RELATIONSHIP_SEMANTICS` in `pattern-graph.ts`, quoted by every
surface. Summary:

| Type | Meaning | Traversal | Needs | Invariants | Planning consequence |
|---|---|---|---|---|---|
| `builds_on` `{id, why}` | a foundation that must be available; the target's own equivalent satisfies it | transitive | the foundation's required and conditional needs propagate; optional and implementation stay its own | stay the foundation's | a step before the record, replaceable by an equivalent |
| `composes` `{id, level, when?, why}` | a constituent of the solution | required: transitive; conditional/optional: ends the required chain | required: as builds_on; conditional: required needs become conditional on `when` (conjunction along a path); optional: everything carried is optional | stay the constituent's | required: a step; conditional: open decision while unknown, step when satisfied, omitted when unsatisfied; optional: listed, a step only when the caller includes it |
| `specializes` `{id, why} \| null` | a narrower realization: every A is a B | inheritance (one parent) | parent's required, conditional and optional needs; never implementation | **inherited** | the generalization is never a second step; its foundations and constituents apply at their own levels, the specialization's own relationship to the same record wins |
| `references` `{id, why}` | planning-neutral context | none (may cycle) | none | none | never a step; shown as navigation |
| assumption `{id, applies_to, why}` | a platform convention or principle in scope | by scope, not by edge | none | none | printed under **Assumes** (convention) or **Applies** (principle) for the steps in scope; never a step; an explicit adoption of the same record wins |

Inverses are derived (`edgesTo`), never authored: *built on by*, *part of*, *specialized by*,
*referenced by*. Only the adoption relationships enter the acyclicity check. Principles constrain and are
never steps (a principle builds on, composes and needs nothing, and nothing builds on or composes it);
workflows are procedures (they may build on and compose patterns; nothing adopts a workflow).

### Counts (registry format 5, 170 records: 163 patterns, 4 workflows, 3 principles)

| Relationship | Count |
|---|---|
| `builds_on` | 69 |
| `composes` | 36 — 17 required, 7 conditional, 12 optional |
| `specializes` | 4 |
| `references` | 13 |
| **total** | **122** (90 former edges re-typed or retired, 48 newly authored) |
| scoped assumptions | 5 — `multi-client-core` (code under `src/lib/server/`), `component-system` (code under `src/lib/components/`), `design-philosophy` (principle; components, styles, `app.css`), `explosive-discovery` (principle; 6 ids), `agent-harness-lens` (principle; 6 ids) |
| alternatives linked by id | 7 |
| records with no relationship | 99 (light index rows and leaf mechanisms; an isolated record adopts as itself) |

The complete inventory, per record with rationale, is the generated page of each record (section
"Relationships", with inverses) and `skills/v10r-architecture-selection/references/relationship-graph.md`;
the machine-readable inventory is `pattern-library/registry.json` itself.

## 3. Relationship migration manifest

`pattern-library/reconciliation/relationships.json` (base `786b603`, 138 entries). Every entry is
`{from, to, before: depends_on | none, after: {type, level?, when?} | {type: none, home}, why}`.

| Former `depends_on` (90) | → | Count |
|---|---|---|
| | `builds_on` | 47 |
| | `composes` | 17 |
| | `references` | 7 |
| | `specializes` | 3 |
| | none — scoped assumption | 10 |
| | none — Architecture Engineering decision catalogue | 3 |
| | none — linked alternative | 1 |
| | none — kept as the reverse reference | 1 |
| | none — inherited through a generalization | 1 |
| **New (48)** | `builds_on` 22 · `composes` 19 · `references` 6 · `specializes` 1 | 48 |

Relationships reconsidered because of splits, merges and renames:

- **name-check split** (S8): `name-check` builds on `multi-source-aggregation` and `rate-limiting` (the public
  endpoint's fail-closed limiter keeps the key-value store required); the mechanism builds on
  `resilience-policy`, `deadline-propagation` and `hierarchical-cache`, where the key-value store stays conditional.
- **hosted-mcp ↔ pattern-mcp**: `references` (the S3 note's open question): the same registry tools served over
  stdio; neither surface needs the other.
- **agentic-parametric-modeling → rate-limiting**: dropped as an edge; it arrives through its foundation
  `hosted-mcp` and its generalization `asset-production-pipeline`.
- **architecture-engineering** → `multi-client-core`, `wasm-compute-kernel`, `external-service-runtime`: placement
  alternatives its decision records choose between (`decisions.json`), never steps.
- **agent-skills → pattern-index**: replaced by `pattern-index references agent-skills` (sibling projections).
- **stale-while-revalidate** builds on `hierarchical-cache` and `critical-path-deferred-tail` rather than
  specializing the cache: the golden H5 requires the cache as its own step, and a specialization would hide it.
  This is the one place a proposed type was changed to keep a holdout expectation true; the holdout was not edited.
- **source-of-truth-gate** stays a pattern (decision): `asset-rights-manifest` and `resource-anchor-integrity`
  specialize it.

## 4. Recursive composition — worked examples

Read from `patternGraph(registry).adopt([id])` with every condition unknown. *Steps* are in adoption order;
*open* entries are never adopted or dropped silently.

### MCP authorization (`mcp-authorization`)
- **Required prerequisites (builds on):** `hosted-mcp` (any MCP endpoint), `passwordless-auth`, `rate-limiting` (also reached through hosted-mcp).
- **Steps:** passwordless-auth → rate-limiting → hosted-mcp → mcp-authorization.
- **Constituents / optional / conditional:** none. **Specialization:** none. **Principles / assumptions:** Assumes multi-client-core for all four steps.
- **References:** hosted-mcp references pattern-mcp (navigation only).
- **Needs:** required email-delivery, key-value-store (via rate-limiting), relational-db.

### Agentic parametric modeling (`agentic-parametric-modeling`)
- **Specializes** `asset-production-pipeline`: inherits its 7 invariants and its constituents `derivation-key` and `provenance-record` and its foundation `rate-limiting`; the pipeline itself is **not** a step.
- **Builds on:** `hosted-mcp`. **Composes required:** `mcp-authorization` (which builds on passwordless-auth, rate-limiting).
- **Optional (own relationship wins over the inherited one):** `mcp-app-provider` when the MCP host renders Views; `threlte-integration` when the model is shown in the native viewer.
- **Steps (7):** passwordless-auth → rate-limiting → hosted-mcp → mcp-authorization → derivation-key → provenance-record → agentic-parametric-modeling.
- **Principles / assumptions:** Applies design-philosophy; Assumes multi-client-core, component-system.
- **Needs:** required email-delivery, key-value-store, relational-db; conditional web-worker (native viewer); v10r's implementation also uses llm-provider and vector-search (not needed).

### Agentic architecture (`agentic-architecture`)
- **Composes required:** `agent-actions`, `untrusted-content-boundary`, `turn-trace`; their foundations bring ai-tool-harness, ai-surfaces, deskbot-approval-gate, durable-step-execution. **Steps (8).**
- **Conditional (open decisions):** mcp-protocol-evolution (serves tools to MCP clients), mcp-client, agent-to-agent, ag-ui-endpoint, generative-ui, agent-skills.
- **Optional:** webmcp, agent-observability, mcp-app-provider.
- **Principles / assumptions:** Applies agent-harness-lens (5 steps), design-philosophy; Assumes multi-client-core, component-system. **Specialization / references:** none.
- **Needs:** required llm-provider, relational-db; conditional external-api (A2A delegation or external MCP servers) and key-value-store (when it serves its tools to MCP clients — reached through mcp-protocol-evolution → hosted-mcp → rate-limiting, a nested conditional path).

### Layered retrieval (`layered-rag`)
- **Optional:** `graph-rag` when multi-hop relationship questions matter. **Steps:** layered-rag only.
- **Built on by:** retrieval-endpoints. **Assumes:** multi-client-core. **Specialization / references:** none.
- **Needs:** required llm-provider, relational-db, vector-search; conditional graph-db (its own declaration, stricter than the optional constituent's required graph-db, which is optional through the optional edge).

### Notifications (`notification-outbox`)
- **Composes required:** `notification-channels`, `notification-settings-matrix`. **Optional:** `notification-stream`.
- **Steps:** notification-channels → notification-settings-matrix → notification-outbox. **Assumes:** multi-client-core.
- **Needs:** required relational-db; conditional email-delivery (email channel), external-api (chat channels), scheduler (serverless delivery); optional key-value-store (the stream).

### Application shell (`app-shell-layout`)
- **Composes required:** `responsive-sidebar`, `page-header`. **Optional:** `navigation-structure`.
- **Steps:** responsive-sidebar → page-header → app-shell-layout. **Applies:** design-philosophy. **Assumes:** component-system.
- **Needs:** none required; v10r's implementation uses a service worker (not needed).

### Name check + multi-source aggregation (`name-check`, `multi-source-aggregation`)
- **name-check builds on** `multi-source-aggregation` and `rate-limiting`; the mechanism builds on `resilience-policy`, `deadline-propagation`, `hierarchical-cache`. **Steps (6).**
- **References:** deadline-propagation references resilience-policy (the policy spends the budget).
- **Needs of name-check:** required external-api, key-value-store (the fail-closed limiter); conditional relational-db (stored source credentials).
- **Needs of multi-source-aggregation alone:** required external-api; key-value-store **conditional** (shared breaker, quotas, cache tier across instances), relational-db conditional. The same capability, two adoption scenarios, two levels — the S8 distinction.

### Scoped assumptions in practice
A plan for job scheduling and layered RAG names `multi-client-core` once on the Assumes line for both steps
and builds neither it nor component-system; a plan of UI-only steps names component-system and
design-philosophy and never multi-client-core. A record that adopts the assumed record explicitly does not
get the assumption printed again.

## 5. Requirement resolution

`resolveNeeds` merges every need source reaching a record — own declarations, foundations, required
constituents, the generalization's applicable needs, and conditional/optional constituents at their
weakened levels — into one resolved need per capability:

- **level** = the strictest source; **conditions** (for conditional) = each distinct conjunction of path and declaration conditions;
- **pins** `{technology, conditional, origins}`: an unrestricted declaration never erases a pin; a pin from a
  conditional source stays conditional; only required and conditional pins constrain a binding;
- **conflict** `{technologies, certain}`: two active unconditional pins that differ are a certain conflict;
  a conditional one is a possible conflict;
- **origins** (every declaring record) and **sources** (path, first relationship, declared and effective level);
  "via" prints the origins that carry the resolved level, nothing when the record itself declares it there;
- every list is sorted: results are independent of declaration and traversal order.

### Former expected-fail fixtures

All six Slice 2 gaps are resolved and the fixture expectations are unchanged (the only edit is the relationship
field name, `depends_on` → `builds_on`). The 11 `it.fails` cases are ordinary tests; with every permutation of
prerequisites the file runs 14 cases, all passing:

| Fixture | Slice 2 | Slice 3 |
|---|---|---|
| an unrestricted requirement does not override a pinned one | fails (pin erased) | pass |
| two different conditions are both kept | fails (one kept) | pass |
| incompatible pins are reported as a conflict | fails (last wins) | pass |
| a requirement dominates a condition without losing the conditional origin | fails (origin lost) | pass |
| a need shared by two prerequisites appears once with both origins | fails (one origin) | pass |
| the record's own declaration and an inherited one both count as origins | fails | pass |
| optional and implementation needs never become requirements of a dependent | pass | pass |
| a diamond reaches the shared need once | pass | pass |

## 6. One graph module

`pattern-library/pattern-graph.ts` (framework-free, filesystem-free, deterministic; runs in the offline MCP
bundle) is authoritative for traversal, relationship interpretation, composition, required/optional
reachability, condition states, assumptions, need resolution, invariant inheritance, inverses, provenance and
adoption order. `graphOf(registry)` caches one graph per registry object.

Replaced: `topoSort` (schema), `adoptionNeeds` (infrastructure-needs), the plan's own closure (query), the
explorer's BFS, the page generator's "Depends on" section, the skills generator's dependency graph, Vely's
need summary, the showcase DAG's edges. `infrastructure-needs.ts` keeps only display (labels, target fitness).
`pattern-graph.gate.test.ts` fails on a retired walker in live code, on a new file reading relationship
fields outside the listed display readers, and on a display reader that follows a relationship to read the
target's relationships. The registry stays the only authority; no PostgreSQL or Neo4j projection; the Slice 4
planner is not built (selection is unchanged).

## 7. Tests

| File | Covers |
|---|---|
| `pattern-graph.test.ts` (26) | required/conditional/optional constituents and their needs; satisfied/unsatisfied/unknown conditions; nested conditions as conjunctions; optional carrying making strict needs optional; diamonds; a shared constituent reached through required and optional paths; several proposers; multiple origins; unrestricted vs pinned; conditional vs unconditional pins; certain and possible conflicts; implementation and optional needs staying their owner's; specialization (no second step, own edge wins, invariants and applicable needs inherited, implementation never); principles by scope; explicit adoption winning over an assumption; workflow semantics; reference cycles with no adoption effect; isolated records; unknown ids; order independence over every permutation |
| `relationships.test.ts` (15) | negative validation: missing target, self, a pair related twice across types, missing rationale and malformed id, constituent levels and conditions, retired `depends_on`, adoption cycles through builds_on/composes and through specializes, reference cycles allowed, adopting a principle or a workflow, a principle that adopts, cross-kind specialization, an alternative that is adopted or missing, assumptions (unconditional, unknown, duplicated, a workflow, matching nothing, unknown category) |
| `pattern-graph.gate.test.ts` (3) | one walker (above) |
| `preservation.gate.test.ts` (152) | §1.2 |
| `infrastructure-needs.test.ts` (14) | §5 |
| updated | explorer (adoption order, open constituents, reference-only records stand alone), plan precision (assumptions named, never steps), cards, pages, skills, showcase projection, stdio server order, registry format |

## 8. Benchmark comparison

All 20 scenarios against the preserved baseline, identical expectations, dev (design) and holdout kept apart.
Holdout expectations were not edited and nothing was tuned against them.

| Metric | Baseline (rescored) | Slice 2 | **Slice 3** |
|---|---|---|---|
| design precision | 42.1 | 52.9 | **62.8** |
| design recall | 80 | 90 | 90 |
| design unnecessary steps | 31 | 22 | **16** |
| design optional made required | 2 | 2 | **0** |
| design optional coverage | 0 | 0 | **100** |
| design need recall / level accuracy | 60.9 / 43.5 | 91.3 / 82.6 | 91.3 / 82.6 |
| design spurious required needs | 7 | 6 | 4 |
| holdout precision / recall | 63.6 / 50 | 63.6 / 50 | 63.6 / 50 |
| holdout need recall / level accuracy | 41.7 / 33.3 | 50 / 50 | 50 / 50 |
| all precision / recall | 45.6 / 70.5 | 54.8 / 77.3 | **63 / 77.3** |
| pin preservation | 0 | 0 | 0 |
| fact need recall (golden steps' resolved needs) | 40 | 100 | 100 |

Original expectations (18 scenarios): precision 51.9 → 61.4, recall 73 unchanged, optional coverage 0 → 100.

**Where the gains come from.** Ranking did not change (retrieval benchmark: dev and holdout Acc@1, Recall@3 and
MRR identical to Slice 2). Every step-metric gain is a relationship-semantics effect: S5 loses 6 unnecessary
steps because the decision-catalogue alternatives are no longer edges; S4 stops building its two optional
constituents and its generalization; H10 stops building `state-management` (now the generalization of
`url-search-state`; that step was acceptable, so the holdout score does not move); `multi-client-core` leaves
seven plans as an assumption (acceptable in every golden, so no score moves). Optional coverage needed the
plan to name open constituents by id in backticks, like steps — the formatting is the same for every scenario
and has no holdout case. Fewer competing records (Slice 2) and typed relationships (Slice 3) explain the
numbers, not better selection.

**Open limitations (not solved, Slice 4):** holdout recall 50% (H2, H3, H4, H8, H9 select the wrong record:
passwordless-auth, file-uploads, notification-outbox, gdpr-data-rights, web-push are never picked); pin
preservation 0 (the pinned scenario S10 misses its step `database-branch-refresh`); wrong selection and
unnecessary steps in S1 (6), S2, S3 (3), S6 (2), S9, S10 (3), H3, H8, H9; S6 requests "graph rag" by name and
the plan still leaves `graph-rag` an open optional constituent — settling a condition from the request is
selection, not inference the graph may do. Do not read the precision gain as planner quality.

**Retrieval benchmark (`mcp:bench`).** Accuracy unchanged. Plans are 15% smaller (`recommend_emulation_plan`
mean ≈ 2212 tokens, was 2598); cards and search rows 4% larger (relationship lines). p95 latency of
`recommend_emulation_plan` 473 → 953 µs, still under a millisecond (the graph is built once per registry).

## 9. Regenerated surfaces

`patterns:build` (156 of 172 pages changed: the Relationships section with inverses), `skills:build` (71 files;
`dependency-graph.md` → `relationship-graph.md`), `mcp:bundle:build`, `mcp:apps:build` (explorer view labels),
`mcp:excerpts:build`. The RAG ingest was not run (cloud: no database).

## 10. DB and deployment

Release-blocking checklist and reconciliation procedure: [release-checklist.md](./release-checklist.md).
Nothing outside the tree was changed or deleted; the inventory counts are unknown until a read-only run.

## 11. Remaining issues

1. Slice 4: selection (holdout recall 50%), pin preservation, excluded-prerequisite conflicts, settling a
   condition from an explicit request.
2. 99 records have no relationship; most are light rows. Light rows that are real constituents of a deep
   record were related; the rest were not guessed.
3. Telemetry rows keep old ids (release checklist row 1) — ApeDevil's choice.
4. `stale-while-revalidate` uses builds_on where specializes was proposed (§3); revisit if H5 is reviewed.
5. Desk relationships remain deferred (D-14; the Desk is being refactored).
6. The worked examples' plans still print v10r's implementation-only needs as "not needed" lines; correct, but
   long for agentic records.

## 12. Validation

`bun run validate` (413 files, 4958 tests, stdio server 25 tests, every check) and `validate:build` (production build, 5 perf ratchets within ceilings) pass on the final tree. Not run in the cloud: the RAG ingest, `content:check:db`, live MCP hosts, anything against the database or Neo4j.
