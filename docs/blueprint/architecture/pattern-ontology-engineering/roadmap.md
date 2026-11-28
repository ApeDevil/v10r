# F. Development roadmap

Eight slices, foundational corrections first. Each slice ends at a review checkpoint where ApeDevil reviews the
pushed branch before the next one starts. No compatibility layers: fields are renamed and every reader is
changed in the same slice. Slices 1–5 are the core; 6–8 can be reordered or dropped.

Common to every slice: development on a feature branch, `bun run validate` green in the cloud (with
`NODE_OPTIONS` heap cap set by hand), `bun run patterns:build` + `mcp:excerpts:build` + `skills:build`
regenerated, `db:ingest-docs` reported as **not run** in the cloud, MCP compatibility constraints respected
(text-only results on shared tools, no `title`/`readOnlyHint`/`outputSchema` while B1 and C2 are open).

## Slice 0 — Ratify this review (no code)
- **Objective:** decisions D-01 … D-14 answered; golden scenarios in [verification.md](./verification.md) accepted or amended.
- **Deliverable:** updated decision register. **Checkpoint:** ApeDevil's answers.

## Slice 1 — Truthful facts and vocabulary (foundation)
- **Objective:** every record states its infrastructure needs; no canonical field states a volatile fact; the registry has a content identity.
- **Scope / changes:**
  - Replace `PATTERN_REQUIREMENTS` with the capability vocabulary + bindings ([target-ontology.md §C.4](./target-ontology.md#c4-infrastructure-needs)); `target_infra` accepts needs and bindings.
  - Fill needs on all records (≈54 currently missing, list in [reconciliation.md](./reconciliation.md)); light records may and must carry needs.
  - New gate: **import-scan needs evidence** — code refs importing infra adapters imply a need; allow-list with reasons.
  - New gate: AE `NODE_KINDS[*].requires` ⊆ transitive needs of their patterns.
  - Titles become canonical names; numerals gated (allow-list: OAuth 2.1, A2A, 3D, N+1, …); fix `pattern-index` summary counts.
  - `version` → `format` integer + computed digest; bench results record the digest.
  - `docs/naming.md`: pattern vocabulary rows (§C.8); correct the "capability" subjects and the `dependency` inversion.
- **Affected:** `schema.ts`, `registry.json`, `validate.ts`, `query.ts` (target_infra), `architecture-engineering/vocabulary.ts`, generated docs/skills/excerpts, bench.
- **Dependencies:** D-06, D-09. **Breaking:** `target_infra` values, `requires` values.
- **Risks:** curation errors in needs → mitigated by the import-scan gate; over-declaring conditional needs → `when` form.
- **Acceptance:** 0 records whose code imports an infra adapter without the need; "hosted mcp" plan names `relational-db, key-value-store`; 0 node-kind contradictions; 0 numerals outside the allow-list in titles.
- **Checkpoint:** diff review of needs per record.

## Slice 2 — Typed relationships and one graph module
- **Objective:** `depends_on` is replaced by `builds_on`, `composes {optional, when}`, `specializes`; baseline declared once.
- **Scope / changes:** schema + validation (§C.3 invariants 1–7); migrate all 88 edges per [edge-classification.md](./edge-classification.md) and add the missing edges listed in the reconciliation (e.g. `layered-rag composes? ai-graph-rag`, `hosted-mcp composes rate-limiting`, analytics/retention `builds_on jobs-scheduler`, `admin-privacy-feedback composes honeypot`); root `assumes`; new `pattern-library/pattern-graph.ts` (closure, inverses, inherited invariants, typed needs) replacing the three walkers.
- **Affected:** `schema.ts`, `registry.json`, `query.ts`, `dependency-explorer.ts`, `render.ts`, `agent-skills.ts`, `registry-viz.ts`, tests.
- **Dependencies:** Slice 1, D-01, D-05. **Breaking:** `depends_on` removed; generated pages and skills change.
- **Risks:** edge-type judgement → each non-trivial edge carries a one-line reason in review; cycles via the union → gate.
- **Acceptance:** 0 untyped edges; union acyclic; every existing reader uses `pattern-graph.ts` (architecture test forbids a second closure); MCP 3D tree as in §C.7.
- **Checkpoint:** review the composition trees of the six composites (MCP 3D, MCP authorization, agentic architecture, layered retrieval, notifications, app shell).

## Slice 3 — MCP and Vely read the typed graph (extend, don't add tools)
- **Objective:** agents get relationships, inverses and reasons deterministically.
- **Changes:**
  - `get_pattern` header: builds on / composed of (optional + when) / specializes, plus derived inverses and inherited-invariant count.
  - `recommend_emulation_plan`: new `ids` argument (exact selection, no inference); light records eligible (printed "no invariants recorded"); optional constituents listed, `include_optional` to add them; "why included" per step; principles as constraints; steps that build on a lacking step computed; conditional needs.
  - `explore_patterns` moves into the shared query layer: stdio serves it as text, hosted keeps the View; overview covers every record; `relation` filter; fix the title-as-capability next action and the recovery text.
  - `trace_capability` renders through the shared card sections (adds fitness and needs).
  - `QUERY_WORKFLOW` teaches `explore_patterns`; parity test covers 9 tools; compat kit count updated.
  - Vely `search_pattern_library` renders rows through the query layer (strength, transitive needs, relationships).
- **Dependencies:** Slice 2. **Breaking:** tool text changes; new optional args only (no schema field removed).
- **Risks:** Claude Code compatibility → no `title`/annotations/`outputSchema`; run `scripts/mcp/claude-code-compat/check.sh` in the cloud, ApeDevil's local run remains B1.
- **Acceptance:** golden scenarios in verification.md meet their targets; parity test green on both transports; next-actions gate green.
- **Checkpoint:** side-by-side plans before/after for the eight scenarios.

## Slice 4 — Evidence-derived maturity
- **Objective:** maturity means what it says.
- **Changes:** `evidence[]` with kinds shared with AE `EVIDENCE_KINDS`; maturity derived (proven / demonstrated / implemented / planned); `verifiedSha` removed; `live-check` entries for MCP 3D, MCP authorization, A2A etc.; README/CLAUDE copy stops calling every record "proven"; catalog shows maturity.
- **Dependencies:** D-08. **Breaking:** `tests`, `showcases`, `maturity`, `verifiedAt`, `verifiedSha` fields; `search_patterns maturity` filter values.
- **Acceptance:** maturity computed for all records; gate: every `unit-test`/`db-test` path is inside a vitest project include; 0 hand-set maturities.

## Slice 5 — Measure composition (can start in parallel with Slice 2)
- **Objective:** prove the changes improve engineering decisions.
- **Changes:** add golden composition scenarios to `pattern-library/bench/` (step precision/recall, required-need recall, unnecessary steps, optional handling, light reachability, calls/tokens), measured through the real tools; record the baseline on today's registry first.
- **Acceptance:** baseline committed before Slice 2 lands; targets in verification.md met after Slice 3.
- **Decision gate:** D-07 (controlled capabilities) is decided on these numbers.

## Slice 6 — Reconcile records and human surfaces
- **Objective:** the registry holds patterns; every human surface shows one model.
- **Changes:** `kind` field; merges/folds/reclassifications per [reconciliation.md](./reconciliation.md) (≈199 → ≈165 records); refs of retired records move to their target; one Pattern Explorer on `/docs/pattern-library` with perspectives (taxonomy, composition, dependency, evidence) backed by `pattern-graph.ts`; `/showcases/mcp` graph uses the same projection (remove the deep-only DAG and `DAG_SHORT_LABELS`); pattern pages show inverses and capabilities; showcases and workflows link back; Studio `PatternLinks` shows title + maturity; `PatternRef` format for persisted references.
- **Dependencies:** Slices 2, 4; D-03, D-04. **Breaking:** ids of merged records disappear (no redirects — no users).
- **Risks:** losing knowledge in merges → gate: every ref of a retired record exists on its target.
- **Acceptance:** catalog, explorer, `/showcases/mcp` and pages agree on counts (one test); 0 non-pattern records.

## Slice 7 — Semantic-integrity gates and the authoring path
- **Objective:** correct future work is the path of least resistance.
- **Changes:** retired-term list generated from naming.md's Retired column (not a hand list); prose-count binding for the docs that state registry counts (or remove the counts); advisory overlap report (shared code dirs + showcases); correct the four-invariant claim in CLAUDE.md/self-expressive-project.md or gate it; an authoring skill/README section: "add / extend / compose / retire a pattern" with the gate as the checklist.
- **Acceptance:** each self-expressive facet maps to a gate or is explicitly declared practice.

## Slice 8 — Platform vocabulary outside the pattern domain (optional, separate scope)
- Outcome/lifecycle vocabularies, owner columns, corpus vocabularies, Neo4j identities, dead enum values, doc drift in data docs (F28, F29). Only after ApeDevil decides scope (D-13).

## Order and dependencies

```text
S0 ─► S1 ─► S2 ─► S3 ─► S6 ─► S7
            │      ▲
            └► S5 ─┘   (baseline before S2 merges; targets checked after S3)
      S1 ─► S4 ─► S6
S8 independent, after S7
```
