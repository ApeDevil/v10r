# MCP progressive retrieval 2026-10 — ledger

Working record for the Pattern MCP retrieval/token-economy initiative. **Read this first after
any compaction**, then `git log --oneline main..HEAD` and `git status --short`, then resume from
"Next exact action". Branch: `claude/brave-bohr-9jw2fq` (cloud session; the harness designates
it — it plays the role of the proposed `feat/mcp-progressive-retrieval`), based on `main` @ `95cd493`.

## Next exact action

None — phases 0–6 done and gated green; the branch awaits Stas's review. Open items: section G.

## Rules of engagement

- Cloud session: no container — run `bun run …` directly. The gate is `bun run validate`; in
  this session it needs two workarounds, both environmental (record, don't hide):
  - `NODE_OPTIONS=--max-old-space-size=10240` (the local container sets 12 GB in `compose.yaml`;
    the cloud default 2 GB heap OOMs svelte-check).
  - `cdn.jsdelivr.net` is blocked by the environment's network policy (403), so `paraglide-js
    compile` silently emits an EMPTY message module and svelte-check reports ~3,800 errors.
    Workaround: the two inlang plugins fetched from the npm registry, compiled from a scratch
    project copy. The `check` script recompiles from the CDN, so the gate is run as a script
    mirroring `validate` step by step with the local compile.
- Bench: `bun run mcp:bench --compare pattern-library/bench/baseline.json`. Never edit
  `holdout-queries.json`; never tune the ranking or the registry's keywords against its misses.

## A. Current-state assessment (audit of `main` @ 95cd493)

Data flow: agent query → `tools/call` → stdio `mcp/server.ts` (NDJSON) **or** hosted
`/api/mcp/{public,private}` (`respondToMcpPost` → `transport.ts` allowlist dispatch) → tool
handler (`mcp/tools.ts` **or** `src/lib/server/mcp/patterns/tools.ts`) → `scorePatterns`
(`mcp/tools.ts:237` **or** `src/lib/server/mcp/patterns/search.ts:46`) over all 175 records →
markdown text result (never `structuredContent`) → hosted observer (telemetry, `diag` stripped).

Strengths

- Registry is the single source of truth; validation (`patterns:validate`), generated
  surfaces and the excerpt snapshot are gate-checked. Deterministic, no network, no embeddings.
- Strong security posture: read-only, bounded args on hosted, realpath containment + secret
  denylist (stdio), registry-derived allowlist over a build-time snapshot (hosted), separate
  admin registry, rate limit before auth, error hygiene.
- Client-compatibility constraints are documented and smoke-tested (text-only results, no
  `outputSchema`/`annotations`, stdout discipline, self-termination).
- Recovery: every error carries `## Next actions`; hosted `diag` feeds the capability-gap meter.

Deficiencies (measured in `pattern-library/bench/baseline.json`)

1. **Duplicated algorithm, parity by text-matching.** `mcp/tools.ts` and
   `src/lib/server/mcp/patterns/tools.ts` are two copies of the four registry handlers, the
   card renderer, the tokenizer and the scorer; `topoSort` exists in `pattern-library/schema.ts`
   AND `src/lib/server/mcp/patterns/search.ts`; excerpt slicing is copied in `mcp/security.ts`
   and `patterns/excerpts.ts`. `parity.test.ts` guards a few source substrings only, and the
   copies already differ (stdio has no argument bounds; stdio negotiates an unknown protocol
   version to 2025-11-25, hosted to 2025-06-18). The stated reason ("the container has no
   `$lib`") does not force the duplication: `pattern-library/fitness.ts` is already one
   framework-free module both runtimes import.
2. **Ranking does not generalize.** No IDF (a word in 60 records weighs as much as one in 2),
   per-field sums reward one term repeated across fields over coverage of distinct terms,
   `when_to_use` (the problem-language field) is not indexed, prefix matching fires for
   2-letter tokens, no plural handling. Dev set 96.8% Acc@1 (queries in registry vocabulary)
   vs **blind holdout 52% Acc@1 / 44% Recall@3 / MRR 0.589**.
3. **No notion of "no match".** 0/5 holdout and 2/4 dev missing-capability queries abstain;
   unrelated queries return up to 70 hits with no strength signal.
4. **The "list everything" recovery hint is false.** `LIST_EVERYTHING` = `{query:"pattern"}`
   (both runtimes) returns 14 of 175 records. No facet/browse mode exists.
5. **No graduated detail.** Applicability needs a full `get_pattern` (≈841 tok mean on deep
   cards), and `requires` is not transitive: `singleflight` requires nothing, but its
   dependency `hierarchical-cache` requires Redis — only a second card reveals it (w1: 3 calls,
   ≈2,300 tok).
6. **Refs the cards print are not readable verbatim.** 33 refs carry `#fragment`s
   (`docs/blueprint/velocity/data.md#singleflight--stampede-protection`); `get_file_excerpt`
   rejects them on both runtimes, and the section can only be found by paging 100 lines blind.
7. **Plan over-expansion.** The second hit per capability is admitted at ≥ ½ the top score:
   p01 adds `ai-tool-harness`, `ai-surfaces`, `retrieval-endpoints`; p05 adds three unrequested
   steps. Plans run 1.3k–4.3k tok.
8. **Runtime.** Every query re-tokenizes every field of every record: search p50 6.4 ms /
   p95 9.5 ms in-process, the plan tool pays it once per capability.

## B. Research summary (external, 2026-10-22)

- Claude Code forwards only `structuredContent` (not text blocks) on success when both are
  present (documented; maintainer-confirmed Aug 2026) → keep text-only results.
- MCP 2026-07-28 is current (stateless; `initialize` removed; `server/discover`; `ttlMs` on
  lists). Claude Code still connects to 2025-11-25 servers → migration deferred as a separate,
  SDK-v2 change with interop tests.
- Tool annotations (`readOnlyHint`) are recommended by the spec/Agent SDK, but this repo
  recorded a live Claude Code bug dropping the whole tool list → not re-added without an
  interop test against a real client (none available in this session).
- Claude Code: tool search on by default (names + instructions upfront; descriptions cut at
  4,096 chars upfront); warning > 10k tokens, cap 25k.
- Anthropic tool guidance: a concise/detailed response-format enum, consolidated tools, errors
  that name the fix, truncation that says how to narrow.
- Retrieval at ~175 short records: IDF + best-field-per-term + term-coverage beats BM25F tuning;
  embeddings/RRF not worth a model in the stdio container or the Vercel cold start.

## C. What was built (one commit per phase, each gated green)

| Phase | Commit | Change |
|---|---|---|
| 0 | `eefabd2` | `bun run mcp:bench` + dev/holdout query sets, scripted workflows, `baseline.json` |
| 1 | `0ba279b` | One registry query layer (`pattern-library/{search,query,excerpt}.ts`) for both transports; executable parity test |
| 2 | `b0dd085` | IDF × best-field × coverage ranking; strong/partial/weak grade; weak-only = `empty` no-match; cached index |
| 3 | `409c801` | `search_patterns` `detail` / `tier` / `maturity` / browse `"*"`; `get_pattern` `ids` / `sections` with named omissions |
| 4 | `901a562` | `get_file_excerpt` `section`, `#fragment` paths, outline footer; every cited fragment gated |
| 5 | `2002157` | Transitive `requires`; plan `target_infra` + `detail: outline`; strong-only runner-up admission; `fitness.ts` folded in |
| 6 | `ecb2750` | Shared `QUERY_WORKFLOW` instructions; plan output budget; weak-match framing; holdout2; docs; showcase cards |

Correction: `b0dd085`'s message cites the `["background jobs","layered RAG"]` plan at 3 steps.
That was measured before the same commit stopped indexing ids; at `b0dd085` it is 5 steps.
`2002157` re-indexes ids minus their category prefix and the plan is 3 steps again.

## D. Measurements

`bun run mcp:bench --compare pattern-library/bench/baseline.json`; final state in
`pattern-library/bench/results.json`. ≈tok = chars/4 (no offline Claude tokenizer — ratios are
meaningful, absolutes approximate). Latency is in-process on this cloud container. Workflows are
scripted oracle tasks (cost of the interface, not of model choices). None of this is production
telemetry.

Relevance (Acc@1 / Recall@3 / MRR@10; "weak" = top hit graded weak or nothing returned):

| Set | main @ 95cd493 | branch |
|---|---|---|
| dev (66, tuned against) | 96.8% / 96.8% / 0.980 | 100% / 99.2% / 1.000 |
| holdout (30, blind, written before the work) | 52.0% / 44.0% / 0.589 | 76.0% / 88.0% / 0.847 |
| holdout2 (40, blind, written after, scored once) | 52.9% / 61.3% / 0.625 | 79.4% / 83.3% / 0.847 |
| uncovered requests graded weak (dev / h1 / h2) | 2/4 · 0/5 · 0/6 | 4/4 · 5/5 · 5/6 |
| answerable requests graded weak (dev / h1 / h2) | — (no grade) | 1/62 · 5/25 · 10/34 |

The holdout2 main-engine numbers come from `main`'s `scorePatterns` (`git archive 95cd493 mcp
pattern-library`) over the same file with the same metric code; the bench at `eefabd2` predates
holdout2. The holdout misses were visible in the baseline report; the ranking changes are generic
(IDF, best field, coverage, stemming) and no registry keyword was edited.

Responses and runtime:

| Metric | main | branch |
|---|---|---|
| tools/list | ≈1,036 tok | ≈1,486 tok (+43%) |
| initialize instructions (stdio / hosted) | 876 / 431 chars | 1,188 / 805 chars |
| search_patterns default, mean | ≈469 tok | ≈529 tok (+13%: rows carry requires / depends on / avoid when) |
| get_pattern deep card, mean | ≈841 tok | ≈844 tok |
| trace_capability, mean | ≈860 tok | ≈794 tok |
| recommend_emulation_plan, mean (5 dev plans) | ≈2,726 tok | ≈2,181 tok |
| dev plans with exactly their required steps | 3/5 | 5/5 |
| worst-case plan (20 capabilities) | ≈12.8k tok (over the 10k warning) | outlined, ≈2.6k tok, says so |
| search p95 / plan p95 (in-process) | 8.3 ms / 9.8 ms | ≈0.6 ms / ≈1.5 ms |

Scripted workflows (calls, ≈tok incl. a 30-tok per-call overhead):

| Task | baseline interface on main | new interface |
|---|---|---|
| w1 fit check vs a Redis-less target | 3 · 2,297 | 1 · 275 |
| w2 pick between two candidates | 3 · 1,463 | 2 · 685 |
| w3 read `retrieve()` | 2 · 2,173 | 1 · 1,332 |
| w4 read the doc section a card cites | 2 · 2,609 | 1 · 617 |
| w5 invariants of three known patterns | 3 · 2,869 | 1 · 952 |
| w6 browse one category | 2 · 802 | 1 · 445 |
| w7 plan two capabilities, Postgres-only target | 1 · 3,240 | 1 · 1,904 (outline + 2 cards: 2 · 1,164) |
| w8 find + ground + read the jobs runner | 3 · 1,899 | 3 · 1,508 |

The same old-style calls on the branch cost 1–14% more in five of eight tasks (w6 +25%: its
`{query:"pattern"}` now matches more rows), because default rows and cards carry more fitness
facts; that is the price of the rule-out information, paid only by callers that ignore the new
parameters.

## E. Gate log

- main @ 95cd493 + bench files: GREEN (svelte-check 0 errors / 11,284 files; 284 test files).
- Every phase commit 0ba279b … ecb2750: GREEN (svelte-check 0 errors; 284–285 test files;
  stdio `test:mcp` 22 pass; `smoke.ts` OK with `V10R_ROOT` pointing at the repo). Gate run as a
  script mirroring `validate` step by step, with the two cloud workarounds above.
- `bun run knip`: fails on main and branch alike on two pre-existing unused files
  (`src/lib/components/primitives/pane/types.ts`, `…/viz/diagram/erd/types.ts`) — not touched here.
- Not run (needs the local container / database): `bun run refresh`'s `db:ingest-docs`, so the
  RAG index does not yet carry the edited docs; a live Claude Code session against either transport.

## F. Trade-offs

- `tools/list` +≈450 tok and default search rows +≈60 tok buy the progressive parameters and
  the rule-out facts. Claude Code's tool search loads schemas on demand, so the list cost is
  paid only when the tools are opened. `target_infra` on `search_patterns` was built, measured
  and removed: transitive `requires` on each row already answers it, for ≈75 tok less schema.
- The strength grade separates uncovered requests (5/6, 5/5, 4/4 graded weak) at the cost of
  grading some paraphrased answerable requests weak (10/34, 5/25). Those still list the closest
  candidates (the right one is among them in 8/10, 4/5) under "read the closest before
  concluding it is absent", and still count as `empty` in the capability-gap report, where
  they point at missing keywords. The coverage distributions overlap; no threshold separates
  them cleanly.
- Stemming is crude and occasionally wrong ("stripe" folds to "strip"); it only ever produces
  weak overlaps there.

## G. Remaining limitations and recommended next steps

1. Interop: a live Claude Code (and one other client) session against the stdio and hosted
   transports to confirm the new parameters are used as intended — the automated gate exercises
   the real SDK client over HTTP (`sdk-interop.test.ts`) but no model.
2. MCP 2026-07-28 (stateless, `server/discover`, list `ttlMs`) as its own change, via SDK v2,
   with interoperability tests — and the stdio/hosted default-version mismatch with it (stdio
   answers an unknown version with 2025-11-25, hosted with 2025-06-18).
3. `readOnlyHint` annotations once (1) can show the old tool-drop bug is gone.
4. Curation from telemetry: weak-graded `empty` rows in `/admin/mcp/usage` name the words agents
   use that the registry lacks; adding them as keywords is the cheapest relevance gain left.
5. `podman exec v10r bun run refresh` locally so the RAG index carries the edited docs.
