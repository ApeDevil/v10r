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

The server (`server.ts`, `protocol.ts`, `tools.ts`) is intentionally boring: JSON-RPC plumbing and six query functions over two JSON files (the pattern registry and the snippet rules). All the curation work — deciding what counts as a pattern, which invariants matter, which files are the canonical entry point — lives in the registry data, not in code. Adding a pattern means adding a record, not writing a handler.

A drift guard (`validate-registry.ts`, wired into `bun run validate` as `patterns:validate`) keeps the registry honest: every `docs`/`code`/`tests` path must exist on disk, `showcases` refs of `kind: "route"` must be members of `src/lib/showcases/catalog/registry.ts` (not merely directories on disk), `depends_on` must form a DAG (checked via the same Kahn toposort the server uses at query time), IDs must be unique kebab-case, and each tier's contract holds (deep records must carry invariants/emulation notes; light records must not). A registry that references a moved or deleted file fails the gate — unlike a stale doc, it can't silently rot.

The registry is also self-referential: it catalogs v10r's own documentation conventions as patterns (`docs-nav-hubs`, `pattern-index`) alongside code patterns (`multi-client-core`, `layered-rag`, `jobs-scheduler`, …). The root README's Pattern Index is not a twin that could drift — it is **generated from this registry** (see "Derived surfaces" below).

### Two tiers, one record set

Since v2.0.0 the registry is the complete record of the pattern library, not a curated subset: **deep** records are full emulation cards (invariants and emulation notes required — the contract `patterns:validate` enforces), while **light** records are index rows carrying pointers to docs, code, and proof. Search covers both tiers (deep wins exact score ties); `recommend_emulation_plan` builds steps from deep records only and reports light-only matches as "related index entries" so the gap is visible. Promoting a pattern means filling in its depth fields and flipping `tier` — a reviewable edit, not a new file.

### Derived surfaces

Every human- and agent-facing form of the pattern library is generated from this one file (regenerate with `bun run patterns:build`, gate-checked by `patterns:check`; `vr ref` runs the whole refresh chain):

- the root **README Pattern Index** — the marker-delimited region is rendered from the registry's `groups`/`categories` blocks and rows; never hand-edit it
- **`docs/pattern-library/<id>.md`** — one pointer page per record in the library's own top-level docs section, served at `/docs/pattern-library/<id>`, ingested into the RAG corpus, and listed first in `/llms.txt`
- **`/docs/pattern-library`** — the section's catalog index (every pattern + purpose, grouped by category), a live route over the same registry import (`$lib/server/patterns/catalog.ts`), so it is current without a build step
- both **MCP runtimes** (stdio + hosted) and the **`/showcases/mcp`** visualization
- Vely's **`search_pattern_library`** chatbot tool — the same static registry import the hosted MCP uses

### Curated cards over raw grep

Each card bundles five things a grep hit never gives you together: **docs** (what to read first), **code** (where the canonical implementation lives), **tests** (what pins its behavior), **showcases** (where it's proven live), and **invariants** (what must hold true after emulation, not just after copying). `get_pattern` returns the whole card; `trace_capability` walks concept → docs → code → tests → proof for a free-text query; `search_patterns` ranks cards by a weighted lexical match over title/keywords/capabilities/category/summary/invariants — no embeddings, no network call, because the container has neither.

### Deterministic plan assembly, not inference

`recommend_emulation_plan` takes a list of desired capabilities and returns a dependency-ordered build plan — but it does no reasoning of its own. It matches capabilities to pattern records lexically, expands the selection through `depends_on` edges, and orders the result with the same Kahn toposort `validate-registry.ts` uses to check the registry for cycles. The assembly is 100% deterministic and inspectable; the agent supplies the judgment about *how* to adapt each step to the target project. Keeping the assembler dumb is deliberate — it's a query over curated facts, not a second opinion.

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
| Every response stays well under Claude Code's 10k-token warning threshold | Built in by construction: bounded excerpts (`get_file_excerpt` caps at 250 lines), capped result counts, no unbounded list dumps. |

These aren't arbitrary style choices — each one maps to a specific failure mode observed by spawning the real server against a real client. Treat them as invariants of the MCP transport layer itself, the same way a pattern card's `invariants` field pins behavior for the patterns it describes.

## Registry record shape

Each record in `registry.json` has `id`, `tier` (`deep | light`), `title`, `category` (an id from the root `categories[]` block, which — with `groups[]` — also drives the generated index's sections and order), `summary`, `when_to_use`, `capabilities[]`, `keywords[]`, `depends_on[]`, and four reference lists — `docs[]`, `code[]`, `tests[]`, `showcases[]` (each a `{ path, note?, kind? }` ref, `kind` one of `file | dir | route | approute | anchor`; `route` = a showcase-registry href, `approute` = a live app route with no showcase) — plus `invariants[]`, `emulation_notes[]`, `risk`, and the evidence grade: `maturity` (`planned | implemented | proven`) with `verifiedAt` (YYYY-MM-DD) and `verifiedSha` attestations. Deep records must have non-empty `invariants`/`emulation_notes`/`capabilities`/`keywords`/`docs`; light records must keep the two depth fields empty. The maturity contract is structural: `proven` requires at least one `tests`/`showcases` ref plus `verifiedAt`, `planned` forbids proof refs, and the attestation fields are only legal on `proven` — so the grade cannot drift from the refs that justify it. See the file itself for current entries; this doc won't re-derive what the schema already states plainly.

## Hosted trust surfaces

Everything above describes the local stdio server a client spawns as an ephemeral container. The same pattern registry is now *also* served read-only over HTTP, at `POST /api/mcp/public` — no auth, same six tools, no mutation path to dispatch.

A second, unrelated surface, the private admin MCP at `POST /api/mcp/admin`, lives behind a bearer token and exposes a narrow set of demo-state tools over a small persistent domain — it shares only the transport plumbing with the public endpoint, not the registry or the trust level.

Full detail — trust-surface boundaries, auth, rate limits, the persistent demo state, the protected `/admin/mcp` page, env vars, and deployment caveats — lives in [hosted-mcp.md](./hosted-mcp.md).

## Where to go next

- **See it live:** [/showcases/mcp](/showcases/mcp) — interactive dependency graph, architecture diagram, and protocol walkthrough
- **Run it, test it, register it, add a pattern:** [mcp/README.md](../../../mcp/README.md)
- **Read the code:** [mcp/](../../../mcp/) — `server.ts` (entry/lifecycle), `protocol.ts` (framing), `registry.ts` (types/validation/toposort), `security.ts` (containment), `tools.ts` (the six tools), `snippet.ts` (validate_snippet engine)
- **The pattern this MCP itself follows:** [multi-client-core.md](./multi-client-core.md) — the registry's domain-shaped data plus a thin adapter is the same shape as every other pattern in this repo
