# Pattern Ontology Engineering — review package

Review accepted by ApeDevil on 2026-11-28 (reviewed commit `5720c96`); his rulings are in the
[decision register](./decision-register.md) and the target ontology and roadmap are reconciled with them.
**Slices 1 and 2 are implemented and accepted** ([slice-1.md](./slice-1.md), [slice-2.md](./slice-2.md));
**Slice 3 is implemented** ([slice-3.md](./slice-3.md)) and stopped at its review checkpoint; nothing proceeds to
Slice 4, a merge or a deploy without ApeDevil's word. The outcome section below is the review's finding, measured before Slice 1.

## Outcome

The registry is a strong foundation — one authority in git, deterministic, offline, fail-closed gates, fitness
before the how — but its semantics are thinner than its consumers assume. One untyped `depends_on` carries five
meanings (only 29 of 88 edges are prerequisites), all 136 light records declare no infrastructure (≥ 54 need
some), documentation depth decides what a plan may contain, and "proven" is mostly a bulk stamp. Measured on
eight emulation scenarios, plans are 48% precise and find 56% of the infrastructure they need. Recommended:
a typed relationship graph inside the existing registry (direction B), no database or graph-store projection.

## Contents

| File | Deliverable |
|---|---|
| [current-state.md](./current-state.md) | A. Baseline statistics, implicit ontology, cardinalities, component inventory, what to preserve |
| [findings.md](./findings.md) | B. 30 findings with refs, root cause, consequence, severity, resolution, confidence |
| [target-ontology.md](./target-ontology.md) | C. Approach comparison, conceptual model, relationships, needs, evidence, anatomy, worked examples, vocabulary, authority |
| [reconciliation.md](./reconciliation.md) | D. Every one of the 199 records: proposed kind, action, needs, relationships |
| [edge-classification.md](./edge-classification.md) | D. Every one of the 88 current edges with the relationship it actually expresses |
| [alignment-matrix.md](./alignment-matrix.md) | E. Concept × layer authority/derivation matrix and naming alignment |
| [roadmap.md](./roadmap.md) | F. Eight slices with scope, breaking changes, risks, acceptance, checkpoints |
| [decision-register.md](./decision-register.md) | G. 14 decisions (evidence vs preference) and open questions |
| [verification.md](./verification.md) | Measured baseline on eight scenarios and the targets |
| [enforcement.md](./enforcement.md) | Gates (deterministic vs judgement) and authoring procedures |
| [slice-1.md](./slice-1.md) | Slice 1: what changed and why, the needs and titles manifests, benchmark, limits |
| [slice-2.md](./slice-2.md) | Slice 2: Slice 1 review corrections, entity kinds, reconciliation manifest, inventory, benchmark comparison, remaining issues, validation |
| [slice-3.md](./slice-3.md) | Slice 3: Slice 2 refinements, typed relationships and counts, migration manifest, worked composition examples, requirement resolution, graph module, tests, benchmark comparison, remaining issues |
| [release-checklist.md](./release-checklist.md) | Release-blocking checklist: persisted pattern ids, RAG documents and chunks, Neo4j, caches, clients; the reconciliation procedure after the ship |
| [presentation.html](./presentation.html) | H. Interactive review presentation (self-contained) |

## Verification limits

- Cloud session: no database, no Neo4j, no provider keys. Database and Neo4j findings come from schema code and
  scripts, not from live data; `db:ingest-docs` was not run.
- `bun run patterns:validate` and `bun run mcp:bench` were run (unchanged tree). The full `bun run validate` was
  run only to confirm the review files do not break the gate (see the branch hand-off).
- Golden scenario sets and edge types are reviewer judgement, marked as such; every count is computed.
