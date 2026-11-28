# Future development and enforcement

The goal: correct work is what the gate accepts, so nobody has to remember a long instruction list.

## Gates (proposed; ✓ = exists today)

| Gate | What it checks | Deterministic? | Slice |
|---|---|---|---|
| ✓ Structural schema | shape, kebab ids, enums, per-tier depth | yes | — |
| ✓ Referential integrity | refs exist, anchors render, showcase hrefs registered, decision/node-kind/lab ids resolve | yes | — |
| ✓ Derived freshness | pages, skills, excerpts, stdio bundle, App views (`*:check`) | yes | — |
| Relationship validity | typed targets exist, no self, one type per pair, `specializes` ≤ 1, optional ⇒ `when`, principle never a step target, baseline never a target | yes | 2 |
| Union acyclicity | `builds_on ∪ composes ∪ specializes` | yes | 2 |
| Contradictions | alternative id ≠ constituent/prerequisite of the same record | yes | 2 |
| Needs evidence (import scan) | code refs importing infra adapters ⇒ declared or inherited need; allow-list with reason | yes | 1 |
| AE consistency | node-kind needs ⊆ transitive needs of its patterns | yes | 1 |
| Anatomy per kind/tier | §C.6 table | yes | 2/6 |
| Evidence | test refs inside a vitest project; maturity derived, never authored | yes | 4 |
| Volatile facts | no numerals in titles (allow-list); counts in prose bound or removed | yes | 1/7 |
| Single graph implementation | architecture test: closure/inverse code only in `pattern-graph.ts` | yes | 2 |
| Cross-surface consistency | catalog, explorer, `/showcases/mcp`, skills report the same counts | yes | 6 |
| Cross-transport parity | 9 tools on stdio and hosted, same text | yes | 3 |
| Bench freshness | bench results carry the current registry digest | yes | 1 |
| Retired terms | list generated from `docs/naming.md` Retired column | yes | 7 |
| Duplicate detection | records sharing code dirs **and** showcases → advisory report | advisory | 7 |
| Edge type, kind, merge choices, golden sets | — | **human judgement** (review checkpoint) | — |

## Procedures (to become the authoring section of `pattern-library/README.md`)

| Task | Steps the gate enforces |
|---|---|
| Introduce a pattern | id names the concept; pick `kind` and category; declare needs (import scan will check) and relationships; ≥1 doc; deep ⇒ invariants, notes, avoid_when, alternatives; `patterns:build` |
| Extend a pattern | if it adds a constituent → `composes`; if it is a narrower case → new record that `specializes`; if it only adds docs/code → refs |
| Compose existing patterns | new composite record with `composes` entries (optional + `when` where it applies); constituents are never copied |
| Add a technology | a binding row in the infrastructure vocabulary, or a `pinned` need with `why`; never a new pattern for a product |
| Update evidence | add typed `evidence`; maturity follows; live checks carry `checkedAt` |
| Correct terminology | change `docs/naming.md` first (Retired column), then the gate fails on old uses |
| Retire or merge a pattern | move every ref to the target (gate checks), delete the record; no redirects |
| Refactor the ontology itself | change `schema.ts` + `format`, migrate `registry.json` in the same commit, all readers through `pattern-graph.ts` |
