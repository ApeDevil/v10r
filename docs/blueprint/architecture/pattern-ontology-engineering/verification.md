# Verification and measurable outcomes

How we will know the ontology improved engineering decisions, not just metadata.

## 1. Baseline measured in this review (registry 2.2.0 at `5720c96`)

Eight emulation scenarios run through the real `recommend_emulation_plan` handler (in process, `detail: "outline"`,
no `target_infra`). The **golden** sets are the reviewer's judgement from each pattern's docs and code and must be
ratified (D-01). `multi-client-core` is treated as baseline and counted neither way.

| # | Capabilities asked | Golden required steps | Returned steps (non-baseline) | Correct | Unnecessary | Golden needs | Needs found | Spurious needs |
|---|---|---|---:|---:|---:|---|---|---|
| S1 | `mcp authorization` | mcp-authorization, hosted-mcp, passwordless-auth, rate-limiting | 10 | 4 | 6 | relational-db, key-value-store, email-delivery | 1/3 | ai-provider |
| S2 | `rate limiting` | anti-abuse-rate-limiting | 5 | **0** | 5 | key-value-store | 0/1 | ai-provider, postgres |
| S3 | `hosted mcp` | hosted-mcp, rate-limiting | 5 | 2 | 3 | relational-db, key-value-store | 0/2 ("no infrastructure") | — |
| S4 | `agentic parametric modeling` | 8 (see §C.7); 2 optional | 10 | 8 | 0 (+2 optional made mandatory) | relational-db, key-value-store, email-delivery (+ web-worker cond.) | 1/3 | — |
| S5 | `architecture engineering` | architecture-engineering | 7 | 1 | 6 | — | — | container-host |
| S6 | `grounded answers`, `graph rag` | layered-rag, ai-graph-rag | 3 | 1 | 2 (graph rag → AI surfaces) | relational-db, vector-search, llm-provider, graph-db | 3/4 | — |
| S7 | `encryption key rotation` | encryption-key-ring, jobs-scheduler | 2 | 2 | 0 | relational-db, scheduler | 2/2 | — |
| S8 | `resilient multi-source lookup` | name-check, resilience-policy, deadline-propagation, hierarchical-cache | 4 | 4 | 0 | relational-db, key-value-store, external-api | 3/3 | — |
| | **Total** | **24** | **46** | **22** | **22** | **18** | **10 (56%)** | **4** |

Step precision **48%**, step recall **92%**, required-need recall **56%**, optional constituents marked as
optional **0 of 2**, scenarios where the right existing pattern was unreachable because it is light **2 of 8**
(S2, S6). Retrieval relevance (`mcp:bench`, Acc@1) for comparison: dev 100, holdout 80, holdout2 79.4 — search
is good; composition is where the decisions go wrong.

Reproduce: `bun -e` over `REGISTRY_QUERIES.recommend_emulation_plan` (script in the review notes); Slice 5 turns
this table into committed bench fixtures.

## 2. Targets after Slices 1–3

| Metric | Baseline | Target |
|---|---:|---:|
| Step precision (golden scenarios) | 48% | ≥ 90% |
| Step recall | 92% | 100% |
| Required-need recall | 56% | 100% |
| Spurious needs | 4 | 0 |
| Optional constituents reported as optional | 0/2 | all |
| Right pattern unreachable because light | 2/8 | 0 |
| Plan calls with `ids` (no lexical selection) | n/a | 1 call, deterministic |
| Records whose code imports infra they do not declare | ≥ 54 | 0 |
| AE node-kind ↔ record need contradictions | 11 | 0 |
| Surfaces disagreeing on edge counts (`/showcases/mcp` vs explorer) | 2 | 0 |
| Retrieval Acc@1 dev / holdout / holdout2 | 100 / 80 / 79.4 | no regression |
| `tools/list` tokens; plan tokens | measured by bench | ≤ +10% (more facts, fewer steps) |

## 3. Scenarios to add (Slice 5)

Beyond S1–S8: nested composition with shared constituents (MCP 3D shares rate limiting twice), alternative
technologies (`target_infra: ["relational-db"]` without a key-value store → the plan must flag rate limiting and
offer its alternatives), optional capabilities (`include_optional`), cross-category assembly (agentic
architecture with two optional doors), a principle in a plan (component system conformance), and a workflow
(PIM sheet transform). Each scenario fixes the expected required set, optional set, needs union and the "why
included" chain for one step.

## 4. What stays human judgement

Whether an edge is `builds_on` or `composes`; whether a record is a pattern or an implementation; golden sets;
`avoid_when` applicability to a target (deliberately left to the agent, printed before the how). Everything in
§C.3 invariants and §2 metrics is deterministic.
