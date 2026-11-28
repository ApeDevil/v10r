# A. Current-state analysis

Reviewed commit: **`5720c96`** (`origin/main`, 2026-11-28). Registry `version` field: `2.2.0`. Every number
below was recomputed from the repository at that commit; none is copied from the external pre-review.

## A.1 Baseline statistics

| Metric | Pre-review (external) | Recomputed | Note |
|---|---:|---:|---|
| Patterns | 199 | **199** | `registry.json` |
| Groups / categories | 7 / 30 | **7 / 30** | 3 categories hold one record (`toolkits`, `integrations`, `office-workflows`) |
| Deep / light | 63 / 136 | **63 / 136** | |
| Proven / implemented / planned | 173 / 26 / — | **173 / 26 / 0** | `planned` is defined but unused |
| `depends_on` edges | 88 | **88** | |
| Cross-category edges | 38 | **38** | 33 cross a group boundary |
| Patterns in the dependency graph | 75 | **75** | |
| Patterns with no edge at all | 124 | **124** | |
| Edges into a light record | 19 | **19** | 17 from deep records, 2 light → light |
| Light records with empty `requires` | 136 | **136 (all)** | 0 light records declare any infrastructure |
| Deep records with empty `requires` | — | **40 of 63** | |
| `requires` vocabulary entries never used | — | **4 of 13** | `neo4j`, `object-storage`, `service-worker`, `wasm-toolchain` |
| Distinct `capabilities` strings | — | **627** | across 648 mentions; only **21** are shared by two records |
| Longest `depends_on` chain | — | **6** | |
| Proven records attested by one bulk stamp | — | **124 of 173** | all `verifiedAt 2026-08-20`, `verifiedSha 1a130d67` |
| `verifiedSha` values resolvable in git history | — | **3 of 23 distinct** | history was rewritten; the attestation cannot be checked |
| Proven light records with no test ref | — | **97 of 121** | proof is a showcase route; 14 rely on an app route only |
| `patterns:validate` | — | **OK, 0 errors, 13 warnings** | 13 × "implemented but has tests/showcases" |
| `mcp:bench` relevance (dev / holdout / holdout2, Acc@1) | — | **100 / 80 / 79.4** | run in this review; committed `results.json` still says 188 patterns, `baseline.json` 175 — both under version 2.2.0 |

The registry `version` stayed `2.2.0` while the record count went 175 → 188 → 199. No gate binds the version to the content.

## A.2 The implicit ontology, as the code expresses it

```text
Registry (version, note)
 ├── Group (id, title)                       1 ─< Category
 ├── Category (id, title, group)             1 ─< Pattern          ← navigation taxonomy, single-valued
 └── Pattern (id)
      ├── identity     id (kebab, 150/199 prefixed with their category), title (144 carry a parenthetical summary)
      ├── fitness      summary, when_to_use, avoid_when[], alternatives[{approach, prefer_when}] (free text), risk (free text "low|medium|high — …")
      ├── needs        requires[]  → closed list PATTERN_REQUIREMENTS (13 words: technologies and capabilities mixed)
      ├── discovery    capabilities[] (free text), keywords[] (free text)
      ├── relation     depends_on[] → Pattern   (one untyped edge; acyclic; nothing else)
      ├── references   docs[] code[] tests[] showcases[]  → Ref {path, note?, kind: file|dir|route|approute|anchor}
      ├── depth        tier deep|light  → deep: invariants[] + emulation_notes[] required; light: both forbidden
      └── evidence     maturity planned|implemented|proven  + verifiedAt/verifiedSha (hand-set attestation)

Architecture Engineering (pattern-library/architecture-engineering/) — a second, well-typed ontology
 ├── Decision (id, revision, domain, question, problem, alternatives[], rules[], fallback, changes_when, evidence[], evolution, confirmation)
 │    └── Alternative (id, approach, placement, technologies[], benefits, drawbacks, prerequisites, contraindications, prefer_when, patterns[] → Pattern)
 ├── NodeKind (label, placements, zone, deploysAs, requires[] → PATTERN_REQUIREMENTS, accepts[] → Protocol, patterns[] → Pattern)
 ├── EngineeringDomain, WorkloadFactor, Placement, Protocol, ZoneKind, EvidenceKind (closed vocabularies)
 └── Finding (severity × category)

Outside pattern-library/
 ├── Showcase catalog (src/lib/showcases/catalog/registry.ts) — routes; patterns point at it, it never points back
 ├── Workflow catalog (src/lib/workflows/catalog.ts) — /workflows tutorials; no pattern ids
 ├── Studio catalog (src/lib/studio/catalog.ts) — areas; "architecture" area
 └── Derived: README Pattern Index, docs/pattern-library/*.md, 8 Agent Skills, MCP excerpt snapshot,
     retrieval.document/chunk (embedded pattern pages), explore_patterns View, /showcases/mcp DAG
```

**Explicitly modelled** (types + validation): identity, category/group, tier, maturity contract, refs and their existence, `requires` vocabulary, `depends_on` existence and acyclicity, decision references to pattern ids.

**Only implicit** (prose, naming, behaviour):

| Concept | Where it lives today |
|---|---|
| Composition (a pattern containing others) | `depends_on` + summaries ("runs Manifold behind this same pipeline") |
| Optional constituents | prose only; the plan treats every edge as mandatory |
| Specialization | prose ("one of three timing strategies"), id prefixes |
| Alternatives between registry patterns | free-text `alternatives[].approach` naming a pattern title; AE `Alternative.patterns` |
| Kind of record (principle, workflow, component inventory, showcase, doc view) | prose ("a review heuristic, not a rule", "a conceptual audit lens (not a module)") |
| Capability as a concept | 627 unique strings, matched lexically |
| Technology | titles ("Upstash Redis", "Chart.js") and AE `technologies[]` free text |
| Platform baseline (what every pattern assumes) | one sentence in `schema.ts` ("every pattern assumes the v10r stack's runtime") + 9 ad-hoc `depends_on multi-client-core` edges |
| Infrastructure of light patterns | in AE `NODE_KINDS.requires` (e.g. relational-db → postgres) but not in the records themselves |
| Evidence kind | split between `tests[]`, `showcases[]` (route + approute) and AE `EVIDENCE_KINDS` |
| Registry content identity | `version` string, hand-maintained, not bound to content |

## A.3 Cardinalities and identity rules as implemented

| Relation | Cardinality | Enforced by |
|---|---|---|
| Pattern → Category | exactly 1 | `parseRegistry` |
| Category → Group | exactly 1 | `parseRegistry` |
| Pattern → `depends_on` Pattern | 0..n, acyclic, no self | `parseRegistry` + `validate.ts` topo sort |
| Pattern → Ref | docs ≥ 1; deep also capabilities/keywords/avoid_when/invariants/notes ≥ 1 | `schema.ts` per-tier contract |
| proven ⇒ (tests ∪ showcases) ≥ 1 ∧ verifiedAt | structural | `schema.ts` |
| Decision/NodeKind/Lab → Pattern id | 0..n, must resolve | `validate.ts`, `checks.test.ts` |
| Pattern id ↔ docs page slug | 1:1, by convention | `render.ts` ("flat slug = registry id"); ingest re-slugifies |
| Pattern id in persisted data | 3 spellings: `<id>` (`mcp.call_log.subject`), `pattern:<id>` (turn grounding), `/docs/pattern-library/<id>` (`retrieval.document.source_uri`) | none |

## A.4 Component inventory (pattern knowledge only)

| Layer | Component | Role | Reads |
|---|---|---|---|
| Authority | `pattern-library/registry.json`, `schema.ts` | records + shape | — |
| Authority | `architecture-engineering/decisions.json`, `vocabulary.ts` | decisions, node kinds | pattern ids |
| Query | `query.ts`, `search.ts`, `dependency-explorer.ts`, `architecture-queries.ts`, `excerpt.ts` | tool logic, written once | registry |
| Gate | `validate.ts` (`patterns:validate`), `patterns:check`, `skills:check`, `mcp:excerpts:check`, `mcp:bundle:check`, `mcp:apps:check` | integrity + derived freshness | registry |
| Transport | `mcp/stdio-server.ts` (8 tools), `src/lib/server/mcp/patterns/` (public/private: 9 tools incl. `explore_patterns`) | MCP | query layer |
| App domain | `src/lib/server/patterns/` (catalog, render, agent-skills, registry) | docs pages, catalog, skills | registry |
| AI | `src/lib/server/ai/tools/search-pattern-library.ts` (Vely) | in-app lookup | registry (own row shape) |
| Persistence | `retrieval.document`/`chunk` (embedded pattern pages), `mcp.call_log.subject`, `ai.turn.grounding` | derived text and references | generated docs |
| Neo4j | no pattern data (`:Chunk`, `:Entity`, `:Resource` from showcases, demo `:Technology`/`:Concept`) | — | — |
| Frontend | `/docs/pattern-library` catalog + pages, `/showcases/mcp` DAG (deep-only), `explore_patterns` MCP App View, `/studio/architecture` (ids only), `/showcases/interop` (skills) | human views | registry / AE |
| Benchmark | `pattern-library/bench/` + `scripts/mcp/retrieval-bench.ts` | retrieval relevance, 5 plan checks, oracle workflows | `scorePatterns`, query layer |

## A.5 What is good and should be preserved

- **One authority in git, read by every runtime.** The registry, its schema and the query layer are framework- and filesystem-free and shared by stdio, hosted MCP, the app and the bench. Parity by construction is real (`parity.test.ts`).
- **Fail-closed, executable constraints.** Ref existence, anchor resolution, acyclicity, the maturity/attestation contract, derived-artifact freshness checks, decision-reference resolution.
- **Fitness before the how.** `avoid_when`, `alternatives`, transitive `requires` with `via` attribution, and `target_infra` verdicts are a strong, unusual design that most pattern catalogues lack.
- **Progressive disclosure and bounded responses** (ids → compact → summary → card sections; named withheld sections; next actions on every failure).
- **Architecture Engineering's typed vocabularies** (placement vs runtime vs language vs deployment unit kept apart) — the most precise ontology in the repo and a model for the rest.
- **Deliberate rejections** that remain right: no embeddings for 200 records, no RDF/OWL, no DB-stored registry, no `structuredContent` on text tools while Claude Code hides the body.
