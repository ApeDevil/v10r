# Agent Experience (AX)

How v10r serves AI agents as first-class consumers: a machine-readable docs layer, an agent-facing URL map, self-correcting MCP errors, and a loopable convention checker.

v10r's consumption model *is* agent-mediated — the PRD's thesis is that an AI agent reads these tested patterns and adapts them to a new project. So agent experience here is not a feature bolted onto a human product; it is the delivery mechanism for the product itself. This document describes the four AX surfaces, the contracts they keep, and the constraints that shaped them.

---

## The four surfaces

| Surface | Consumer | Mechanism |
|---------|----------|-----------|
| `.md` docs layer | any HTTP agent (Claude Code, Cursor, and OpenCode send `Accept: text/markdown` today) | every published `/docs/**` page serves raw markdown at its URL + `.md`; the clean URL honors `Accept: text/markdown` with a redirect |
| `/llms.txt` | agents navigating the docs (llmstxt.org shape) | curated URL map of the whole published corpus, plus an in-band "Instructions for LLM agents" block |
| Hosted MCP (`POST /api/mcp/public`) | MCP clients without repo access | six read-only pattern tools, every error carrying a `## Next actions` recovery block |
| Stdio MCP (`mcp/server.ts`) | coding agents with the repo cloned | the same six tools in an ephemeral, network-isolated container |

Repo-level agent instructions live in `AGENTS.md` (the cross-tool convention) and `CLAUDE.md` (Claude Code specifically); both point here rather than duplicating this content.

Live proof: [/showcases/ax](/showcases/ax) exercises every surface with real requests from the browser — the negotiation redirect, `/llms.txt`, a `## Next actions` error, the protocol-version 400, and an interactive `validate_snippet` loop.

## Nothing is hand-maintained

Every artifact derives from an existing single source of truth, because a parallel corpus that needs manual sync is the documented failure mode of this whole genre (Astro removed its llms.txt over exactly that):

| Artifact | Derived from |
|----------|--------------|
| `.md` responses | `getManifest()` / `getRawMarkdown()` (`src/lib/server/docs/manifest.ts`) — the raw glob is consulted only after a manifest hit, so a blocked or draft doc is structurally unreachable (`src/lib/server/docs/markdown-urls.ts`) |
| `/llms.txt` | `buildLlmsTxt(getManifest())` — it cannot drift from the docs, and its test round-trips every emitted URL through the `.md` resolver |
| `validate_snippet` rules | `mcp/snippet-rules.json` (shared by both MCP runtimes) + the `--color-*` names extracted from `src/app.css` at load time |
| Agent pages (`/docs/programming/*.md`) | the agents registry body — never the raw files, whose frontmatter carries tool grants the HTML page has never published |
| README Pattern Index (the marker-delimited region) | `mcp/patterns.registry.json` via `scripts/patterns/build-derived.ts` (`patterns:build`; staleness gated by `patterns:check`) |
| `docs/pattern-library/*.md` (one page per pattern in its own docs section, → `/docs`, RAG, `/llms.txt`) | the same registry + generator — pointer pages only, never copied prose |
| `/docs/pattern-library` (the section's catalog index: every pattern + purpose) | the same registry, projected live by `$lib/server/patterns/catalog.ts` — no build step |

## The negotiation contract

Cache safety decided the shape, not convenience. HTML at the clean URL is `Vary`-free; the `.md` URL serves its cacheable markdown to agents only and varies on `Sec-Fetch-Dest`; every negotiated redirect is uncacheable:

| Request | Response | Cache-Control | Vary |
|---------|----------|---------------|------|
| `GET /docs/x.md` (agent) | 200 markdown | `public, max-age=0, s-maxage=3600` | `Sec-Fetch-Dest` |
| `GET /docs/x.md` with `sec-fetch-dest: document` (human) | falls through to routing → 303 → `/docs/x` | (redirect, uncached) | — |
| `GET /docs/x` with `Accept: text/markdown` | 303 → `/docs/x.md` | `no-store` | `Accept` |
| `GET /docs/x` (browser) | 200 HTML + `Link: </docs/x.md>; rel="alternate"` | as before | — |

A 308 keyed off a request header without `Vary` would let a shared cache serve the redirect to browsers — that is why the negotiated response is 303 and `no-store`. Wildcards never negotiate (curl's default `Accept` gets HTML), and `sec-fetch-dest: document` never negotiates regardless of the header — a browser navigating to a `.md` URL instead falls through the hook into SvelteKit routing, where the docs layout (`docs/+layout.server.ts`) 303s the suffix away to the rendered page. SvelteKit data requests (`__data.json`, client-router navigations) fall through the same way: serving markdown to them would crash the router's JSON parser. The hook (`docsMarkdown`, stage 4 in `src/hooks.server.ts`) sits above `loadStyle` and `i18n` so no `Set-Cookie` can void `s-maxage` — pinned by an ordering assertion in `handle-chain.gate.test.ts`.

Discovery is layered so an agent finds the map from any entry point: every `/docs` response carries `Link: </llms.txt>; rel="llms-txt"`, doc HTML heads carry `<link rel="alternate" type="text/markdown">`, robots.txt names `/llms.txt`, and `AGENTS.md` lists all four surfaces.

## Self-correcting MCP errors

Every registry-produced tool error ends with a fixed-heading text block:

```
## Next actions
1. `search_patterns` {"query":"pattern"} — lists every pattern in the library.
```

The convention (each rule is a test assertion in `diag.test.ts` / `next-actions.gate.test.ts`):

- the heading is the exact literal `## Next actions` — one grep-able anchor on both surfaces;
- 1–3 numbered entries: backticked tool name, compact JSON args, one clause of *why*;
- argument values are always literals the registry wrote, never caller text — the block adds no echo surface;
- suggested tools exist on the *same* trust surface (a public error never names an admin tool);
- it is **text**, not a structured field — both surfaces are text-only because `structuredContent` makes Claude Code hide the text body entirely.

The hosted `errorResult(body, diag, next)` requires the actions at compile time, mirroring the reasoning that made `diag` required: a new error branch that strands the caller must be a compile error, not a review miss. The transport's two bare literals (unknown-tool, tool-threw) deliberately carry *neither* `diag` *nor* the block — that absence is the telemetry discriminator, and it now signals in both channels.

## validate_snippet

The sixth pattern tool closes the loop `svelte-autofixer` pioneered: submit a snippet, get deterministic line-numbered findings with fixes and doc links, resubmit until clean. It mechanizes the conventions that were previously enforceable only by review: Svelte 5 runes (no `export let`, no `$:`, no stores), component-first, design tokens (including the opacity-modifier trap), Valibot over Zod.

Contracts worth knowing:

- **Findings are a success, not an error.** An `isError` would make agent loops treat the normal case as failure, and it would pollute the `mcp.call_log` capability-gaps meter. Only malformed arguments are errors.
- **Oversize snippets are refused, never truncated** (20 000 chars) — a partially validated snippet reads as clean.
- **The report never echoes snippet content** — findings are `rule at line:column` only, and the argument is named `snippet` precisely because telemetry's `extractQuery` does not read it. Three independent barriers keep caller code out of the call log, pinned by `observer.snippet.test.ts`.
- **The stdio server is a one-directional superset**: it adds a `Bun.Transpiler` syntax pre-check (`syntax-error`) the hosted surface never emits, and it degrades *visibly* (a report footer) if `src/app.css` is unreadable.

## Known limitations and anti-goals

- `Cross-Origin-Resource-Policy: same-site` is stamped on every response, so a *browser-context* cross-origin fetch of `/llms.txt` or a `.md` page is blocked. CLI and server-side fetches — the actual agent path — are unaffected. Deliberate: weakening the header for everyone to serve one edge case is the wrong trade.
- **No `llms-full.txt`.** The size-ladder pattern serves frameworks with millions of consumers; here it would be a second corpus to maintain.
- **No SEO motivation.** Google states Search ignores llms.txt; two 100k+-domain studies found zero citation effect. These surfaces exist for agents already fetching v10r, not for crawlers.
- **English only, locale-invariant.** The docs corpus is English by design; `.md` URLs are unprefixed and locale-prefixed variants 308 to them.
