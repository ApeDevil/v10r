# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Stas is your human development partner** — this project's solo developer and the only human in the loop.

## Project

Velociraptor (v10r) is a full-stack **pattern library** — proven, high-performance SvelteKit patterns that an AI agent reads and adapts to a new project. Emulation, not cloning. It is simultaneously documentation, a test environment, and a reusable reference. Full goals: `docs/foundation/PRD.md`.

Showcase pages under `(public)/showcases/` are the primary test strategy for UI patterns: each page is documentation, feature test, and copy template at once. If the showcase works, the pattern is proven — and "proven" is a machine-checked `maturity` grade in `pattern-library/registry.json` (requires a linked test/showcase + `verifiedAt`; contradictions fail `patterns:validate`).

### Commands

**Everything runs inside the `v10r` Podman container.** The host has only Podman — no `node_modules`, no runtime, no package manager. Never run `bun install` (or any package manager) on the host. Databases are remote (Neon, Neo4j Aura, Upstash), not containerized.

```bash
podman compose up -d                     # start container (name: v10r, port 5173)
podman exec v10r <command>               # run anything inside it
podman exec -it v10r bash                # shell in
```

#### The gate

There is no CI pipeline (solo dev). `bun run validate` is the authority — typecheck + biome + tests + registry/i18n/content/quality checks:

```bash
podman exec v10r bun run validate
```

#### Individual checks

```bash
podman exec v10r bun run check            # paraglide compile + svelte-kit sync + svelte-check (gated, scripts/quality/svelte-check-gate.ts)
podman exec v10r bun run test             # vitest run
podman exec v10r bun run lint             # biome check .
podman exec v10r bun run lint:fix         # biome check --write .
podman exec v10r bun run knip             # unused exports / dead code
```

#### Running a single test

```bash
podman exec v10r bunx vitest run src/lib/server/mcp/http.test.ts     # one file
podman exec v10r bunx vitest run -t "rejects unauthenticated"        # by test name
podman exec v10r bunx vitest run src/lib/server/rag                  # by path prefix
```

Tests are co-located as `*.test.ts` (no `__tests__/` dir). Vitest runs in the **node** environment — `$effect` never fires, so Svelte 5 effects cannot be unit-tested here; test the state half and verify effects in the browser.

#### Database

Postgres connection env var is `NEON_DATABASE_URL_PROD` (not `DATABASE_URL`).

```bash
podman exec v10r bun run db:push          # sync schema (PUSH-ONLY — no migrations dir)
podman exec v10r bun run db:setup         # full bootstrap: rag-pre → push → rag-post → neo4j → catalog-sync → seed → search-backfill
podman exec v10r bun run db:studio        # drizzle studio
podman exec v10r bun run db:ingest-docs   # ingest docs/**/*.md into the RAG corpus (manual, NOT in db:setup)
```

`drizzle-kit push` is interactive and re-prompts on TTY; it cannot be cleanly piped.

#### Derived surfaces

Pattern-library pages, MCP excerpts, and the RAG index are **generated**. Never hand-edit `docs/pattern-library/`; rebuild instead:

```bash
podman exec v10r bun run refresh          # patterns:validate → patterns:build → mcp:excerpts:build → db:ingest-docs
```

### Architecture

#### Two spines

The whole system hangs off two structures. Read `docs/system-abstraction.md` (how it runs) and `docs/codebase-organization.md` (where code lives) before any structural or cross-cutting work.

**Composition root** — `src/hooks.server.ts` boots background modules via three module-load side effects (`agents`, `jobs/scheduler`, `jobs/delivery-scheduler`), then runs a `sequence()` of 14 `Handle` middlewares that populate a shared `event.locals` bus:

```
securityHeaders → bodySizeFloor → stripBaseLocalePrefix → docsMarkdown → loadStyle
→ i18n → authCaptchaGate → authHandler → csrfProtection → sessionPopulate
→ consentLoader → debugOwnerLoader → devRouteGuard → analyticsCollector
```

Order is load-bearing: `securityHeaders` must be first (auth pins `ipAddressHeaders: ['x-client-ip']`); `authCaptchaGate` must precede `authHandler` (which consumes the request body); `sessionPopulate` must follow `authHandler` (Better Auth's `svelteKitHandler` does not populate locals).

**Hexagonal multi-client core** — all business logic lives in framework-free `$lib/server/[domain]/` modules (~40 of them). Thin adapters wrap them per client type: `+page.server.ts` (form actions/loads), `+server.ts` (REST/SSE), `ai/tools/` (AI tool `execute`), `jobs/` (cron/scheduler). The same domain function serves all four.

#### The four invariants

Violating these breaks cross-client reuse. All four are executable — `src/lib/architecture.gate.test.ts` is the authority, and it ratchets: a new violation fails, and so does an allowance that no longer applies.

1. **No framework imports in domain modules.** If a module under `$lib/server/[domain]/` needs `@sveltejs/kit` or `$app/*`, it is an adapter: move it to `server/http/` (shared toolkit) or name it `*.adapter.ts` / `*.hook.ts` (domain-local). There is no exception list to maintain.
2. **Date serialization happens in the adapter.** Domains return `Date` objects; the route or tool converts to ISO strings.
3. **`redirect` / `error` / `fail` / `message` only in adapters.** Domains return `null`, not `error(404)`. AI tools return `{ error: 'safe message' }` — they never throw.
4. **Domains call down, not across.** Cross-domain access goes through the other domain's `index.ts` barrel only — never into its internals. `db/` and `server/http/` are shared sinks, reached by file.

#### Import direction

- `$lib/server/` is server-only **by path** — SvelteKit refuses to bundle it client-side. Never import it from a `.svelte` file or a universal `+page.ts`.
- `db/` is the sink: it imports no sibling domains. Everything flows toward it.
- A catalogue that two feature directories both need moves *down* a layer (`$lib/3d`, `$lib/desk`), never sideways.

#### Database layout

`src/lib/server/db/` holds two parallel trees: `schema/[namespace]/` (table definitions, grouped by *storage*) and `db/[domain]/{queries,mutations}.ts` (data access, grouped by *call site*). They are deliberately not 1:1.

Reads/writes split into `queries.ts` (no side effects) / `mutations.ts` (explicit intent), in one of two locations:

- **Dominant:** `db/[domain]/` — for incidental CRUD.
- **Named exceptions:** co-located in `[domain]/` when the query *is* the domain logic — `blog/`, `retrieval/`, `llmwiki/`.

**Showcase code is separated.** `$lib/server/showcases/[name]/` holds server code that exists only to demonstrate a pattern; deleting a showcase must never break anything outside it. Each showcase spans three like-named directories: `$lib/showcases/[name]/` (shared types), `components/showcases/[name]/` (UI), `server/showcases/[name]/` (server).

**The pattern library is the product.** `pattern-library/registry.json` + `schema.ts` live at the repo root, aliased as `$patterns`; `mcp/` (stdio) and `server/mcp/` (hosted HTTP) are transports over it.

**Policy belongs to its domain.** Every domain keeps its own constants in
`server/[domain]/config.ts` — there is no shared constants module, and re-introducing one
is the regression this replaced. A policy leaf is deep-imported by design (the gate exempts
`*/config.ts`): taking a constant through a barrel would drag that domain's whole
implementation graph with it.

**Retention is one schedule, not fourteen constants.** `server/retention/schedule.ts` names
every dataset that ages out, its window, what the sweep does and which job enforces it. The
cron sweeps read it, the public privacy page renders it, and `retention/schedule.gate.test.ts`
fails if a sweep hard-codes a window or names a job that does not exist.

**Push-only workflow.** No `drizzle/` migrations directory exists. Every `pgSchema()` must be exported through `schema/index.ts` *and* listed in `drizzle.config.ts` `schemaFilter`, or `db:push` silently omits it. Enums are declared as `<namespace>Schema.enum(...)` and travel with their namespace — there are no bare `pgEnum()` calls.

#### Components

Layer order (leaf → root): `primitives/` (wrap Bits UI) ← `composites/` ← `layout/` ← `shell/` + feature dirs (`blog/`, `desk/`, `viz/`, `3d/`, …). Feature dirs depend downward and **never import each other**: when two need the same component it moves *down* a layer.

**The barrel is a bundle-size boundary.** `$lib/components/index.ts` is the cheap surface; anything pulling a heavy or optional dependency (viz engines, Three.js, the markdown sanitizer) or app-specific chrome is deep-import-only. Adding a heavy dependency to a barreled component is a bundle-size regression. The exclusions are asserted in the architecture gate — the prose version of that list had drifted to naming two of fourteen.

**Component-First Rule — never use a raw HTML element when a project component exists.** Raw `<button>`, `<input>`, `<select>`, `<textarea>` bypass the design system. Exceptions: `<input type="hidden">`, `<input type="checkbox">` inside table rows (native indeterminate), `<select>` binding numeric values (the Select component is string-only), and custom interactive regions needing specialized styling.

#### Styling

- `src/app.css` — runtime CSS custom properties. **All color tokens live here**; never hardcode a color.
- `src/lib/styles/tokens.ts` — build-time tokens read by `uno.config.ts`. Custom spacing **replaces** the UnoCSS/Tailwind default scale, so keys do not mean what they mean in Tailwind.
- CVA files (`[name].ts`) define variants as DOM markers only; scoped CSS in the `.svelte` does the actual styling (UnoCSS cannot reliably extract complex classes from `.ts`).

Global CSS (`uno.css`, `app.css`, fonts) is imported once in the **root** `src/routes/+layout.svelte`, not the locale layout — a `+page@.svelte` layout reset sheds the locale layer and would otherwise render token-less.

#### Routes

`src/routes/[[locale=locale]]/` is the localized tree (`(public)/`, `(dev)/`, `admin/`, `account/`, `auth/`, `desk/`, `pair/`); `src/routes/api/` is the parallel un-localized REST/SSE tree. Auth gates live in `+layout.server.ts` files, not route groups. Route-local private folders use a leading underscore (`_components/`, `_sections/`) — promote to `$lib/components/[layer]/` only when a second route needs them.

#### Conventions

- Server `.ts`: kebab-case. Components: PascalCase `.svelte` in a kebab-case folder. Barrels: always `index.ts`.
- Svelte 5 runes only — no Svelte 4 stores. Reactive state files **must** use the `.svelte.ts` extension: app-wide in `src/lib/state/[concern].svelte.ts`, component-local co-located as `[component].state.svelte.ts`.
- Never name a prop `state` — it collides with the `$state` rune (`store_invalid_shape`).
- `src/lib/paraglide/` is generated and gitignored — never edit. Translation source of truth is `messages/*.json` (en/de/ru). Adding a new i18n key requires a dev-server restart; the running Vite process 500s on the unknown key until then.

### Documentation

Every docs directory has a `README.md` navigation hub with a topic table. **Read the directory README first, use its table to pick the file, then read the file. Never grep blindly through `docs/`.** Entry points: `docs/README.md`, then `docs/system-abstraction.md` and `docs/codebase-organization.md`.

## Behavior

### Dev flow

Source control is not your concern. Never commit, stage, or push on your own initiative — and never ask or offer to. The workflow: uncommitted changes in local source control are how Stas reviews your work and observes the implementation take shape; he commits and pushes himself once a feature works the way he imagined it, or better. Commit only when explicitly instructed. Read-only git (`status`, `diff`, `log`) for your own orientation is always fine.

### The `vr` CLI

`vr` (`bin/vr`, logic in `scripts/`) is Stas's personal host-side dispatcher — **every `vr` command is his alone; never run one**. Above all `vr ship`, which fast-forwards `main` and pushes — **pushing `main` deploys to production**. Reference: `docs/stack/ops/dev-cli.md`.

The prohibition is on the `vr` wrapper, not the work it dispatches: run the container commands directly and freely — `podman exec v10r bun run validate`, `bun run build`, `bun run db:push`, and everything else in the Commands section.

### No backward compatibility

Active development, no production users. Never add migration shims, retired-ID filters, version upgrade paths, or deprecation layers — change the code directly.

### Self-Expressive Project

The project itself should represent the system.

By looking at the codebase and database—their names, structure, boundaries, schemas, relationships, and constraints—a developer should be able to understand how the product works and how its concepts relate.

**Code should express intent; the codebase should express the system; the database should express the domain model.**

Documentation and comments are exceptions, not the primary explanation mechanism.

* **Self-Expressive Code:** Functions, types, and modules should communicate their purpose without explanatory comments.
* **System-Reflective Architecture:** The codebase structure should mirror the product and domain architecture.
* **Self-Expressive Data Model:** Tables, columns, relationships, and constraints should communicate their meaning directly.
* **System-Reflective Schema:** The database structure should mirror the domain model and its relationships.
* **Comments Explain Why:** Comments explain rationale, constraints, invariants, and non-obvious decisions—not what the code already says.
* **One Source of Truth:** A fact or rule should have one authoritative owner; reference it instead of duplicating it.

**Code expresses behavior. Structure expresses architecture. Schema expresses the domain. Constraints express the rules. Documentation explains the why.**

#### Naming Integrity
Follow One Name, One Concept. Never reuse the same canonical name for different concepts, and avoid multiple names for the same concept. Before adding a new important name, check the codebase and preserve existing canonical terminology.

`docs/naming.md` is the vocabulary itself — the canonical term per concept, the metaphors
already spoken for, and the names that cannot move. `src/lib/naming.gate.test.ts` fails on a
retired term, on a shouted acronym inside a mixed-case name (`AIError`), on an unnamespaced
i18n key, on a second declaration of a name that already exists, and on a file named for a
bucket rather than a responsibility (`service.ts`, `helpers.ts`, `utils.ts`, `constants.ts`,
`shared.ts`, `core.ts`, `handler.ts`, …). Read the doc before inventing a name; add to it when
you settle one.

### Acknowledgment

Optimize responses for signal over narration. End every substantive response with a final line prefixed **`TL;DR for Stas:`** — the outcome in one or two sentences, plus open issues if any. In a terminal the bottom of the response is what's on screen when output stops, so this is the scan-anchor. Skip it only when the whole response is already one or two sentences. Its presence also confirms this file is loaded and in effect.
