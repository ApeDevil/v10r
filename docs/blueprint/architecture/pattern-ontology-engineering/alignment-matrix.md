# E. Cross-platform alignment matrix

How each proposed concept appears in each layer. **A** = authority (authored here), **D** = derived
(generated or computed, gated for freshness), **R** = reference only (stores an id, never content),
**—** = deliberately absent. "Today" notes the current gap.

## E.1 Concept × layer

| Concept | Registry | PostgreSQL | Neo4j | Server domains | APIs | Frontend | MCP | Vely | Arch. Engineering | Retrieval | Docs | Agent Skills | Validation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pattern identity | **A** `id` | R `PatternRef` in call_log / grounding (today: 3 spellings) | — | R via `#lib/server/patterns` | R in URLs `/docs/pattern-library/<id>` | D catalog, pages, explorer | D all tools | D shared rows | R decision/node-kind ids | R `source_uri` → parsed by one helper | D pages | D references | ids resolve everywhere (exists for AE; add showcases, workflows, bench) |
| Kind (pattern/principle/workflow) | **A** | — | — | D | — | D badge + filter | D card header, plan treats principles as constraints | D | — | — | D | D | enum; principle never a step target |
| Tier (doc depth) | **A** | — | — | D | — | D one label pair ("deep record / light record") | D | D | — | — | D | D | never used as a selection filter (new test) |
| Category / group | **A** | — | — | D | — | D one grouping everywhere (today: 3 groupings) | D | D | — | — | D | D groups → skills | unchanged |
| `builds_on` / `composes` / `specializes` | **A** | — | — (no projection; D-02) | D `pattern-graph.ts` | — | D Pattern Explorer perspectives (today: deep-only DAG vs connected-only explorer) | D card header + inverses, plan closure, explorer on both transports | D | — | — | D pages incl. inverses | D build order | typed acyclicity, contradictions, cardinality |
| Inverses, closures | — | — | — | D (one module; today 3 walkers) | — | D | D | D | — | — | D | D | single implementation (architecture test) |
| Platform baseline | **A** root `assumes` | — | — | D | — | D shown once | D printed once per plan | D | R | — | D | D | baseline ids never edge targets |
| Infrastructure needs | **A** + vocabulary in `schema.ts` | — | — | D transitive | — | D "Requires" | D `target_infra` verdicts | D transitive (today: own, non-transitive) | **checked** node-kind needs ⊆ pattern needs (today: contradict, F05) | — | D | D | import-scan evidence gate |
| Alternatives | **A** (+ optional pattern id) | — | — | D | — | D linked | D linked ids | D | **A** for workload-level alternatives | — | D | D | ids resolve; not also a constituent |
| Evidence | **A** typed refs | — | — | D | — | D evidence perspective; showcases back-link | D "Proof" section | D | shared evidence-kind vocabulary | — | D | D | refs exist; test refs are in a vitest project |
| Maturity | — (derived) | — | — | D | — | D badge on catalog (today: computed, not shown) | D | D | D on PatternRefs in Studio (today: bare ids) | — | D | D | derivation rule |
| Capability | **A** free text (D-07) | — | — | D | — | D shown on pages (today: never shown) | D search fields | D | — | — | D | D | — |
| Registry digest | D computed | R in ingest derivation key | — | D | D `server-info` | — | D responses | — | — | R | — | R | bench results bound to digest |
| Decision | R pattern ids only | — | — | D | — | D Studio | D AE tools | — | **A** | — | D | D selection skill | references resolve (exists) |
| Showcase | R evidence href | — | R `:Resource` (catalog sync) | D | — | **A** catalog; D back-links | R | R | R | — | D | — | hrefs registered (exists) |
| Workflow tutorial | R (pattern `kind: workflow`) | — | — | — | — | **A** `/workflows` catalog with pattern id | — | — | — | D ingested | D | — | tutorial pattern ids resolve (new) |

## E.2 Naming alignment per layer (proposed)

| Concept | Registry field | Type (schema.ts) | UI label | MCP text | DB / persisted |
|---|---|---|---|---|---|
| prerequisite | `builds_on` | `PatternRelation` | "Builds on" / "Built on by" (already used by the explorer) | "Builds on", "Built on by" | — |
| composition | `composes` | `PatternConstituent` | "Composed of" / "Part of"; "optional — when …" | same | — |
| specialization | `specializes` | `string \| undefined` | "Specializes" / "Specialized by" | same | — |
| infrastructure | `requires` | `InfrastructureNeed` | "Requires" | "Requires: … (via …)" | — |
| proof | `evidence` | `PatternEvidence` | "Evidence" | "Evidence" | — |
| reference | — | `PatternRef` | — | — | `pattern:<id>` in every persisted reference |

## E.3 What stays deliberately absent

- **No registry tables in PostgreSQL.** The registry is a build artifact; persisted data holds `PatternRef` strings without FKs (as `mcp.call_log` already argues).
- **No pattern graph in Neo4j.** ≈200 nodes traverse in microseconds in memory; the stdio server runs with no network; nothing would read it (D-02).
- **No pattern data in the embedding store beyond the generated pages.** Agents and Vely get relationships deterministically from the query layer; the vector corpus serves prose questions.
