# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velociraptor (v10r) is a full-stack **pattern library** — proven, high-performance SvelteKit patterns that an AI agent reads and adapts to a new project. Emulation, not cloning. It is simultaneously documentation, a test environment, and a reusable reference. Full goals: `docs/foundation/PRD.md`.

Showcase pages under `(public)/showcases/` are the primary test strategy for UI patterns: each page is documentation, feature test, and copy template at once. If the showcase works, the pattern is proven — and "proven" is a machine-checked `maturity` grade in `mcp/patterns.registry.json` (requires a linked test/showcase + `verifiedAt`; contradictions fail `mcp:validate`).

**No backward compatibility.** Active development, no production users. Never add migration shims, retired-ID filters, version upgrade paths, or deprecation layers — change the code directly.

## Commands

**Everything runs inside the `v10r` Podman container.** The host has only Podman — no `node_modules`, no runtime, no package manager. Never run `bun install` (or any package manager) on the host. Databases are remote (Neon, Neo4j Aura, Upstash), not containerized.

```bash
podman compose up -d                     # start container (name: v10r, port 5173)
podman exec v10r <command>               # run anything inside it
podman exec -it v10r bash                # shell in
```

### The gate

There is no CI pipeline (solo dev). `bun run validate` is the authority — typecheck + biome + tests + registry/i18n/content/quality checks:

```bash
podman exec v10r bun run validate
```

### Individual checks

```bash
podman exec v10r bun run check            # paraglide compile + svelte-kit sync + svelte-check (gated, scripts/quality/svelte-check-gate.ts)
podman exec v10r bun run test             # vitest run
podman exec v10r bun run lint             # biome check .
podman exec v10r bun run lint:fix         # biome check --write .
podman exec v10r bun run knip             # unused exports / dead code
```

### Running a single test

```bash
podman exec v10r bunx vitest run src/lib/server/mcp/http.test.ts     # one file
podman exec v10r bunx vitest run -t "rejects unauthenticated"        # by test name
podman exec v10r bunx vitest run src/lib/server/rag                  # by path prefix
```

Tests are co-located as `*.test.ts` (no `__tests__/` dir). Vitest runs in the **node** environment — `$effect` never fires, so Svelte 5 effects cannot be unit-tested here; test the state half and verify effects in the browser.

### Database

Postgres connection env var is `NEON_DATABASE_URL_PROD` (not `DATABASE_URL`).

```bash
podman exec v10r bun run db:push          # sync schema (PUSH-ONLY — no migrations dir)
podman exec v10r bun run db:setup         # full bootstrap: rag-pre → push → rag-post → neo4j → catalog-sync → seed → search-backfill
podman exec v10r bun run db:studio        # drizzle studio
podman exec v10r bun run db:ingest-docs   # ingest docs/**/*.md into the RAG corpus (manual, NOT in db:setup)
```

`drizzle-kit push` is interactive and re-prompts on TTY; it cannot be cleanly piped.

### Derived surfaces

Pattern-library pages, MCP excerpts, and the RAG index are **generated**. Never hand-edit `docs/pattern-library/`; rebuild instead:

```bash
podman exec v10r bun run refresh          # mcp:validate → patterns:build → mcp:excerpts:build → db:ingest-docs
```

### The `vr` CLI

`vr` is the host-side solo-dev dispatcher (`bin/vr`, logic in `scripts/`). Commands: `validate`/`v`, `refresh`/`ref`, `ship`/`s`, `dev`, `up`, `down`, `shell`. Reference: `docs/stack/ops/dev-cli.md`.

**CRITICAL — never run a `vr` command on your own initiative.** Run one *only* when the user explicitly names that specific command. This is non-negotiable for `vr ship`, which fast-forwards `main` and pushes — **pushing `main` deploys to production**. Do not infer authorization from a task that merely "would benefit" from validating or shipping. Prefer the `podman exec v10r` forms above for your own verification.

## Architecture

### Two spines

The whole system hangs off two structures. Read `docs/system-abstraction.md` (how it runs) and `docs/codebase-organization.md` (where code lives) before any structural or cross-cutting work.

**Composition root** — `src/hooks.server.ts` boots background modules via three module-load side effects (`agents`, `jobs/scheduler`, `jobs/delivery-scheduler`), then runs a `sequence()` of 14 `Handle` middlewares that populate a shared `event.locals` bus:

```
securityHeaders → bodySizeFloor → stripBaseLocalePrefix → docsMarkdown → loadStyle
→ i18n → authCaptchaGate → authHandler → csrfProtection → sessionPopulate
→ consentLoader → debugOwnerLoader → devRouteGuard → analyticsCollector
```

Order is load-bearing: `securityHeaders` must be first (auth pins `ipAddressHeaders: ['x-client-ip']`); `authCaptchaGate` must precede `authHandler` (which consumes the request body); `sessionPopulate` must follow `authHandler` (Better Auth's `svelteKitHandler` does not populate locals).

**Hexagonal multi-client core** — all business logic lives in framework-free `$lib/server/[domain]/` modules (~40 of them). Thin adapters wrap them per client type: `+page.server.ts` (form actions/loads), `+server.ts` (REST/SSE), `ai/tools/` (AI tool `execute`), `jobs/` (cron/scheduler). The same domain function serves all four.

### The four invariants

Violating these breaks cross-client reuse:

1. **No framework imports in domain modules.** No `@sveltejs/kit` or `$app/*` inside `$lib/server/[domain]/`. Narrow exceptions: the `dev`/`building` flags from `$app/environment` in six modules (`auth/step-up.ts`, `auth/revocation.ts`, `ai/budget.ts`, `agents/index.ts`, `jobs/scheduler.ts`, `jobs/delivery-scheduler.ts`), and two `Handle`-typed hook modules (`docs/markdown-hook.ts`, `analytics/hook.ts`).
2. **Date serialization happens in the adapter.** Domains return `Date` objects; the route or tool converts to ISO strings.
3. **`redirect` / `error` / `fail` / `message` only in adapters.** Domains return `null`, not `error(404)`. AI tools return `{ error: 'safe message' }` — they never throw.
4. **Domains call down, not across.** Cross-domain access goes through the other domain's `index.ts` barrel only — never into its internals.

### Import direction

- `$lib/server/` is server-only **by path** — SvelteKit refuses to bundle it client-side. No runtime guard needed. Never import it from a `.svelte` file or a universal `+page.ts`.
- `db/` is the sink: it imports no sibling domains. Everything flows toward it.
- The import graph is a DAG. Drizzle relations are centralized in `db/schema/relations.ts` for exactly this reason.

### Database layout

`src/lib/server/db/` holds two parallel trees: `schema/[namespace]/` (table definitions, grouped by *storage*) and `db/[domain]/{queries,mutations}.ts` (data access, grouped by *call site*). They are deliberately not 1:1.

Reads/writes split into `queries.ts` (no side effects) / `mutations.ts` (explicit intent), in one of two locations:

- **Dominant:** `db/[domain]/` — for incidental CRUD.
- **Named exceptions:** co-located in `[domain]/` when the query *is* the domain logic — `blog/`, `rawrag/`, `llmwiki/`.

**Push-only workflow.** No `drizzle/` migrations directory exists. Every `pgSchema()` and `pgEnum()` must be exported through `schema/index.ts` *and* listed in `drizzle.config.ts` `schemaFilter`, or `db:push` silently omits it.

### Components

Layer order (leaf → root): `primitives/` (wrap Bits UI) ← `composites/` ← `layout/` + `shell/` ← feature dirs (`blog/`, `chat/`, `editor/`, `viz/`, `3d/`, …). Feature dirs depend downward and **never import each other**.

**The barrel is a bundle-size boundary.** `$lib/components/index.ts` re-exports only `composites`, `layout`, `primitives`. Deliberately excluded and deep-import-only: `viz/` and `3d/` (Chart.js/Three.js), `shell/` (app-specific chrome), and `composites/chatbot` + `composites/info-dialog` (markdown sanitizer). Adding a heavy dependency to a barreled component is a bundle-size regression.

**Component-First Rule — never use a raw HTML element when a project component exists.** Raw `<button>`, `<input>`, `<select>`, `<textarea>` bypass the design system. Exceptions: `<input type="hidden">`, `<input type="checkbox">` inside table rows (native indeterminate), `<select>` binding numeric values (the Select component is string-only), and custom interactive regions needing specialized styling.

### Styling

- `src/app.css` — runtime CSS custom properties. **All color tokens live here**; never hardcode a color.
- `src/lib/styles/tokens.ts` — build-time tokens read by `uno.config.ts`. Custom spacing **replaces** the UnoCSS/Tailwind default scale, so keys do not mean what they mean in Tailwind.
- CVA files (`[name].ts`) define variants as DOM markers only; scoped CSS in the `.svelte` does the actual styling (UnoCSS cannot reliably extract complex classes from `.ts`).

Global CSS (`uno.css`, `app.css`, fonts) is imported once in the **root** `src/routes/+layout.svelte`, not the locale layout — a `+page@.svelte` layout reset sheds the locale layer and would otherwise render token-less.

### Routes

`src/routes/[[locale=locale]]/` is the localized tree (`(public)/`, `(dev)/`, `admin/`, `app/`, `auth/`, `desk/`, `pair/`); `src/routes/api/` is the parallel un-localized REST/SSE tree. Auth gates live in `+layout.server.ts` files, not route groups. Route-local private folders use a leading underscore (`_components/`, `_sections/`) — promote to `$lib/components/[layer]/` only when a second route needs them.

### Conventions

- Server `.ts`: kebab-case. Components: PascalCase `.svelte` in a kebab-case folder. Barrels: always `index.ts`.
- Svelte 5 runes only — no Svelte 4 stores. Reactive state files **must** use the `.svelte.ts` extension: app-wide in `src/lib/state/[concern].svelte.ts`, component-local co-located as `[component].state.svelte.ts`.
- Never name a prop `state` — it collides with the `$state` rune (`store_invalid_shape`).
- `src/lib/paraglide/` is generated and gitignored — never edit. Translation source of truth is `messages/*.json` (en/de/ru). Adding a new i18n key requires a dev-server restart; the running Vite process 500s on the unknown key until then.

### Comments

Comment the WHY, never the WHAT. Delete a comment that restates its next line.

- Present tense; one owner per fact, cross-referenced by path. No "previously…"/"used to…" outside a regression test, where the bug IS the reason.
- No banners or structural `<!-- -->` / `/* */` labels — group with blank lines; keep a label's words, drop its frame. A `##` heading in a docblock means it outgrew a comment.
- Keep: ordering constraints, upstream-bug workarounds, security invariants, "looks wrong, is deliberate", `svelte-ignore`/`biome-ignore` justifications, gate-test docstrings (invariant → motivating bug → `── Honest limits ──` → alternative to widening the allowlist).
- Don't edit casually: `@ts-expect-error`, `@unocss-include`, the `PATTERN-INDEX:START/END` anchors in the root `README.md`, comments in raw-text-gate files — most gates don't strip comments, so edits flip them either way.

## Documentation

Every docs directory has a `README.md` navigation hub with a topic table. **Read the directory README first, use its table to pick the file, then read the file. Never grep blindly through `docs/`.** Entry points: `docs/README.md`, then `docs/system-abstraction.md` and `docs/codebase-organization.md`.
