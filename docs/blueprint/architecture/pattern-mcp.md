# v10r Pattern MCP

A read-only MCP (Model Context Protocol) server that exposes v10r's pattern library to coding agents. It is what makes "emulate, don't clone" (see the root [README](../../../README.md#what-v10r-is)) executable rather than aspirational: an agent building a new project queries curated pattern cards — docs, code, tests, showcase proof, invariants — instead of grepping this repo and guessing which hits are load-bearing.

This doc explains *why* it's shaped the way it is. For running it, testing it, or adding a pattern, see [mcp/README.md](../../../mcp/README.md) — that's the operational reference. The code lives in [mcp/](../../../mcp/).

**See it live:** [/showcases/mcp](/showcases/mcp) — registry stats, the pattern dependency graph, the container architecture, and the JSON-RPC handshake, all computed from the real registry.

---

## Why this exists

Grep finds code. It doesn't find the tests that pin a pattern's behavior, the invariants that must survive being ported to a new project, or proof that the pattern actually works end to end. An agent pointed at a raw repo has to reconstruct all of that by reading broadly and inferring — slow, and easy to get wrong in ways that only surface later (a copied auth guard missing the invariant that made it safe, a copied job missing the retry semantics that made it correct).

The Pattern MCP closes that gap. Each entry in [`pattern-library/registry.json`](../../../pattern-library/registry.json) is a curated card: what the pattern is, when to reach for it, which docs to read, which files to model code on, which tests mirror its behavior, which showcase route proves it live, and — the part grep can never give you — the invariants that must hold when you emulate it. The server is a thin, deterministic query layer over that registry; the registry is the actual product.

## Design

### Registry-as-product

The server is intentionally boring: JSON-RPC plumbing and six tools over two JSON files (the pattern registry and the snippet rules). The tool contract and the four registry tools are written once, in `pattern-library/query.ts` (ranking in `search.ts`, excerpt rendering in `excerpt.ts`), and both transports — stdio `mcp/tools.ts` and hosted `src/lib/server/mcp/patterns/tools.ts` — are thin readers over it that add only what genuinely differs: how a file is read, the snippet engine, and the hosted telemetry `diag`. All the curation work — deciding what counts as a pattern, which invariants matter, which files are the canonical entry point — lives in the registry data, not in code. Adding a pattern means adding a record, not writing a handler.

A drift guard (`pattern-library/validate.ts`, wired into `bun run validate` as `patterns:validate`) keeps the registry honest: every `docs`/`code`/`tests` path must exist on disk, `showcases` refs of `kind: "route"` must be members of `src/lib/showcases/catalog/registry.ts` (not merely directories on disk), `depends_on` must form a DAG (checked via the same Kahn toposort the server uses at query time), IDs must be unique kebab-case, and each tier's contract holds (deep records must carry invariants/emulation notes; light records must not). A registry that references a moved or deleted file fails the gate — unlike a stale doc, it can't silently rot.

The registry is also self-referential: it catalogs v10r's own documentation conventions as patterns (`docs-nav-hubs`, `pattern-index`) alongside code patterns (`multi-client-core`, `layered-rag`, `jobs-scheduler`, …). The root README's Pattern Index is not a twin that could drift — it is **generated from this registry** (see "Derived surfaces" below).

### Two tiers, one record set

Since v2.0.0 the registry is the complete record of the pattern library, not a curated subset: **deep** records are full emulation cards (invariants and emulation notes required — the contract `patterns:validate` enforces), while **light** records are index rows carrying pointers to docs, code, and proof. Search covers both tiers (deep wins exact score ties); `recommend_emulation_plan` builds steps from deep records only and reports light-only matches as "related index entries" so the gap is visible. Promoting a pattern means filling in its depth fields and flipping `tier` — a reviewable edit, not a new file.

### Derived surfaces

Every human- and agent-facing form of the pattern library is generated from this one file (regenerate with `bun run patterns:build`, gate-checked by `patterns:check`; `vr ref` runs the whole refresh chain):

- the root **README Pattern Index** — the marker-delimited region is rendered from the registry's `groups`/`categories` blocks and rows; never hand-edit it
- **`docs/pattern-library/<id>.md`** — one pointer page per record in the library's own top-level docs section, served at `/docs/pattern-library/<id>`, ingested into the RAG corpus, and listed first in `/llms.txt`
- **`/docs/pattern-library`** — the section's catalog index (every pattern + purpose, grouped by category), a live route over the same registry import (`#lib/server/patterns/catalog.ts`), so it is current without a build step
- both **MCP runtimes** (stdio + hosted) and the **`/showcases/mcp`** visualization
- Vely's **`search_pattern_library`** chatbot tool — the same static registry import the hosted MCP uses

### Curated cards over raw grep

Each card bundles five things a grep hit never gives you together: **docs** (what to read first), **code** (where the canonical implementation lives), **tests** (what pins its behavior), **showcases** (where it's proven live), and **invariants** (what must hold true after emulation, not just after copying). `get_pattern` returns the whole card; `trace_capability` walks concept → docs → code → tests → proof for a free-text query; `search_patterns` ranks cards lexically — no embeddings, no network call, because the container has neither.

### Ranking

Each query term scores the weight of the **best field** it appears in (title, keywords and capabilities above summary and `when_to_use`, invariants last), times its **IDF** over the registry; the sum is scaled by **coverage**, the IDF-weighted share of the query that matched. Three consequences, each measured on the blind holdout set in `pattern-library/bench/` (Acc@1 52% → 76%, Recall@3 44% → 88% against the previous per-field sum):

- a term repeated across fields is one match, not three, so a record that answers the whole question outranks one that answers one word loudly;
- a word in sixty records ("data") weighs little and a word in two ("stampede") decides;
- coverage grades every hit `strong | partial | weak`. When the best hit is weak the registry almost certainly has no pattern for the request, so the tools answer with the hosted `empty` no-match (the capability-gap signal) and list the closest overlaps labelled as such — rather than a confident ranking of incidental word matches, which is what every uncovered query used to get.

An exact id or title is a lookup and ranks first. The id is otherwise not indexed: its `<category>-` prefix is a namespace that let every light `architecture-*` row outrank the deep card for "architecture". Plurals and `-ing`/`-ed` forms are folded crudely on both sides; a query term of four or more letters also matches as a prefix at half weight. Embeddings, BM25F field-weight tuning and rank fusion were considered and rejected for this corpus: a few hundred curated records with authored keywords leave little for them to find, and they would add a model to the stdio container and the Vercel cold start.

Because the match is purely lexical, **a keyword that does not survive tokenization is not weak — it is absent**, and it reads on the card as if the term were covered. The tokenizer lowercases, splits on non-alphanumerics and drops single characters and stopwords; a `+` joining two alphanumerics (`n+1`, `cmd+k`) is kept as part of the term, because splitting it produced two characters that the length filter then discarded. `search.test.ts` asserts no registry keyword tokenizes to nothing. There is one tokenizer, so a fix cannot land in one runtime only; `parity.test.ts` runs every benchmark query, every card, every plan and every allowlisted excerpt through both transports and compares the bytes an agent would see.

### Progressive disclosure: discover broadly, narrow, retrieve minimally

Every tool answers at the smallest grain that settles the agent's next decision, and expands only on request. All of it is optional parameters with the old behaviour as the default.

| Need | Call | Instead of |
|---|---|---|
| What exists | `search_patterns {query:"*"}` → the category map with counts; add `category` / `tier` / `maturity` to list a facet | guessing queries |
| Is it relevant, does it fit | `search_patterns … detail:"compact"` → per row: tier, maturity, `requires`, `depends on`, the headline `avoid when` | a full card per candidate |
| Just the ids | `detail:"ids"` | — |
| Several cards, or part of one | `get_pattern {ids:[…], sections:[…]}` (≤ 5 cards; `overview`, `fitness`, `docs`, `code`, `tests`, `showcases`, `invariants`, `emulation_notes`) | one call per card |
| One function or one doc section | `get_file_excerpt {path, section}` — a markdown heading or a code declaration; the `#fragment` paths cards print resolve the same way | paging 100 lines blind |

Two rules keep selective disclosure honest. A partial card always keeps its header — tier, maturity, risk, `depends on`, `requires` — and closes with a line naming every withheld section and its size, calling withheld invariants out as MUST-hold; it never reads as "this pattern has no invariants". And a windowed excerpt that stops before EOF ends with the sections below it, so the next call can be targeted. `excerpt.test.ts` checks that every `#fragment` a card cites resolves to a heading.

The trade is measured, not assumed (`bun run mcp:bench`, scripted workflows, ≈tokens including a per-call overhead): checking fit 3 calls ≈2.3k → 2 calls ≈0.65k; reading three patterns' invariants 3 calls ≈2.9k → 1 call ≈0.9k; reading the doc section a card cites 2 calls ≈2.6k → 1 call ≈0.6k. The cost is a longer tool list (≈1.0k → ≈1.4k tokens; Claude Code's tool search loads schemas on demand) and ≈60 more tokens per default search row, which now carries the rule-out facts.

### Deterministic plan assembly, not inference

`recommend_emulation_plan` takes a list of desired capabilities and returns a dependency-ordered build plan — but it does no reasoning of its own. It matches capabilities to pattern records lexically, expands the selection through `depends_on` edges, and orders the result with the same Kahn toposort `pattern-library/validate.ts` uses to check the registry for cycles. The assembly is 100% deterministic and inspectable; the agent supplies the judgment about *how* to adapt each step to the target project. Keeping the assembler dumb is deliberate — it's a query over curated facts, not a second opinion.

Each step also carries the pattern's **fitness block** — `requires` (the infrastructure the target must already run), `avoid_when` (contraindications) and `alternatives` (the smaller option and when it wins) — and the plan ends with the union of `requires`. The tool never drops a step on its own; it puts the reasons *not* to adopt a pattern in front of the agent before the how, because a catalog that only says "use me" over-recommends (LLMs measurably over-suggest patterns). The same headline contraindication is printed in the generated README index, since an index the agent always reads beats a tool it rarely calls. Whether these fields change agent choices is **unmeasured** — they are author judgement, kept honest by the rule that every entry is grounded in the pattern's own docs.

Three refinements, each measured on the dev plans in `pattern-library/bench/` (now a precision test in `search.test.ts`: every plan contains exactly its required patterns):

- **Admission.** Each capability contributes its best deep match, plus a runner-up only when that is a *strong* match within half the best score; weak overlaps never become steps. A partial runner-up used to drag its whole dependency chain in — "fast slow-page loading" added `scenario-harness` and with it `performance-budget-ratchet` (8 steps → 5).
- **Transitive requirements.** `requires` is shown with its dependencies' infrastructure folded in and attributed — `singleflight` requires nothing itself, but adopting it takes `redis (via hierarchical-cache)`. Cards, compact search rows and plan steps all print the closure, so fit is decidable without opening the dependency's card.
- **A declared target.** `target_infra` (the closed `PATTERN_REQUIREMENTS` vocabulary) turns each step into a verdict: "Fits the target." or "Target lacks pgvector, ai-provider — drop or replace this step, and the steps that build on it." Absent, nothing is asserted: *unknown* stays distinct from *missing*. `detail: "outline"` drops docs, code, tests and invariants from the steps — counting the withheld invariants — for agents that fetch the cards they keep with `get_pattern {ids, sections}`.

### Ephemeral read-only container

MCP clients spawn the server as a throwaway container, not a long-lived process on the host:

```bash
podman run -i --rm --network=none -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
```

`--rm` means no state survives between sessions, `--network=none` means no exfiltration path exists even if something in the tool chain were compromised, and `:ro` means the mount can't be written to no matter what the server code does. This is kernel-enforced isolation, not a promise the application layer has to keep. `security.ts` adds a second, application-level layer on top — realpath-based path containment (rejects `..` traversal and symlink escapes) and a secret-filename denylist (`.env`, `*.pem`, `*.key`, `.git/`, `node_modules/`, …) for `get_file_excerpt` — because client-supplied paths are advisory in MCP; the server is the trust boundary, not the client.

### Zero-dependency protocol

`server.ts` and `protocol.ts` hand-roll JSON-RPC 2.0 framing over newline-delimited stdio (MCP spec 2025-11-25) with no SDK and no validation library. This isn't a style preference: the container is a bare `oven/bun` image with no `node_modules`, so any dependency would mean either baking a custom image or an `bun install` step on every spawn. Hand-rolling the ~150 lines of framing and a hand-written structural validator (`registry.ts`) keeps the spawn command a one-liner and the cold-start instant.

The `initialize` response also carries a hand-written `instructions` string (in `server.ts`) that tells the calling agent *when* to reach for this server versus plain `Read`/`Grep` — the same "emulate, don't clone" framing this doc opens with, but delivered as part of the protocol handshake instead of a doc the agent might not have read.

### Client design constraints (the gotchas)

A handful of the server's behaviors exist only because live E2E testing against Claude Code surfaced non-obvious client bugs and limits. They're encoded as constraints, not comments, and regression-guarded by `smoke.ts` (a spawned-subprocess test, not a mock) where possible:

| Constraint | Why |
|---|---|
| Tool defs carry only `name`/`description`/`inputSchema` — never `outputSchema`, `title`, or `annotations` | A live Claude Code bug silently drops a server's *entire* tool list if any one tool definition carries these fields. |
| Tool results are plain text/markdown — `structuredContent` is never returned | E2E dogfooding showed that when a result has `structuredContent`, Claude Code shows the model *only* that payload and hides the text body — `get_file_excerpt` came through as bare metadata with no code. |
| stdout carries protocol frames only; all logging goes to stderr | Any stray `console.log` corrupts the NDJSON stream the client is parsing. |
| The process exits on stdin EOF or SIGTERM/SIGINT | Claude Code has a known issue leaving spawned child processes orphaned otherwise — the server terminates itself rather than trusting the client to clean up. |
| Every response stays well under Claude Code's 10k-token warning threshold | Built in by construction: bounded excerpts (`get_file_excerpt` caps at 250 lines and 36 KB), at most 50 search rows and 5 cards per call, no unbounded list dumps. |

These aren't arbitrary style choices — each one maps to a specific failure mode observed by spawning the real server against a real client. Treat them as invariants of the MCP transport layer itself, the same way a pattern card's `invariants` field pins behavior for the patterns it describes.

### Considered and not adopted (2026-10)

Each was weighed against this workload — a few hundred static records, sub-millisecond queries, one dominant client — and the measurements in `pattern-library/bench/`:

| Option | Decision | Why |
|---|---|---|
| `structuredContent` / `outputSchema` | Not adopted | Claude Code forwards only the structured payload on success when both are present (documented; maintainer-confirmed, 2026), so the markdown body — next actions included — would vanish. |
| Tool `annotations` (`readOnlyHint`) | Deferred | Recommended by the spec, but this repo recorded a live Claude Code bug that dropped the server's whole tool list over them. Re-adding needs an interop test against a real client, which the automated gate cannot run. |
| MCP 2026-07-28 (stateless, `server/discover`, `ttlMs`) | Deferred, separate change | Current clients still connect to 2025-11-25 servers. The migration touches framing, headers and errors on both transports and belongs with SDK v2 and its own interoperability tests, not inside a retrieval change. |
| Resources / prompts | Not adopted | Every retrieval need above is met by parameters on the six existing tools; another surface would add discovery cost without new information. |
| Embeddings, hybrid search, rank fusion | Not adopted | IDF + best-field + coverage took the blind holdout from 52% to 76% Acc@1 with no model; embeddings would add a model to the stdio container and the Vercel cold start for a curated corpus with authored keywords. |
| Response memoization / HTTP caching | Not adopted | Queries run in well under a millisecond over a cached per-registry index; POST JSON-RPC is not HTTP-cacheable anyway. |

## Registry record shape

Each record in `registry.json` has `id`, `tier` (`deep | light`), `title`, `category` (an id from the root `categories[]` block, which — with `groups[]` — also drives the generated index's sections and order), `summary`, `when_to_use`, the fitness block — `avoid_when[]` (contraindications; entry 0 is the index headline), `alternatives[]` (`{ approach, prefer_when }`), `requires[]` (closed vocabulary `PATTERN_REQUIREMENTS` in `schema.ts`) — `capabilities[]`, `keywords[]`, `depends_on[]`, and four reference lists — `docs[]`, `code[]`, `tests[]`, `showcases[]` (each a `{ path, note?, kind? }` ref, `kind` one of `file | dir | route | approute | anchor`; `route` = a showcase-registry href, `approute` = a live app route with no showcase) — plus `invariants[]`, `emulation_notes[]`, `risk`, and the evidence grade: `maturity` (`planned | implemented | proven`) with `verifiedAt` (YYYY-MM-DD) and `verifiedSha` attestations. Deep records must have non-empty `avoid_when`/`invariants`/`emulation_notes`/`capabilities`/`keywords`/`docs`; light records must keep the two depth fields empty. The maturity contract is structural: `proven` requires at least one `tests`/`showcases` ref plus `verifiedAt`, `planned` forbids proof refs, and the attestation fields are only legal on `proven` — so the grade cannot drift from the refs that justify it. See the file itself for current entries; this doc won't re-derive what the schema already states plainly.

## Hosted trust surfaces

Everything above describes the local stdio server a client spawns as an ephemeral container. The same pattern registry is now *also* served read-only over HTTP, at `POST /api/mcp/public` — no auth, same six tools, no mutation path to dispatch.

A second, unrelated surface, the private admin MCP at `POST /api/mcp/admin`, lives behind a bearer token and exposes a narrow set of demo-state tools over a small persistent domain — it shares only the transport plumbing with the public endpoint, not the registry or the trust level.

Full detail — trust-surface boundaries, auth, rate limits, the persistent demo state, the protected `/admin/mcp` page, env vars, and deployment caveats — lives in [hosted-mcp.md](./hosted-mcp.md).

## Where to go next

- **See it live:** [/showcases/mcp](/showcases/mcp) — interactive dependency graph, architecture diagram, and protocol walkthrough
- **Run it, test it, register it, add a pattern:** [mcp/README.md](../../../mcp/README.md)
- **Read the code:** [mcp/](../../../mcp/) — `server.ts` (entry/lifecycle), `protocol.ts` (framing), `security.ts` (containment), `tools.ts` (the stdio adapter over the shared query layer), `snippet.ts` (validate_snippet engine); and [pattern-library/](../../../pattern-library/) — `schema.ts` (types/validation/toposort), `search.ts` (ranking), `query.ts` (tool contract + registry tools), `excerpt.ts` (excerpt rendering)
- **The pattern this MCP itself follows:** [multi-client-core.md](./multi-client-core.md) — the registry's domain-shaped data plus a thin adapter is the same shape as every other pattern in this repo
