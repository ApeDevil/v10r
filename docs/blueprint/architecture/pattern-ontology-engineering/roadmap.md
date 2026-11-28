# F. Development roadmap

Reconciled with ApeDevil's rulings of 2026-11-28 ([decision register](./decision-register.md)). Changes from
the reviewed version: the composition benchmark and its baseline come first (before any planner change); entity
kinds and record reconciliation move ahead of relationships and planning (D-03: foundations before consumers);
the identifier review is part of reconciliation (D-10); evidence gets provenance and verification semantics
(D-08); the platform-wide slice is mandatory (D-13). The structure stays: one slice at a time, each ending at a
review checkpoint where ApeDevil reviews the pushed branch. Nothing proceeds past a checkpoint automatically.

Common to every slice: development on `claude/cloud/pattern-ontology-engineering`; no compatibility layers
(fields and ids change and every reader changes in the same slice); `bun run validate` in the cloud (heap cap
set by hand); `patterns:build`, `mcp:excerpts:build`, `skills:build` and the stdio bundle regenerated;
`db:ingest-docs` reported as **not run** in the cloud; MCP compatibility constraints respected (text-only
results on shared tools, no `title`/`readOnlyHint`/`outputSchema` while B1 and C2 are open); the **composition
benchmark is re-run and its results committed at every checkpoint**, compared with the committed baseline.

## Slice 0 — Ratify the review ✓
Decisions D-01 … D-14 answered 2026-11-28; golden scenarios accepted; holdout scenarios required.

## Slice 1 — Benchmark baseline and truthful infrastructure facts
- **Objective:** a committed composition benchmark measures plans before anything changes; every record states
  its infrastructure needs at the right level; no title states a volatile fact; the registry has a content identity.
- **Changes:**
  1. Composition benchmark (`pattern-library/bench/composition-*.json`, `scripts/patterns/composition-bench.ts`):
     the eight golden scenarios plus independent holdout scenarios, measured through the real
     `recommend_emulation_plan`. **Baseline committed before any registry or planner change.**
  2. `PATTERN_REQUIREMENTS` → `INFRASTRUCTURE_NEEDS` with bindings; record field `requires` → `needs` with levels
     required / conditional / optional / implementation and justified pins (D-06); `target_infra` accepts need and
     technology ids; plan, card, explorer and skills print needs by level.
  3. Needs curated on all records; gate: import-scan needs evidence (direct adapter imports must be declared).
  4. Gate: Architecture Engineering node-kind needs consistent with their patterns.
  5. Titles become canonical names (D-09); gate on numerals and version references in titles (allow-list).
  6. `version` → `format` (schema format integer) + computed content digest; bench results carry the digest.
  7. D-14: drop the Desk-specific edge `ai-agent-actions → desk-workspace` (knowledge kept in its refs).
  8. `docs/naming.md`: infrastructure-need vocabulary.
- **Not in this slice:** selection logic (deep-only, runner-up rule) and edge semantics: they change in Slice 4
  and Slice 3, measured against the Slice 1 baseline.
- **Acceptance:** 0 records whose code imports an adapter they do not declare; "hosted mcp" plan names
  `relational-db, key-value-store`; 0 node-kind contradictions; 0 title numerals outside the allow-list;
  required-need recall on the benchmark improves without a drop in step metrics.
- **Checkpoint:** review the needs diff per record and the benchmark delta.

## Slice 2 — Entity kinds, record reconciliation and identifiers
- **Objective:** the registry holds genuine reusable knowledge, each record says what adopting it means, and each
  id names its concept.
- **Changes:** `kind: pattern | principle | workflow` with the adoption semantics of
  [§C.2](./target-ontology.md#entity-kinds-and-their-adoption-semantics) (D-03); retire, fold and merge per
  [reconciliation.md](./reconciliation.md) (D-04), moving every doc, code, test and showcase ref to its canonical
  record; comprehensive identifier review (D-10): ids coupled to taxonomy (`databases-`, `architecture-`, …) or
  misleading are renamed where the rule "an identifier names the concept, not its organizational location"
  says so, every consumer updated directly (skills, excerpts, bench fixtures, decisions.json, evidence labs,
  showcase links, persisted pattern references), no aliases; obsolete categories removed (D-11).
- **Deliverables:** rename and retirement manifest (old id → new id or target, reason, refs moved);
  knowledge-preservation gate: every ref of a retired record exists on its target.
- **Dependencies:** Slice 1. **Breaking:** ids, record count, generated pages and skills.
- **Acceptance:** 0 records without `kind`; manifest complete; preservation gate green; benchmark not worse.
- **Checkpoint:** manifest review.

## Slice 3 — Typed relationships, scoped assumptions, one graph module
- **Objective:** `depends_on` is replaced by `builds_on`, `composes {optional, when}`, `specializes` with the
  semantics of [§C.3](./target-ontology.md#c3-relationships); platform assumptions are scoped (D-05).
- **Changes:** schema + validation (§C.3 invariants); migrate the edges of the reconciled records per
  [edge-classification.md](./edge-classification.md) plus the missing ones listed in the reconciliation;
  non-dependency edges to `references` if D-15 is accepted; alternatives linked by canonical id;
  `assumptions: [{id, applies_to}]`; new `pattern-library/pattern-graph.ts` (closure with per-path required-ness,
  inverses, inherited invariants via `specializes`, typed needs) replacing the three walkers.
- **Dependencies:** Slices 1–2. **Breaking:** `depends_on` removed.
- **Acceptance:** 0 untyped edges; union acyclic; every reader uses `pattern-graph.ts` (architecture test);
  composition trees of the composites (MCP 3D, MCP authorization, agentic architecture, layered retrieval,
  notifications, app shell) reviewed.
- **Checkpoint:** composition trees and the D-15 decision.

## Slice 4 — Ontology-aware emulation planning (MCP and Vely)
- **Objective:** plans follow the planning rules of [§C.3.2](./target-ontology.md#c32-planning-rules-deterministic-apply-to-every-consumer).
- **Changes:** `recommend_emulation_plan`: `ids` (exact selection, D-07), light records eligible, kinds honoured
  (principles under "Applies", workflows as procedures), optional constituents listed with tri-state conditions
  (`include_optional` / `exclude`), blocked and conflicting prerequisites reported, a reason chain per step,
  shared constituents deduplicated; `get_pattern` header shows typed relations and derived inverses;
  `explore_patterns` moves into the shared query layer (stdio serves it as text); `trace_capability` renders
  through the shared card; Vely's `search_pattern_library` uses the same query layer.
- **Dependencies:** Slice 3. **Breaking:** tool text; new optional args only.
- **Acceptance:** golden and holdout targets in [verification.md](./verification.md) met; parity on both
  transports; Claude Code compat kit run in the cloud (ApeDevil's local run remains B1).
- **Decision gate:** D-07 (controlled capability vocabulary) decided on these numbers.
- **Checkpoint:** side-by-side plans before and after for every benchmark scenario.

## Slice 5 — Evidence model and derived maturity
- **Objective:** maturity means what it says (D-08 as adjusted).
- **Changes:** `evidence[]` with scope (`covers`); a generated verification ledger (result, provenance, content
  identity of the code it ran against); maturity derived per [§C.5](./target-ontology.md#c5-evidence-and-maturity);
  `verifiedSha` and the bulk `verifiedAt` stamp removed; live checks for MCP 3D, MCP authorization, A2A;
  README/CLAUDE copy stops calling every record "proven".
- **Dependencies:** Slice 2 (records), Slice 3 (invariants inherited). **Breaking:** `tests`, `showcases`,
  `maturity`, `verifiedAt`, `verifiedSha`; `search_patterns` maturity filter values.
- **Acceptance:** maturity computed for all records; 0 hand-set maturities; every machine check path is inside
  a vitest project; a stale code hash demotes maturity in a test fixture.
- **Checkpoint:** prototype on three records first, then the full migration.

## Slice 6 — Human surfaces on one projection
- **Objective:** every human surface shows the same model agents get (open question 2).
- **Changes:** one Pattern Explorer on `/docs/pattern-library` (taxonomy, composition, dependency, evidence
  perspectives) backed by `pattern-graph.ts`; `/showcases/mcp` graph uses the same projection; pattern pages show
  inverses, needs by level and maturity; showcases, workflows and Studio link back to patterns.
- **Acceptance:** catalog, explorer, `/showcases/mcp`, pages and tools agree on counts (one test).

## Slice 7 — Semantic-integrity gates and the authoring path
- **Objective:** correct future work is the path of least resistance; claims match enforcement (D-12).
- **Changes:** retired-term list generated from naming.md; prose counts bound or removed; advisory overlap
  report; each self-expressive facet mapped to a gate or labelled "practice requiring judgement"; authoring
  procedure (add / extend / compose / retire a pattern) with the gate as the checklist.

## Slice 8 — Platform-wide semantic integrity (mandatory, D-13)
- **Objective:** the ontology is coherent beyond the pattern library.
- **Scope:** persistence vocabularies (outcome, lifecycle, retired/archived), ownership semantics (owner
  columns), corpus identities, Neo4j identities and relationship types (F29), dead enum values, data-doc drift
  (F28), server/frontend/MCP/AI terms. An investigation inventory first; genuinely different concepts keep
  different terms.
- **Checkpoint:** inventory and proposed changes before any schema change; live database changes only on
  ApeDevil's word.

## Order and dependencies

```text
S0 ✓ ─► S1 ─► S2 ─► S3 ─► S4 ─► S6 ─► S7 ─► S8
              │            ▲
              └──► S5 ─────┘ (S5 after S3; S6 needs S4 and S5)
benchmark: baseline in S1, re-measured at every checkpoint
```
