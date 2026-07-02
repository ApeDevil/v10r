# clyn — v10r "looks dead but isn't" patterns

## Consumers my src/-scoped scans MISS (scan repo ROOT too)
- `uno.config.ts` imports `$lib/styles/tokens.ts` exports (`fontFamily`, `fontSize`, `iconSize`, `spacing`, `zIndex`, `fluidSpacing`, `fixedSpacing`). A token-scan limited to src/ will FALSE-POSITIVE these. Always grep repo root (uno/vite/svelte/drizzle/vitest .config.ts) as reference sources.
- `vitest.config.ts` references `src/lib/server/test/vitest.setup.ts` via `setupFiles` STRING (not an import) → module-graph reachability marks it dead. It's live.
- `src/params/locale.ts` = SvelteKit param matcher, referenced by route dir name `[[locale=locale]]`, never imported. Framework convention — never flag.

## Runtime-consumed exports (never flag as unused)
- `*Relations` consts in `db/schema/relations.ts` — consumed by Drizzle via `import * as relations` namespace (names never appear as tokens in consumers). knip already has `ignoreMembers: ['.*Relations$']`.
- `pgEnum()` / `pgSchema()` consts (e.g. `dbopsSchema`, `imageSchema`, all `*Enum`) — required by `db:push` even with no static importer. Used in-file to define columns (own_file>1, ext==0).

## Barrel bypass pattern (these ARE dead indirection, verified 2026-07-02)
- `db/*/index.ts` query barrels (`db/ai`, `db/rag`, `db/desk`, `db/brand`, `db/notifications`, `db/showcase`, `db/analytics`) re-export via `export *` but EVERY consumer imports the underlying file directly (`db/rag/queries`, etc). Zero barrel-path importers. `db/index.ts` only exports the client + `./schema`; it does NOT re-export these.
- `components/viz/chart/index.ts` and `viz/diagram/erd/index.ts`: parent `viz/index.ts` imports the individual `.svelte` files DIRECTLY (`./chart/area/AreaChart.svelte`), NOT via these sub-barrels. knip.config ignores them with an INACCURATE "consumed via parent re-export" comment — the barrels are actually dead.

## knip.config.ts drift (as of 2026-07-02) — stale ignore entries
- `src/lib/server/api/sse.ts` — file no longer exists.
- `src/lib/server/api/pagination.ts` — heavily imported (8+ routes); not untraceable.
- `src/lib/server/db/analytics/mutations.ts` — actively imported (`recordEvent`, `upsertSession`); not dormant.
- `src/lib/server/analytics/hook.ts` — marked "dormant" but IS imported by `hooks.server.ts` (`analyticsCollector`). Analytics is partially ACTIVE, not dormant.

## Dormant-but-planned (dead today, roadmap-referenced — flag LOW, don't propose delete)
- `llmwiki/verify.ts::markPagesStaleForChunks` — exists ahead of caller; `docs/blueprint/ai/rag-roadmap.md` explicitly says the sweep/nightly-drain caller isn't built yet.
- `db/analytics/graph-seed.ts::seedAnalyticsGraph`, `db/rag/setup.ts::ensureRagSchema` — dormant infra.

## Underscore-export convention
- `export const _grantKinds` in `+layout.server.ts` — leading `_` is SvelteKit's marker to allow a non-page-option export without a warning. Usually a test hook; if no test imports it, it's a leftover (LOW).

## Method notes
- Token-frequency dead-export detection: count whole-word identifier occurrences across ALL .ts/.svelte (incl tests). `ext==0` (name in no other file) = strong dead signal because even property access `x.foo` / `import type {foo}` leaves the token `foo` in the consumer. Only string-keyed dynamic access evades it. VERIFY survivors repo-wide incl root + docs.
- chat-orchestrator.ts: `orchestrateChatInner` is a ~1100-line single function (nesting ~12 tabs, ~117 branch tokens). Planned split into `_shared/chatbot/deskbot` per project memory — not yet done.
