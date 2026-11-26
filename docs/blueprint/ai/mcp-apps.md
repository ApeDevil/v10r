# MCP Apps — the pattern explorer View

**State:** built, merged into `claude/cloud/agentic-architecture` — an experiment, not shipped.
**Spec:** MCP Apps, SEP-1865 (`io.modelcontextprotocol/ui`, stable 2026-01-26).
**SDK:** `@modelcontextprotocol/ext-apps` 2.1.0 (official; server helpers and the app-side `App` bridge).

## Problem

v10r's hosted MCP answers in text. A dependency graph read as text is a list of lists: an agent
can use it, a person in an AI host cannot browse it. MCP Apps lets a tool name an HTML resource
(`ui://…`) that a supporting host renders in a sandboxed iframe next to the conversation, wired to
the same server through a postMessage bridge. The question this experiment answers: can v10r ship
one such View on its existing server, through the official SDK, without growing the app's client
bundle, without weakening the hosted surface's guarantees, and without abandoning clients that
do not support MCP Apps?

## Decision

One read-only App, **the pattern dependency explorer**, on the public and private hosted surfaces:

- **Tool** `explore_patterns` (`{ id? }`): for a pattern, its maturity, tier, requirements (own and
  inherited), the first three invariants, every transitive prerequisite in adoption order, every
  pattern that builds on it, and a link to its docs page; without `id`, the patterns that sit in
  the dependency graph by category, and its hubs.
- **View** `ui://v10r/pattern-explorer.html`: pick a pattern, see both directions, follow a chip to
  re-focus, filter the list, open the docs page through the host.

Why this candidate over a Studio view: it reuses the registry the Pattern MCP already serves —
`depends_on`, `maturity`, `invariants`, `requires` and `topoSort` from `pattern-library/schema.ts` —
and needs no input the host cannot type (the Studio architecture view needs a workload profile
and model file). It is also something the existing text tools answer only piecemeal: no tool
lists *dependents*.

## When to use an MCP App — and when not

| Use one | Don't |
|---|---|
| The answer is a structure a person explores (a graph, a table to filter) | The answer is prose or a short list — text is better everywhere |
| The data is already public on the same surface | It needs credentials, the user's data or network access from the View |
| A text answer of the same tool is still complete | The View would be the only way to get the answer |
| Hosts in the audience render MCP Apps (see the evidence table) | The audience is Claude Code / CLI agents only (they get the text) |

## Implementation

| Part | Where | Role |
|---|---|---|
| Projection | `pattern-library/dependency-explorer.ts` | Pure, framework-free: `explorePatterns(registry, args, { siteOrigin })` → `{ text, exploration }` or a `QueryOutcome`-style failure with next actions |
| SDK bridge | `mcp/tool-server.ts` | A registry may carry `views` (`AppView`). The view's tool is registered with `registerAppTool` (adds `_meta.ui.resourceUri` and the legacy `ui/resourceUri`), the View with `registerAppResource` (MIME `text/html;profile=mcp-app`, `_meta.ui` on both the list entry and the read content). Same dispatcher and error hygiene as every tool. `resources.listChanged: false` declared up front |
| Surface composition | `src/lib/server/mcp/apps/pattern-explorer.ts` | `patternRegistryWithExplorer(siteOrigin)`: the untouched `publicPatternRegistry` plus one tool and its View. The public and private routes build it per request so docs links name the deployment that answered |
| View source | `src/lib/server/mcp/apps/view/pattern-explorer.{ts,css}` | Vanilla TypeScript on `App` + `PostMessageTransport`. Under `server/` on purpose: SvelteKit refuses a client import of it, so it can never enter the app bundle |
| View artifact | `src/lib/server/mcp/apps/pattern-explorer.view.html` | Generated, committed, imported `?raw`. One document: inline script, inline styles, the v10r tokens it uses |
| Build / drift gate | `scripts/mcp/build-app-views.ts` · `mcp:apps:build` / `mcp:apps:check` (in `validate` and `refresh`) | Bun-bundles the View, extracts the needed tokens from `src/app.css` (`:root` and `.dark`, closed over referenced tokens) into `:root` / `:root[data-theme="dark"]`, writes a provenance header (input digest incl. package versions, Bun version, output digest) like the stdio bundle |

**One tool, two readers.** The tool answers markdown *and* the same projection as
`structuredContent`. The View renders the JSON; every other client reads the text. The JSON is
complete on its own because Claude Code shows the model only `structuredContent` when both are
present (mcp/README.md) — for this tool that costs readability, not information. The eight
Pattern tools stay text-only; `outputSchema` is not declared (B1).

**The View computes nothing about the graph.** It renders the server's projection; picking a
pattern calls `explore_patterns` again through `app.callServerTool`, and the first focus answer is
followed by one overview call to fill the picker. Host context drives the theme
(`applyDocumentTheme`) and the host's standard style variables (`applyHostStyleVariables`), which
the sheet prefers over v10r tokens (`var(--color-text-primary, var(--color-body))`). Where the host
offers it, the focused pattern is shared with the model (`updateModelContext`). The docs button
asks the host to open the link (`openLink`); the View itself never navigates.

**Size, measured (Bun 1.4.4, minified):** the document is 320 KB (86 KB gzip). The View's own code
is 5.9 KB (2.5 KB gzip); the rest is the official bridge (`App` pulls `@modelcontextprotocol/core`
and `client` with zod). A Svelte 5 probe of the same shape (mount, `$state`, `$derived`, keyed
each) measured 57 KB (21 KB gzip) before the bridge — ten times the vanilla code for a View with
one list and one card, so the View is vanilla. It is served once per render by `resources/read`
and is not part of the SvelteKit client bundle: the total-client-JS ratchet is unaffected. The
stdio bundle gained 665 bytes (the server helpers; stdio registers no View).

**Component-first.** The rule covers `.svelte` files that can reach `#lib/components/`. The View
is a separately compiled document with no Svelte and no UnoCSS, so it uses native `<button>` and
`<input>` styled only by tokens.

**i18n.** The View and the tool answer in English, like every MCP surface of v10r. The host's
`locale` is available in host context if a localized View is ever wanted.

## Security model

| Layer | Control |
|---|---|
| Data | Public registry data only — the same records `get_pattern` already serves. No user data, no credentials, no session |
| Tool | Read-only by construction (no mutation reachable), arguments bounded (`id` ≤ 512 chars), failures carry a closed `diag` and recovery steps. Rate limit, Origin check, body bound and telemetry are the surface's, unchanged |
| Resource metadata | `_meta.ui.csp` declares **no** `connectDomains`, `resourceDomains`, `frameDomains` or `baseUriDomains`; `permissions: {}` (no camera, microphone, geolocation, clipboard); no `domain` (the host's default per-conversation sandbox origin) |
| Document | Self-contained: one inline script, no `src`, no `<link>`, no image, frame, form or base; no fetch/XHR/WebSocket/EventSource/storage/dynamic import (`apps/pattern-explorer.test.ts` asserts it on the committed artifact, and allowlists the few inert URL literals the SDK carries — JSON Schema dialect ids, a description placeholder). A deny-all CSP `<meta>` rides along as defence in depth |
| Rendering | Text only: nothing from an answer is parsed as HTML (`textContent` / `append` of strings) |
| Host | The host is the enforcement point: SEP-1865 requires a sandbox proxy on a different origin than the host, iframe sandboxing, and blocking undeclared domains. The MCP Inspector does exactly this (opaque-origin inner frame, host-built CSP) — and, observed: it prepends its own CSP `<meta>`, so the View's own one lands outside `<head>` and is ignored there. The declared `_meta.ui.csp` is the control that counts; the meta only matters for a host that renders the HTML unwrapped |

## B1 interaction

B1 (tool `title` and `annotations.readOnlyHint`) stays **off**: no tool, including
`explore_patterns`, carries `title`, `annotations` or `outputSchema` — pinned by
`src/routes/api/mcp/public/server.test.ts` and the projection test.

What this change *does* add to the tool list is `_meta` on one tool (`ui.resourceUri` and the
legacy `ui/resourceUri`), and `structuredContent` on that tool's results. Neither is one of the
fields the 2026-10 Claude Code bug tripped on. The [compat kit](../architecture/mcp-evolution/claude-code-compat.md)
now has a `metaUi` field set (`_meta.ui.resourceUri` on every tool); its 2026-11-24 cloud run with
Claude Code 2.1.331 kept and called all eight tools on stdio and http (transcript summary:
`/mnt/project-files/agentic-architecture/claude-code-compat-2026-11-24.txt`).

## Host compatibility evidence

| Host | Result | Evidence |
|---|---|---|
| **MCP Inspector 2.16.0** (official, `@modelcontextprotocol/inspector`, web UI, ext-apps 2.x AppBridge, sandbox proxy on a second origin) | **Renders and works** — Apps tab lists `explore_patterns`; the View connects, receives the result, calls the tool again for the picker and on every chip, follows the host's dark theme | Playwright against `bun run dev`: `previews/mcp-app-focus-light.png`, `mcp-app-focus-dark.png`, `mcp-app-navigate-light.png`, `mcp-app-navigate-dark.png` (in `/mnt/project-files/agentic-architecture/`); protocol log shows `tools/call` → `resources/read` → `tools/call` |
| MCP Inspector CLI `--app-info` | `hasApp: true`, URI, empty CSP lists, `permissions: {}`, MIME — in both the legacy and the 2026-07-28 era | CLI run against the local server |
| Route tests (raw JSON-RPC through the SDK server) | Tool `_meta`, resource list/read with MIME and CSP, text + `structuredContent`, error shape | `src/routes/api/mcp/public/server.test.ts` |
| ext-apps `AppBridge` test host (Chromium, Playwright) → `/api/mcp/3d` | **Renders and works** — the 3D Viewer (`ui://v10r/3d-viewer.html`): View draws the model, app-only `render_model` calls, parameter edit → `ui/update-model-context`, `ui/download-file` for GLB/STL/JSON, `ui/open-link` | 2026-11-26, dev server; [parametric-modeling.md § Host compatibility](../3d/parametric-modeling.md#host-compatibility) |
| Claude (web/desktop), ChatGPT, VS Code, Goose, Postman, MCPJam | **Untested** — listed as MCP Apps hosts by the ext-apps README; no claim until a recorded run | — |
| Claude Code 2.1.331 (headless CLI) | **Works as a text host** — connects to the hosted `/api/mcp/public`, keeps all nine tools including `explore_patterns`, calls it and answers from the result; it renders no View (none expected in a CLI) | Cloud run 2026-11-24: `claude -p … --mcp-config` against `bun run dev`, 3 turns; compat kit `metaUi` case, 8/8 on both transports |

## Fallback

A host without MCP Apps support ignores `_meta.ui` and the resource and shows the tool's text: the
same graph in markdown, with the docs URL and next actions (`get_pattern`,
`recommend_emulation_plan`). A client that prefers `structuredContent` gets the full JSON
projection. A View opened outside a host shows "This view runs inside an MCP Apps host".

## Try it in an external host

1. `cp .env.placeholder .env && bun run dev` (no database needed for the public surface).
2. `npx @modelcontextprotocol/inspector --web --transport http --server-url http://localhost:5173/api/mcp/public`
3. Connect → **Apps** → `explore_patterns` → `id` = `multi-client-core` → **Open App**.

For a host that needs a public URL (Claude, ChatGPT), register the deployed
`https://<deployment>/api/mcp/public` as a custom connector; browser hosts that POST with an
`Origin` need that origin in `MCP_ALLOWED_ORIGINS`.

## MCP Apps host requirements (deferred)

v10r *rendering* third-party Views is a separate decision (agentic-architecture matrix: **Defer**).
What it would require, from SEP-1865 and the Inspector's implementation:

- **A sandbox origin** different from the app's origin (e.g. a dedicated subdomain), serving a
  small proxy page; the View runs in an inner iframe with `allow-scripts` and never
  `allow-same-origin` on the shared origin.
- **CSP built by the host** from the resource's `_meta.ui.csp`, defaulting to no network, and
  enforced before the View's bytes run; undeclared domains blocked.
- **Permission prompts** for any `permissions` a View requests (camera, microphone, geolocation,
  clipboard) and for `openLink`, `sendMessage` and `updateModelContext` — the View is untrusted.
- **Tool visibility**: hide `visibility: ["app"]` tools from the model and refuse app calls to
  model-only tools; route every app call through the same approval policy as the MCP client
  (`#lib/server/ai/mcp-client/`).
- A Svelte renderer over the framework-free `ext-apps/app-bridge` (AI SDK ships a React one only).

Trigger to revisit: a sandbox origin exists and a concrete third-party App is wanted.
