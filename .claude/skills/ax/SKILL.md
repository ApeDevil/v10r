---
name: ax
description: Velociraptor's agent-facing surfaces (AX) — the two MCP runtimes (hosted + stdio) and their shared-JSON contract, the Next-actions error convention, the validate_snippet loop tool, the .md docs layer + Accept negotiation, /llms.txt, and the root AGENTS.md. Use for ANY work on how outside agents consume v10r — adding or changing MCP tools, tool error shapes, the markdown docs layer, llms.txt content, or the snippet rules. This is project-truth and authoritative for these surfaces; it supersedes generic `api-design`/`ai-tools` guidance where they touch v10r's own agent surfaces.
---

# AX — Velociraptor's agent-facing surfaces

The **project-specific** companion to `api-design` (generic contract practice) and `ai-tools` (consuming models). This skill covers the inverse direction: **how outside agents consume v10r**. Rationale and design history live in the canonical doc `docs/blueprint/architecture/agent-experience.md`; this skill carries the operational invariants so you stop re-deriving (or silently breaking) them.

## 0. The map — four surfaces, nothing hand-maintained

| Surface | Source of truth | Derivation |
|---|---|---|
| `AGENTS.md` (repo root) | itself | universal contract for non-Claude agents; deliberately has **no stack table** (anti-drift — stack lives in /docs); Claude Code reads CLAUDE.md, which supersedes it |
| `/docs/**.md` + negotiation | `src/lib/server/docs/markdown-{urls,hook}.ts` | every published doc served as raw markdown at URL + `.md` |
| `/llms.txt` | `src/lib/server/docs/llms-txt.ts` + `src/routes/llms.txt/+server.ts` | `buildLlmsTxt(getManifest())` per request — **never hand-edit link sections**; to change content, change the docs/manifest |
| MCP × 2 runtimes | hosted `src/lib/server/mcp/` (HTTP, Vercel: `/api/mcp/public` + bearer-gated `/api/mcp/private`, same 6 pattern tools; separate `/api/mcp/admin` demo registry) · stdio `mcp/` (zero-dep podman) | 6 tools each, name-parity pinned; `private` = full self-telemetry (query+answer per call, `MCP_PRIVATE_TOKEN` realm) |

## 1. The governing rule: two runtimes, one JSON seam

**Never import `mcp/*.ts` into `src/`, or `src/` into `mcp/`.** The stdio runtime is a bare `oven/bun` container (`--network=none`, repo mounted `:ro`, Bun built-ins only) and must stay dependency-free. The ONLY cross-boundary artifacts are shared JSON:

- `mcp/patterns.registry.json` — the pattern cards
- `mcp/snippet-rules.json` — validate_snippet rules + fixtures
- `mcp/public-excerpts.snapshot.json` — build-time file-excerpt snapshot

**The fixtures in `snippet-rules.json` are the behavioral parity guard**: the hosted engine test replays every one, the stdio smoke replays them against the live server. `parity.test.ts` pins tool-**name** equality hosted↔stdio. There is no byte-identity gate — behavior parity via fixtures is the contract.

## 2. Wire discipline (results and errors)

- **Text-only results.** `structuredContent` makes Claude Code hide the text body entirely. Tool defs carry ONLY `name`/`description`/`inputSchema` — extra fields (`outputSchema`, `title`, `annotations`) silently drop the tool in some clients.
- **`errorResult(body, diag, next)` — BOTH `diag` and `next` are required**, and that is load-bearing: the telemetry recorder infers `isError && no diag ⟹ transport-built` (a TOTAL inference), and a new error branch that strands the caller without a recovery step must be a compile error. `diag` is a CLOSED union (`ToolDiag`), stripped by `toWire()` before serialization — extending it means outcome-mapping + telemetry work; prefer existing codes.
- **The transport's two bare `isError` literals (`transport.ts:62,79`) stay bare** — no diag AND no Next-actions block. That absence is a doubly load-bearing discriminator; never route them through `errorResult`.
- **Next-actions convention** (each rule is a gate assertion in `next-actions.gate.test.ts` + `diag.test.ts`): heading is the exact literal `## Next actions` (literal-parity between `types.ts` and `mcp/tools.ts`); ≤3 numbered entries; `args` are ALWAYS registry-written literals, never caller text; suggested tools must exist on the SAME surface; `why` ≤120 chars; and the word `diag` must NEVER appear in caller-visible text (`http.test.ts` asserts on raw response text).
- **Bounded echo:** `get_pattern`'s id reflection is the ceiling. No new surface may echo caller input back.
- **Landmine:** never emit `-32022` on the protocol-version 400 (client SDKs hard-fail on it).

## 3. Adding or changing a tool — the sprawl checklist

Six tools today: `search_patterns`, `get_pattern`, `get_file_excerpt`, `trace_capability`, `recommend_emulation_plan`, `validate_snippet`. A seventh means, **append LAST everywhere** (order is asserted, not just count):

1. Count/order-pinned gate tests: `patterns/parity.test.ts`, `patterns/registry.test.ts` (exact-order array), `transport.test.ts`, `sdk-interop.test.ts`, `src/routes/api/mcp/public/server.test.ts`.
2. `src/lib/showcase/mcp/tool-cards.ts` — order-pinned drift test.
3. NOT gate-run but mandatory: `mcp/server.test.ts` (tool count) + `mcp/smoke.ts` (call sequence, reply count).
4. ~12 prose sites name the count: `mcp/README.md`, `mcp/server.ts` INSTRUCTIONS, `patterns/registry.ts` header + `PUBLIC_MCP_INSTRUCTIONS`, showcase `+page.svelte`, docs `pattern-mcp.md`/`hosted-mcp.md`/`architecture/README.md`.
5. Both dispatchers (`patterns/registry.ts` HANDLERS + `mcp/tools.ts` dispatch) and, if errors exist, per-branch Next-actions arrays.

Run `bun run test src/lib/server/mcp src/lib/showcase/mcp` (in the container) BEFORE touching prose.

## 4. validate_snippet contracts

- **Findings are SUCCESS** (`textResult`), never `isError` — a dirty snippet is the tool working. Only empty/oversize input is an error: `invalid_args`, **refuse-don't-truncate** (never silently validate a prefix).
- **The report NEVER echoes snippet content** — `line:column` only (reflection/amplification guard; also keeps output far under the 40 KB bound). Telemetry cannot capture snippets by construction: the observer's `extractQuery` reads only `query`/`capability`/`capabilities`, and `queryText` persists only when `outcome='empty'` ∧ public — this tool never returns `empty`.
- Rules live in `mcp/snippet-rules.json` (`maxSnippetChars` 20000, `maxFindings` 50, 10 rules, 18 fixtures). `{{COLOR_TOKENS}}` expands at load from `src/app.css` (**42 unique** `--color-*` names — the ~480 figure counts declarations across theme blocks).
- **vitest stubs ALL CSS imports to `''`** (css:false default), even `?raw`/`?inline` — that's why `snippet/rules.ts#loadAppCss` is glob-first with an fs fallback. Keep the fallback.
- Stdio adds a `Bun.Transpiler` **syntax-error superset** (svelte: script blocks only) that the hosted engine never emits — a documented one-directional difference, not drift.
- `snippet/rules.gate.test.ts` enforces: unique ids, every `docs` link resolves via `resolveMarkdownRequest`, ReDoS bound (<50ms on 20k pathological input — no nested quantifiers), token expansion >30.

## 5. The .md docs layer + /llms.txt

- **`resolveMarkdownRequest` (`markdown-urls.ts`) is the SOLE chokepoint** — exact-match via `getEntry()`/agents registry/`ROOT_DOCS`, and it NEVER falls back to the raw docs glob. That is the blocked-doc leak guard; leak tests live in three suites. Adding a servable doc = publish it in the manifest, never widen the resolver.
- `/docs/programming/*.md` serves the **registry body** (`# id` + rendered body), never raw agent files — frontmatter carries tool grants and model config.
- `ROOT_DOCS` = `system-abstraction` + `codebase-organization`: in the raw glob but NOT the manifest — special-cased, remember them when reasoning "all published docs".
- **Negotiation:** clean /docs URL + `Accept: text/markdown` → **303** + `Vary: Accept` + `no-store` (a 308 keyed off a request header without Vary = cache poisoning); `sec-fetch-dest: document` forces HTML. Direct `.md` hit → 200 `text/markdown` + `s-maxage=3600` + `Link` canonical/llms-txt. The `docsMarkdown` hook sits at **index 3 of 14** — above every Set-Cookie writer, or shared-cache `s-maxage` dies silently; `handle-chain.gate.test.ts` pins both the 14-name snapshot and the ordering.
- llms.txt hardcodes `PROD_ORIGIN` (canonical URLs — preview origins die on next push); its test round-trips **every** emitted URL through `resolveMarkdownRequest`. When writing agent-instruction text, the opacity-guard scans `src/` — use the `bg-<token>/10` placeholder trick, never a real token with a modifier.
- Dev-only cosmetic: a blocked `.md` path 404s in the hook but falls through SvelteKit's dev middleware to Vite's fs-restriction **403** (no content served; prod returns the clean 404).

## 6. Operational gotchas

- Editing any file captured in `public-excerpts.snapshot.json` → run `bun run mcp:excerpts:build` (AFTER biome formatting), or `mcp:excerpts:check` fails the gate. 65 files captured.
- Stdio smoke: `podman run --rm -v "$PWD":/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/smoke.ts`. `DEFAULT_ROOT=/v10r`; inside the dev container the repo is at `/app`, so set `V10R_ROOT=/app`.
- `MCP_TELEMETRY_SALT` / `MCP_SELF_TRAFFIC_TOKEN` unset ⇒ both **fail open silently** (unkeyed hash / no self-traffic tagging). `MCP_PRIVATE_TOKEN` unset fails CLOSED (503 on `/api/mcp/private`).
- `/api/mcp/` MUST stay CSRF-exempt (or every non-browser client 403s); rate-limit sits BEFORE auth on both bearer surfaces (admin, private).
- Private-lane telemetry: `query_text` on EVERY outcome + `response_text` (4000-cap, whitespace kept) + `workspace` header label, `surface='private'`, `traffic` never `'external'` — lane queries filter on `surface`, never `traffic`. `extractQuery` stays a closed allowlist even here.

## 7. Scope boundaries (route elsewhere)

- `mcp.call_log` schema / retention → **daty**; telemetry pipeline semantics → the MCP-telemetry docs, not guesswork.
- REST/GraphQL/pagination contracts generally → `api-design` skill / **apy** (this skill wins only on v10r's own agent surfaces).
- Consuming models (AI SDK, streaming, RAG) → `ai-tools` + `nrag` / **aiy**.
- A live failure ("MCP 500s right now") → **tray**.

## Quick reference — grounded identifiers

| Thing | Where | Fact |
|---|---|---|
| Error contract | `src/lib/server/mcp/types.ts:192` | `errorResult(body, diag, next)` — both required |
| Next-actions | `types.ts:152–178` | `NextAction`, `NEXT_ACTIONS_HEADING`, `MAX_NEXT_ACTIONS=3`, `withNextActions` |
| diag strip | `src/lib/server/mcp/http.ts:164` | `toWire()` — diag never reaches the wire |
| Bare transport literals | `src/lib/server/mcp/transport.ts:62,79` | stay bare — telemetry discriminator |
| Hosted tools (6) | `src/lib/server/mcp/patterns/registry.ts` | defs at :41–:150, append LAST |
| Stdio mirror | `mcp/tools.ts` + `mcp/snippet.ts` | local heading literal + `fail(body, actions)` |
| Shared rules | `mcp/snippet-rules.json` | 10 rules, 18 fixtures = parity guard |
| Rule loader | `src/lib/server/mcp/snippet/rules.ts` | `loadAppCss` glob+fs fallback, `COLOR_TOKEN_COUNT` |
| Engine | `src/lib/server/mcp/snippet/engine.ts` | `validateSnippet`, `renderReport` (no echo) |
| Doc resolver | `src/lib/server/docs/markdown-urls.ts` | `resolveMarkdownRequest` — sole chokepoint |
| Negotiation | `src/lib/server/docs/{accept,markdown-hook}.ts` | `prefersMarkdown`, `docsMarkdown` (chain index 3) |
| llms.txt | `src/lib/server/docs/llms-txt.ts` | `buildLlmsTxt(manifest, PROD_ORIGIN)` |
| Gates | `next-actions.gate.test.ts`, `snippet/rules.gate.test.ts`, `handle-chain.gate.test.ts` | convention → assertion |
| Canonical doc | `docs/blueprint/architecture/agent-experience.md` | rationale + contract tables |
