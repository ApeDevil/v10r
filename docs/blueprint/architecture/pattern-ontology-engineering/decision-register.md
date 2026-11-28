# G. Decision register

Each decision states the recommendation, the alternatives and whether it can be settled by **evidence** (E)
or depends on **product philosophy / preference** (P). Nothing here is decided until ApeDevil answers.

| ID | Decision | Recommendation | Alternatives | Basis |
|---|---|---|---|---|
| D-01 | Adopt direction B (typed graph inside the registry) and ratify the golden scenarios | **Yes**; golden sets as in verification.md, amended where you disagree | A (refine only); C (independent entities + DB projections) | E: reproduced plan failures are type failures, not storage failures |
| D-02 | Project the pattern graph into PostgreSQL or Neo4j | **No.** Revisit only when a feature must join tenant data with the pattern graph | Neo4j projection for the explorer; Postgres tables for analytics | E: no consumer; offline stdio; ≈200 nodes in memory |
| D-03 | Introduce `kind: pattern \| principle \| workflow` | **Yes, three values** | no kind (status quo); a richer abstraction-level facet (architectural / design / implementation …) | P + E: three kinds change plan behaviour; finer levels change nothing a tool does |
| D-04 | Retire non-pattern records (28 implementation/docs/showcase rows) and merge duplicates | **Yes**, refs move to the target pattern; ≈199 → ≈165 | keep them as light rows with a `kind: implementation` | P: "199 patterns" vs a precise library |
| D-05 | Platform baseline as a root `assumes` list | **Yes, `multi-client-core` only** (maybe `ui-component-system`) | keep `builds_on multi-client-core` edges everywhere; nothing | E: today 8 of ~100 server patterns declare it |
| D-06 | Capability-level infrastructure needs with bindings and optional pins | **Yes** | keep product names (`postgres`, `redis`); full Technology entity (direction C) | E: target projects with other products; email invisible today |
| D-07 | Controlled capability vocabulary | **Not now**: first add `ids` to the plan tool, then decide on Slice 5 numbers | controlled now; drop `capabilities` into `keywords` | E: measurable after Slice 3 |
| D-08 | Derived maturity from typed evidence; add `demonstrated`; drop `verifiedSha` | **Yes** | keep hand-set maturity and fix the bulk stamp; keep three rungs and call showcase-only "implemented" | P + E: the schema already rejects self-declared rungs; this rung is machine-checkable |
| D-09 | Titles become canonical names; numerals gated | **Yes** | fix only the stale counts | P: style; E: 5 stale counts found |
| D-10 | Ids: rename all 150 category-prefixed ids | **No mass rename**; new/touched ids name the concept; fix the false "prefix is a namespace" claim | rename all now (no users, but churn in URLs, skills, excerpts, bench fixtures) | P |
| D-11 | Taxonomy: keep 7 groups / 30 categories as single-valued documentation homes | **Yes**, fold `toolkits` (its record becomes a showcase) | add a `qualities` facet for velocity/integrity; make categories multi-valued | P |
| D-12 | Gate scope for naming/architecture claims | **Correct the docs now; generate the retired list from naming.md** (Slice 7) | gate every claim; drop the claims | P |
| D-13 | Platform vocabulary outside the pattern domain (outcomes, owners, corpora, Neo4j) | **Separate later slice** (Slice 8) | include in Slice 1; ignore | P |
| D-14 | Desk-bound names and edges in AI patterns | **Drop the edge now, rename `deskbot-approval-gate` with the Desk refactor** | rename now | P (Desk refactor pending) |

## Open questions for ApeDevil

1. Is "fewer, truer patterns" (D-04) the product direction, or is the record count itself a showcase of breadth?
2. Should a plan include optional constituents by default for a human reader (`/docs`) but not for agents?
3. Is `demonstrated` the right word for "shown working in a showcase, not pinned by an automated test"?
4. May light records name alternatives and contraindications (encouraged), or should those stay deep-only?
5. Should Agent Skills group by registry group (today) or by composite pattern once composition exists?
