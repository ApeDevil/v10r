# G. Decision register

ApeDevil accepted the review on 2026-11-28 and ruled on every decision. This register records each ruling and
the decision as it now stands. Where a ruling adjusted the recommendation, the adjusted text is binding; the
original recommendation is kept in the third column so the change stays visible. **E** marks decisions settled
by evidence, **P** decisions of product philosophy or preference.

## Rulings

| ID | Decision as it now stands | Original recommendation | Ruling | Basis | Lands in |
|---|---|---|---|---|---|
| D-01 | Direction B: a typed semantic graph inside the canonical registry. The eight golden scenarios are the initial composition benchmark; **independent holdout scenarios** check that the optimization generalizes beyond the scenarios used to design it. | B; golden sets as in verification.md | approved; holdout added | E | Slice 1 (benchmark), all |
| D-02 | The registry stays the only authority for pattern knowledge. No PostgreSQL or Neo4j projection without a concrete consumer and a demonstrated architectural benefit. | no projection | approved as recommended | E | — |
| D-03 | Three entity kinds: `pattern`, `principle`, `workflow`, each with explicit **adoption semantics** ([target-ontology.md §C.2](./target-ontology.md#entity-kinds-and-their-adoption-semantics)). Established in Slice 2, **before** any consumer (the planner, Slice 4). No richer classification without demonstrated value. | three values, introduced in Slice 6 | approved; moved earlier, adoption semantics required | P + E | Slice 2 |
| D-04 | Retire records that are not reusable engineering knowledge; merge duplicates; reconcile overlaps. Every ref, doc, code pointer and piece of evidence moves to the canonical concept, and a gate proves nothing was dropped. Record count is not a success metric. | retire 28, merge duplicates (≈199 → ≈165) | approved | P | Slice 2 |
| D-05 | Platform assumptions are explicit and **scoped**: each has a declared applicability, and the planner never adds one to a plan whose patterns do not fall in its scope. Four things are kept apart: platform-wide conventions, domain-specific assumptions, actual pattern prerequisites and implementation-specific architectural choices ([§C.3.4](./target-ontology.md#c34-platform-assumptions)). | root `assumes: [multi-client-core]` | approved with adjustment: no unconditional baseline | E | Slice 3 |
| D-06 | Capability-level infrastructure needs with explicit technology bindings and justified pins. Each need is **required**, **conditional** (`when`), **optional** (`why`) or **implementation** (used only by v10r's reference implementation, `why`). A technology never becomes mandatory merely because v10r's reference implementation uses it. | needs with bindings, optional pins, `when` | approved; four levels made explicit | E | **Slice 1** |
| D-07 | Defer a controlled capability vocabulary until the improved selection and composition have been benchmarked. Exact selection by canonical id is required (`ids` on the plan tool). | defer, add `ids` | approved as recommended | E | Slice 4 (ids), decided on Slice 4 numbers |
| D-08 | Evidence-derived maturity including `demonstrated`. A test file's existence never makes a pattern `proven`. The model separates evidence **reference**, **verification result**, **scope** (which invariants a check exercises), **provenance** (who or what produced the result), **freshness** and **applicability** to the current implementation (content identity). Unreliable historical commit attestations are removed; meaningful traceability is kept. | derived maturity, drop `verifiedSha` | approved with adjustment | P + E | Slice 5 |
| D-09 | Titles are canonical, self-expressive concept names. Volatile statistics, version references and facts outside a concept's identity leave the title; volatile facts are derived where practical. | canonical titles, numerals gated | approved | P + E | **Slice 1** |
| D-10 | Every identifier is reviewed; those that are semantically wrong, misleading, coupled to taxonomy or inconsistent with the ontology are corrected. **An identifier names the concept, not its organizational location.** All consumers change directly; no aliases or redirects. A rename and retirement manifest is delivered for review. | no mass rename | approved with adjustment: comprehensive review, justified renames | P | Slice 2 |
| D-11 | The taxonomy stays a navigation and documentation structure. Categories and groups never define composition, dependency or semantic type; obsolete categories are removed during reconciliation. | keep, fold `toolkits` | approved | P | Slice 2 |
| D-12 | The project's architectural and naming claims match their actual enforcement. Gates are strengthened where useful; a principle that cannot be enforced automatically is labelled an architectural practice requiring judgement. No claim of enforcement without a gate. | correct docs, generate retired list | approved | P | Slice 7 (claims named in Slice 1 are corrected in Slice 1) |
| D-13 | Platform-wide semantic integrity is **mandatory** scope (Slice 8): persistence vocabularies, ownership semantics, lifecycle terminology, corpus identities, Neo4j relationships and related inconsistencies across database, server, frontend, MCP, AI and docs. Genuinely different concepts keep different terms. | optional separate slice | modified: mandatory | P | Slice 8 |
| D-14 | Remove incorrect Desk-specific dependencies now. The approval-gate rename and other Desk structural changes are coordinated with the Desk refactor; the pending refactor never justifies keeping a relationship already known to be wrong. | drop edge now, rename later | approved | P | **Slice 1** (edge), Desk refactor (rename) |

## Answers to the open questions

| # | Question | Answer (ApeDevil, 2026-11-28) | Consequence |
|---|---|---|---|
| 1 | Fewer, truer patterns, or record count as breadth? | Fewer, more accurate patterns. Record count is not a measure of product quality. | D-04 proceeds; no surface advertises the count as a quality claim. |
| 2 | Optional constituents for humans but not agents? | Optional constituents are visible but never automatically required. Humans and agents receive the same underlying semantics. | One projection feeds docs pages and tools; optional is a property of the edge, not of the reader. |
| 3 | Is `demonstrated` the right word? | Yes, if its definition and verification criteria are precise. | §C.5 defines it by evidence kind and verification result. |
| 4 | May light records name alternatives and contraindications? | Yes. Documentation depth never decides the completeness of structural and semantic facts. | Needs (Slice 1), relationships (Slice 3), alternatives and contraindications are tier-independent. |
| 5 | Skills by registry group or by composite? | Keep the current grouping. Investigate composition-oriented skills once composition is operational and measurable. | Revisit after Slice 4's numbers. |

## Additional rulings in the approval (relationship semantics)

- Each relationship has explicit direction, inverse, transitivity, cardinality, conditionality, cycle rules
  and planning consequence before it is implemented ([§C.3](./target-ontology.md#c3-relationships)).
- Specialization never requires a second implementation of the generalized pattern.
- Optional composition never becomes mandatory through transitive traversal.
- Shared constituents are deduplicated.
- Conditions distinguish satisfied, unsatisfied and unknown.
- Conflicting or unavailable prerequisites are reported, never silently dropped.
- Inherited invariants must apply to the selected implementation.
- Every plan step carries a traceable reason.
- Meaningful references that are not dependencies are preserved; removing a wrong edge never erases knowledge.
- Where an alternative is a registered pattern, it is linked by canonical id.
- The relationship vocabulary does not grow without a concrete use case.

## New proposals raised while reconciling (await ApeDevil at the named checkpoint)

| ID | Proposal | Why | Checkpoint |
|---|---|---|---|
| D-15 | A planning-neutral `references: [{id, why}]` list for non-dependency links (never traversed, never propagates needs). | The approval requires preserving meaningful non-dependency knowledge; 12 of today's 88 edges are exactly that (e.g. `architecture-engineering → architecture-wasm-kernel`). Without a typed home they would have to move into prose, where no gate checks the id. This is the concrete use case the approval asks for before the vocabulary grows. | Slice 3 |
| D-16 | Composition benchmark holdout scenarios are fixed before the Slice 1 changes and never edited to fit a result; changing one needs a recorded reason in the fixture. | Keeps the generalization check honest when the same reviewer authors scenarios and changes. | Slice 1 (applied), review at its checkpoint |
