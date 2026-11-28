# B. Findings register

Status: **C** = confirmed (reproduced or read in code at `5720c96`), **S** = suspected (evidence is partial),
**O** = optional improvement (no defect). Severity is about the consequence for engineering decisions made from
the platform: **high** = an agent or human is led to a wrong or incomplete architecture; **medium** = a
surface misinforms or two surfaces disagree; **low** = drift or friction. The recommended resolutions refer to
the roadmap slices in [roadmap.md](./roadmap.md).

## Overview

| ID | Title | Layers | Sev | Status |
|---|---|---|---|---|
| F01 | `depends_on` conflates five relationships | registry, MCP, UI | high | C |
| F02 | Light records carry no infrastructure needs | registry, MCP | high | C |
| F03 | Tier decides plan eligibility: the right pattern is unreachable | MCP | high | C |
| F04 | Plans make optional constituents mandatory and drag in adjacent patterns | MCP | high | C |
| F05 | Two contradicting sources of infrastructure truth (registry vs AE node kinds) | registry, AE | high | C |
| F06 | `requires` mixes technologies and capabilities | registry, MCP, AE | medium | C |
| F07 | "proven" does not mean what it says | registry, docs, UI | high | C |
| F08 | Records that are not patterns | registry, UI, MCP | medium | C |
| F09 | Duplicated and overlapping records | registry | medium | C |
| F10 | Capabilities are free text, effectively keywords | registry, MCP | medium | C |
| F11 | Platform baseline is implicit and inconsistently declared | registry, MCP | medium | C |
| F12 | No inverse relations on most surfaces; stdio has no graph tool | MCP, UI | medium | C |
| F13 | Two "dependency graphs" with different populations | UI, MCP | medium | C |
| F14 | Explorer excludes 124 records and misdirects recovery | MCP App, UI | medium | C |
| F15 | Three dependency walkers, two requirement-closure implementations | query layer | low | C |
| F16 | Vely's pattern tool reinterprets the model | AI | medium | C |
| F17 | Volatile facts in canonical fields (titles, summaries) | registry, docs | medium | C |
| F18 | Registry version not bound to content; bench baselines stale | registry, bench | low | C |
| F19 | Ids encode the category, and the documented convention is false | registry, docs | low | C |
| F20 | Taxonomy mixes two classification axes | registry, UI | low | S |
| F21 | Architecture Engineering duplicates fitness/evidence vocabulary | AE, registry, UI | medium | C |
| F22 | Showcases, workflows and Studio do not link back to patterns | UI | medium | C |
| F23 | Pattern identity has three spellings in persisted data | DB, AI | low | C |
| F24 | Naming: the central noun and several pattern terms have no canonical row; homonyms | docs, code, UI | medium | C |
| F25 | Gates enforce less than the docs say they do | gates, docs | medium | C |
| F26 | Tool counts and tool lists drift across docs, copy and the compat kit | docs, UI, MCP | low | C |
| F27 | The benchmark measures retrieval, not composition or requirement correctness | bench | high | C |
| F28 | Persistence vocabularies (outcome, owner, retired) have no shared ontology | DB | low | C |
| F29 | Neo4j holds two disconnected "showcase" identities; RELATED_TO collapses types | Neo4j | low | C |
| F30 | Desk-specific edges and names in AI patterns | registry | low | C |

## Details

### F01 — `depends_on` conflates five relationships (high, C)
- **Refs:** `pattern-library/schema.ts` (`depends_on: string[]`), `query.ts:859-872`, [edge-classification.md](./edge-classification.md).
- **Description:** Classifying all 88 edges: **29** are prerequisites (A cannot work without B), **26** required constituents (B is part of A's solution), **8** optional constituents, **4** specializations, **9** platform-baseline conformance (`→ multi-client-core`, `→ ui-component-system`, `→ ui-primitives`) and **12** are not dependencies at all (rationale links such as `ai-agent-to-agent → architecture-engineering`, verification such as `scenario-harness → resilience-policy`, complements such as `deadline-propagation → resilience-policy`, delivery channels such as `architecture-engineering → architecture-pattern-mcp`).
- **Root cause:** one untyped edge was the only relationship the schema offered, so authors used it for every relation they wanted visible.
- **Consequences:** only 33% of edges mean what the plan builder assumes. 21 edges add steps that should never be steps; 8 optional constituents become mandatory; composition is invisible (no "part of").
- **Resolution:** typed relationships `builds_on`, `composes` (with `optional` + `when`), `specializes`; baseline declared once; non-dependencies removed (Slice 2).
- **Confidence:** high for the conflation; individual edge types are reviewer judgement (listed per edge for review).

### F02 — Light records carry no infrastructure needs (high, C)
- **Refs:** registry (136/136 light with `requires: []`); `anti-abuse-rate-limiting` ("backed by Upstash Redis … fails closed when Redis is unavailable", `requires: []`); `architecture-hosted-mcp` (`risk: "no external services"`, needs Postgres + Redis); `identity-passwordless-auth` (email + Postgres); `databases-postgres-connection` (`requires: []`).
- **Description:** at least **54** records (50 light, 4 deep) need infrastructure their record does not declare. The schema does not forbid `requires` on light records: the depth contract silently became "light = only pointers", and `requires` was treated as a depth field.
- **Consequence (reproduced):** `recommend_emulation_plan {"capabilities":["hosted mcp"]}` answers *"This plan requires no infrastructure beyond the app runtime"*; with `target_infra:["postgres"]` the MCP 3D plan says "Rate limiting … Fits the target". Transitive closure faithfully propagates the missing facts.
- **Resolution:** structural facts (`requires`, relationships) are mandatory for every tier; tier governs only invariants/emulation notes; an import-scan gate derives evidence for needs from code refs (Slices 1, 2).

### F03 — Tier decides plan eligibility: the right pattern is unreachable (high, C)
- **Refs:** `query.ts:820-846`.
- **Reproduced:** `recommend_emulation_plan {"capabilities":["rate limiting"]}` returns a 6-step plan for the **AI eval regression suite** ("Satisfies: rate limiting"), requiring `ai-provider, postgres`. The real pattern `anti-abuse-rate-limiting` exists but is light, so it may not be a step; the best *deep* lexical hit wins.
- **Root cause:** documentation depth is used as a selection filter.
- **Resolution:** any pattern may be selected; light steps print "index record — no invariants recorded, read the docs" instead of an empty `Invariants:` heading; selection by exact `ids` (Slice 3).

### F04 — Plans over-adopt (high, C)
- **Reproduced:** `["mcp authorization"]` → 11 steps; the runner-up rule also selects `ai-mcp-client`, which drags in the AI tool harness, AI surfaces, the approval gate, durable step execution and the untrusted-content boundary (6 unnecessary steps) and adds `ai-provider` to the requirements. `["architecture engineering"]` → 8 steps and `container-host` for a static decision library. `asset-production-pipeline` and MCP 3D plans include Threlte, Hosted MCP and the MCP App as mandatory although the pipeline is DOM-free and the App is host-optional.
- **Consequence:** the opposite of the selection skill's own advice ("fewer patterns is the better plan"); the tool description promises "no inference" but the selection is lexical inference over free text.
- **Resolution:** typed closure (required vs optional), `ids` argument, "why included" chain per step, golden composition scenarios in the bench (Slices 2, 3, 5).

### F05 — Two contradicting sources of infrastructure truth (high, C)
- **Refs:** `architecture-engineering/vocabulary.ts` `NODE_KINDS[*].requires` vs record `requires`.
- **Description:** 11 node-kind → pattern bindings disagree, e.g. node `relational-db` requires `postgres` but `databases-postgres-connection` requires nothing; node `cache` requires `redis`, `databases-cache` nothing; node `graph-db` requires `neo4j`, `databases-neo4j-connection` nothing; node `external-service` requires `third-party-api`, `resilience-policy` nothing.
- **Resolution:** the record is the authority; a gate asserts node-kind needs ⊆ the transitive needs of the node's patterns (Slice 1).

### F06 — `requires` mixes technologies and capabilities (medium, C)
- **Refs:** `PATTERN_REQUIREMENTS` (`postgres`, `pgvector`, `neo4j`, `redis` are products; `object-storage`, `cron`, `ai-provider`, `web-worker` are capabilities; `third-party-api` covers email, OAuth providers and tile servers alike).
- **Consequence:** an agent cannot tell a mandatory capability from a replaceable technology choice; a target with Valkey or SQS is judged against product names; email delivery is invisible.
- **Resolution:** capability-level needs with one v10r binding table and an optional technology pin with a reason (Slice 1, decision D-06).

### F07 — "proven" does not mean what it says (high, C)
- **Refs:** registry (124/173 proven share `2026-08-20/1a130d67`, a migration stamp; 20 of 23 distinct `verifiedSha` values do not resolve after history rewrites; 97 proven light records have no test, 14 are proven only by an app route that *is* the feature); `README.md:3`, `CLAUDE.md` ("proven patterns") while 26 are not; `implemented` overloaded (code without proof **and** tested but awaiting live-host verification — MCP 3D/authorization).
- **Root cause:** maturity is hand-set and the gate checks presence of refs and a date, not verification.
- **Resolution:** typed evidence entries; maturity **derived** from evidence (proven ⇔ an automated test the gate runs; demonstrated ⇔ showcase/route only; implemented ⇔ code only or a required live check pending); drop `verifiedSha` (Slice 4, decision D-08).

### F08 — Records that are not patterns (medium, C)
- **Examples:** showcases (`architecture-request-cycle-visualizer`, `toolkits-image-kit`, `analytics-live-feed`); documentation views (`architecture-runtime-layers`, `architecture-codebase-map`); component/feature inventory (`ui-tables`, `ui-menus`, `ui-primitives` "~40 Bits UI wrappers", `viz-charts`, `jobs-registered-catalog`, `app-shell-settings`, `identity-user-management`); principles that their own summaries call "a review heuristic, not a rule" (`ui-explosive-discovery`) or "a conceptual audit lens (not a module)" (`ai-harness-lens`); workflows (`pim-sheet-transform-recipe`, `db-ops-*`).
- **Count:** 28 records are implementation/docs/showcase, 4 principles, 4 workflows ([reconciliation.md](./reconciliation.md)).
- **Consequence:** search, plans and counts treat a component list like an architectural pattern; "199 patterns" overstates the knowledge.
- **Resolution:** a small closed `kind` (pattern · principle · workflow); non-patterns become refs of the pattern they implement/document/demonstrate (Slice 6).

### F09 — Duplicated and overlapping records (medium, C)
- `app-shell-style-randomizer` ↔ `admin-privacy-style-picking`: same code dir `src/lib/server/style`, same showcase `/showcases/shell/style`, filed in two groups.
- `databases-cache` ↔ `hierarchical-cache` (shared capability "caching"; one is the Redis binding of the other).
- `ai-chat-assistant` ↔ `ai-surfaces` (shared capability "streaming chat", same orchestrator file); `ai-deskbot` ↔ `ai-surfaces`/`deskbot-approval-gate`.
- `databases-neo4j-connection` / `graph-modeling` / `graph-traversal`: three rows, one doc, one code dir.
- `analytics-my-data-transparency` ↔ `admin-privacy-gdpr` (same `collectUserData` report).
- `layered-rag` ↔ `ai-graph-rag`: the graph tier is a constituent, not a sibling (same `retrieval/tiers` dir; layered-rag cites graph-rag.md).
- `ai-provider-routing` keeps its own circuit breaker next to `resilience-policy`'s.
- **Resolution:** merges/folds listed in [reconciliation.md](./reconciliation.md); an advisory overlap report (shared code dirs + shared showcases) in the gate (Slices 6, 7).

### F10 — Capabilities are free text (medium, C)
- 627 distinct strings for 199 records; 21 shared. `trace_capability` and `recommend_emulation_plan` match them lexically with the same weight as keywords (`search.ts:85-95`). `explore_patterns` even passes a **title** as a capability (`dependency-explorer.ts:216-220`).
- **Consequence:** "which patterns provide X" and "which are alternatives for X" cannot be answered deterministically.
- **Resolution:** first remove the need (selection by `ids`); then measure whether a controlled capability vocabulary improves selection before introducing it (Slice 5, decision D-07).

### F11 — Platform baseline is implicit (medium, C)
- `multi-client-core` has 8 incoming edges, yet nearly every server pattern assumes it; `schema.ts` says "every pattern assumes the v10r stack's runtime" without naming it. Plans add `multi-client-core` as step 1 for some capabilities and not others.
- **Resolution:** one root `assumes` list printed once per plan ("adopt first if your project lacks it") (Slice 2, decision D-05).

### F12 — Inverse relations are missing (medium, C)
- `get_pattern`, generated pages and Vely show only outgoing `depends_on`; only `explore_patterns` (hosted only) shows dependents. stdio serves 8 tools without it; server instructions (`QUERY_WORKFLOW`) never mention it; `parity.test.ts` does not cover it.
- **Resolution:** derived inverses (`built on by`, `part of`, `specialized by`) on cards and pages; move `explore_patterns` into the shared query layer so stdio serves it as text (Slice 3).

### F13 — Two dependency graphs (medium, C)
- `/showcases/mcp` graphs deep → deep only (drops 28 of 88 edges) while its stat card says 88 edges; the explorer uses every connected record. The DAG comment's premise ("~125 edge-less light rows") is outdated: 20 light records take part in edges. `DAG_SHORT_LABELS` hand-maintains a second name for 63 records.
- **Resolution:** one graph projection module feeds every view (Slice 3/6).

### F14 — Explorer excludes the unconnected (medium, C)
- Overview and picker list only the 75 connected records; the not-found recovery says "the overview lists every id in the graph". After Slice 2 many isolated records gain typed edges, but standalone patterns stay legitimate: they must still be navigable.

### F15 — Three dependency walkers (low, C)
- `needsOf` (`query.ts:392`), `walk` + `inheritedNeeds` (`dependency-explorer.ts:132-157`), and the closure in `recommendPlan` (`query.ts:861`). The explorer rebuilds `byId` per call.
- **Resolution:** one `pattern-graph.ts` (closure, inverses, typed traversal) used by all (Slice 2).

### F16 — Vely's pattern tool reinterprets the model (medium, C)
- `search-pattern-library.ts`: weak hits returned as results (no strength), own browse tokens (`all|list|everything`), case-sensitive category, own (non-transitive) `requires`, no relationships; comment "≤11 deep records" (now 63) justifies its context bound. Pattern pages are also embedded into the docs corpus, so the chatbot has two retrievals over the same knowledge.
- **Resolution:** Vely renders rows through the shared query layer (Slice 3).

### F17 — Volatile facts in canonical fields (medium, C)
- Titles: "Middleware / 14-stage hook chain" and "last of 14 middleware stages" (hooks.server.ts `sequence` has 18 handles); "Drizzle, 14 namespaces" (16 `pgSchema`); "four trust surfaces" (the protected `/api/mcp/3d` is another); "~40 Bits UI wrappers"; "7-layer view". Summary of `pattern-index`: "(136 rows, 20 categories, two tiers)" (199/30). `ai-chat-assistant` says AI SDK v6 (v7 shipped).
- **Root cause:** titles carry a summary in parentheses (144/199); counts are typed, not derived.
- **Resolution:** title = canonical name; numerals in titles and summaries gated (allow-list for names like "OAuth 2.1", "A2A", "3D", "N+1") (Slice 1).

### F18 — Version and baselines not bound to content (low, C)
- `version 2.2.0` for 175, 188 and 199 records; `bench/baseline.json` 175, `results.json` 188.
- **Resolution:** `format` integer for the shape + a computed content digest reported by tools and the bench; bench results carry the digest and `patterns:check` flags a stale one (Slice 1).

### F19 — Ids encode the category (low, C)
- 150/199 ids start with their category; `pattern-mcp.md:54` calls the prefix "a namespace", false for 49 records; `ai-agent-skills` sits in `docs-ax`. Reclassification therefore changes identity (URLs, skills, excerpts, bench fixtures).
- **Resolution:** rule "an id names the concept, not its location" for new and touched records; no mass rename (decision D-10).

### F20 — Taxonomy mixes two axes (low, S)
- Five groups are feature domains (foundations, data, identity-safety, intelligence, features); `velocity` and `integrity` are quality attributes cutting across them. It works as navigation, and the docs tree mirrors it. Suspected rather than confirmed as a defect: it misleads only if category is read as "what the pattern is about".
- **Resolution:** declare category explicitly as the documentation home (single-valued navigation), not a semantic type; no new facet unless a consumer needs one (decision D-11).

### F21 — Architecture Engineering duplicates fitness and evidence vocabulary (medium, C)
- `DecisionAlternative.contraindications` is labelled "Avoid when" like `avoid_when`; `prefer_when`/`approach` repeat the pattern `alternatives` shape; `prerequisites` free text next to pattern relationships; `EvidenceKind` next to tests/showcases/maturity; `NODE_KINDS.requires` (F05). Studio shows bare ids (`PatternLinks.svelte`) with no title or maturity; `changes_when` labelled "Revisit when" while `evolution.revisit_when` is never rendered.
- **Resolution:** one evidence-kind vocabulary; pattern-level `alternatives[].pattern` ids; AE keeps workload-level decisions and links patterns (it never copies them); Studio renders pattern links through one `PatternRef` component (Slices 4, 6).

### F22 — No back-links (medium, C)
- 181 registry refs point at showcases; 0 showcase entries link to `/docs/pattern-library/*`; `/workflows` has its own "office" category and no registry ids while registry category `office-workflows` holds the PIM record.
- **Resolution:** derive "patterns demonstrated here" on showcases and "pattern behind this tutorial" on workflows from the registry (Slice 6).

### F23 — Three spellings of a pattern reference in persisted data (low, C)
- `mcp.call_log.subject` = `<id>`; `ai.turn.grounding` = `pattern:<id>`; `retrieval.document.source_uri` = `/docs/pattern-library/<slugify(id)>` (ingest re-slugifies, render promises slug = id).
- **Resolution:** one `PatternRef` format and parser in `src/lib/server/patterns/`; no FK (the registry is a build artifact, correctly) (Slice 6).

### F24 — Naming integrity (medium, C)
- No `docs/naming.md` row for the central noun: "pattern record / registry record / pattern card / deep card / deep record / index row / emulation card / registry entry" all in use.
- `capability` has four subjects (pattern `capabilities[]`, `identity-capability-grants`, `ai/capabilities/` modules, `docs/stack/capabilities/`); naming.md lists three and omits the pattern one.
- `dependency` is canonical for infrastructure in naming.md while the registry uses `depends_on` for pattern edges and `requires` for infrastructure — inverted.
- `showcases[]` holds app routes that are not showcases; `workflow`, `architecture`, `tier`, `lane`, `surface`, `card`, `agent` each carry several referents; Vely has no vocabulary row.
- **Resolution:** add the pattern vocabulary to naming.md and bind the registry field names to it; gate the retired terms (Slice 1, 7).

### F25 — Gates enforce less than documented (medium, C)
- `naming.gate.test.ts` enforces 27 retired terms against ~200 in naming.md, while naming.md says the gate "enforces the retired-term column"; live retired names remain (`DemoCard`, `sourceType`).
- CLAUDE.md and `self-expressive-project.md` name "dates serialized in adapters" and "redirect/error/fail only in adapters" as executable in `architecture.gate.test.ts`; that gate's invariants are framework-free, acyclic, barrel-only and db-is-the-sink (no `Date` check).
- No gate binds counts in prose to the registry (F17, F26).
- **Resolution:** correct the claims now (docs) or extend the gates (Slice 7); decision D-12.

### F26 — Tool counts drift (low, C)
- "six tools" (`naming.md:491`, `agent-experience.md`, `/showcases/mcp` copy), "eight" (README, `pattern-mcp.md`, `mcp/README.md`, compat kit `tools=8`), "nine" (`mcp-apps.md`, correct for hosted). `tool-cards.ts` has 8 cards and no `explore_patterns`.

### F27 — The benchmark does not measure composition (high, C)
- `scripts/mcp/retrieval-bench.ts` measures `scorePatterns` relevance, 5 plan coverage checks (no `target_infra`, no light steps, no extras penalty beyond listing), and oracle workflows. Nothing measures requirement completeness, unnecessary adoption or optional-constituent handling — exactly the failure modes F02–F04 show.
- **Resolution:** golden composition scenarios with precision/recall of steps and needs (Slice 5); baseline in [verification.md](./verification.md).

### F28 — Persistence vocabularies (low, C)
- Outcome words differ per table (`success/failure`, `success/error`, `succeeded/failed/unknown/refused`, `canceled` vs `cancelled`, `ok`); a `kind` column stores an outcome (`ai.agent_proposal_step.kind`) although naming.md cites it as the model `kind`; owner columns spelled six ways; four corpus vocabularies (`document_source`, `RetrievalCorpusId`, `GroundingSourceId`, `DocumentSource`); `source` means both retrieval method and provenance; dead enum values (`chunk_level.sentence`, …); retirement markers (`deleted_at`, `archived_at`, `erased_at`, `redacted_at`). Docs drift: `dbops.run` vs `dbops.operation`, `graph/rag/queries.ts` vs `graph/retrieval/queries.ts`.
- Not pattern-ontology defects, but they belong to the same naming-integrity programme. **Resolution:** a separate, later slice (Slice 8) after ApeDevil decides scope (D-13).

### F29 — Neo4j identities (low, C)
- `:Showcase {name}` (hand seed) and `:Resource {surface:'showcase', id}` (registry-derived) coexist; `RELATED_TO` merges on endpoints only, so a second relationship type between two entities collapses; `:Resource` has no reader in `src/`.
- Neo4j holds **no** pattern data — correctly. **Resolution:** Slice 8; no pattern projection to Neo4j (decision D-02).

### F30 — Desk-specific edges in AI patterns (low, C)
- `ai-agent-actions → desk-workspace`, `deskbot-approval-gate` named for the Desk; the Desk is slated for a refactor. **Resolution:** drop the edge, keep Desk work deferred; rename the approval gate when the Desk refactor lands (decision D-14).
