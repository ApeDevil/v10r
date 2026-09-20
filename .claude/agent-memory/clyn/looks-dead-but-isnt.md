# clyn memory — "looks dead but isn't" patterns (Velociraptor)

Stable rules only. Session findings live in the parent's ledger, not here.

## Cross-directory barrels hide consumers
- `src/lib/server/desk/index.ts` does `export * from '$lib/server/db/desk/{mutations,queries,theme-*,workspace-*}'`;
  `src/lib/server/preferences/index.ts` re-exports `db/preferences/mutations`. Routes import
  `$lib/server/desk` / `$lib/server/preferences`, so a grep scoped to `db/desk` reports every desk
  mutation as orphaned. Always follow `export * from` chains across directories before verdicts.
- `db/user/index.ts`, `db/preferences/index.ts` are `export *` barrels imported as
  `$lib/server/db/user` — importer grep must include the directory form, not only `/queries`.
- Shell gotcha: `grep "from '\$lib/..."` inside double quotes drops the `$`; use single quotes or
  Python, or the importer count silently reads 0.

## Exported-for-tests, invoked in-file (NOT dead)
- `abuse/config.ts assertProductionConfig` and `security/encryption-key.ts assertProductionConfig`
  both run at module load; the abuse one is exported only so `decision.test.ts` can inject inputs.
  Same-named, deliberately mirrored, different bodies.
- `security/subkey.ts resetSubkeyCache`, `resilience/breaker.ts resetBreakers`,
  `cache/tiered.ts clearLocalCache` are cache-reset seams. `resetBreakers` also has a runtime
  consumer (`ai/providers.ts:95`); the others are test/harness-only by design.
- `db/query-budget.ts` (`QUERY_BUDGETS`, `budgetedOperations`, `scoreQueryCensus`) and
  `db/query-census.ts` (`queryShape`, `observeQuery`, `MAX_OBSERVED_SHAPES`) exist for the
  N+1 gate `query-budget.gate.pglite.test.ts` — gate infrastructure, not residue.
- `security/csrf.ts CSRF_EXEMPT_PREFIXES` is read by `src/lib/api.gate.test.ts` + used in-file.

## Source-text gates make un-imported exports alive
- `hooks.server.ts` `export const securityHeaders` has zero importers; `handle-chain.gate.test.ts`
  reads hooks.server.ts as TEXT and asserts handler order by name. Do not flag.
- `pattern-library/registry.json` `code[]`/`tests[]` paths make files documentation-alive:
  `resilience/{breaker,bulkhead}.ts` + dir note for `retry.ts`/`shedding.ts`, `cache/*`,
  `http/{deadline,request-timing,guards,rate-limit,body}.ts`, `platform/after-response.ts`,
  `db/{query-budget,query-census}.ts`. Also mirrored byte-for-byte in
  `mcp/public-excerpts.snapshot.json` — deleting one fails `mcp:excerpts:check`.

## String-keyed / env-injected
- `security/subkey.ts SUBKEY_PURPOSES` values are strings; each purpose is reached via
  `SUBKEY_PURPOSES.<key>` (analyticsVisitor, analyticsConfirm, blogUploadTicket, pairingOwner).
- `platform/index.ts` reads `VERCEL`, `FLY_APP_NAME`, `RAILWAY_ENVIRONMENT` — platform-injected,
  absent from `.env.example` by design (documented in docs/blueprint/deployment.md env table).
- `auth/index.ts requireEnv('GITHUB_CLIENT_ID')` etc. — string-keyed env reads; grep for the
  literal, not `env.NAME`.

## Harness reachability
- `src/lib/server/perf/scenarios.ts` is consumed only by `scenarios.gate.test.ts`, which
  `scripts/perf/scenarios.ts` (package script `perf:scenarios`) spawns. Anything reachable only
  through it (`retryWithin`, `defineShedder`, `DEFAULT_NEEDS_MS`, `DEFAULT_SHED_ABOVE`) is
  lab-only, not production-path — report as MEDIUM "documented, unconsumed in prod", never HIGH.

## Knip blind spots here
- knip treats every `*.test.ts` as an entry, so test-only exports read as used. Own census needed.
- knip `ignoreExportsUsedInFile: true` hides in-file-only exported types; those are over-exports
  (LOW), not dead code.

## Server domains A (analytics…agents) — learned 2026-09-19
- `notifications/channels/index.ts` Map: `EmailChannel/TelegramChannel/DiscordChannel/WebPushChannel`
  have zero direct importers; reached via `getChannel('email'|'telegram'|'discord'|'push')`.
- `notif_push_${type}` is built in `send.ts sendPushNow`, but only for types with a `push<Type>`
  settings column (mention/comment/system/security). `notif_push_success`/`_follow` keys are
  template-shaped yet unreachable — check the settings schema before calling a template key alive.
- The ONLY runtime producer of `sendNotification` and the ONLY `EventSource('/api/notifications/stream')`
  subscriber are showcase pages (`showcases/notifications/{send,pipeline}`). Alive by showcase
  convention; do not report the pipeline as dead, but do say no product feature emits.
- `agents/index.ts` (`EXPECTED_AGENT_IDS`, `getAgentIds`) is a drift gate consumed only by
  `agents/index.test.ts` — its own header says so. `registry.ts`/`render.ts` carry the route.
- `import type { X } from '$lib/server/dbops'|'$lib/server/monitoring'` inside `.svelte` and
  `lib/state/*.svelte.ts` is legal (type-erased) — not a boundary violation, not a runtime edge.
- `docs/loader.ts` reads `$env/dynamic/public` `PUBLIC_DOCS_SOURCE_BASE`; public env vars can be
  absent from `.env.example` and still set on Vercel — report as MEDIUM, never HIGH.
- `desk/index.ts` is used by 5 `api/desk/{theme,workspaces}` routes; `api/desk/{files,folders}`
  bypass it and import `db/desk/*` directly. The arch gate scans only `src/lib/server/**` edges
  and tolerates domains without a barrel, so a facade is never gate-required.
- Job slugs live in 3 text places besides `jobs/index.ts`: `retention/schedule.ts` (gate),
  `architecture.gate.test.ts` known-edges list, `docs/blueprint/architecture/jobs.md` tree.
- Fast census: tokenize every code file once into a Counter, then look exports up by name
  (0.7 s for 22 domains) — regex-per-export over the tree takes >2 min.

## AI domain (`server/ai/**`, `types/ai*.ts`) — learned 2026-09-19
- `mcp/public-excerpts.snapshot.json` byte-mirrors ai files (navigation, project-docs, compact,
  deskbot-retrieval, desk-execute, providers, tools/index…). A tokenizer census over `mcp/` counts
  it as a "consumer" of every symbol in those files — exclude it or every in-file-only export
  reads as alive.
- Tool contract is a closed triangle: `TOOL_MANIFEST` (types/ai-tools.ts) ↔ factories under
  `ai/tools/*.ts` ↔ `ai_tool_<name>` in messages/{en,de,ru}.json, 17/17/17. `resolve_ref` is
  deliberately absent from the manifest (compaction infra). `tool-label.ts` hand-maps each
  message fn (tree-shaking), so `toolLabelKey` is consumed ONLY by `tool-label.gate.test.ts` —
  gate infra, not dead.
- `capabilities/chunk-place.ts` and `desk-scope.ts` are helpers, not capabilities; every
  `CapabilityId` (types/assistant-profile.ts) has one `id:` in a capability file.
- `createUIMessageStream` (ai SDK) catches sync AND async `execute` errors into its own
  `onError`; the orchestrator's outer `try/catch` (`tryFallback`, `createOnFinish`) sees only
  pre-stream throws (`saveMessages`, deskbot `composeTurn`). `_shared/streaming-turn.ts`
  header says so verbatim.
- Exported-for-tests, used in-file (NOT dead): `providers.ts resetCooldowns`,
  `tools/index.ts getToolRisk`+`allToolMeta`, `recorder.ts outlineHistory`/`TOOL_RESULT_CAP_CHARS`,
  `model-call-middleware.ts outlineCallOptions`/`toolDefinitionsOf`, `loop/compact.ts projectSummary`,
  `execute-proposal.ts receiptText`, `catalog-citations.ts normalizeCatalogPath`,
  `desk-plan.ts hasDestructiveIntent`, `chat-orchestrator.ts createOnFinish`.
  `showcases/ai/leak-gate.test.ts` greps the NAMES `COMPLETION_GUIDANCE|PLANNING_GUIDE|DATA_BOUNDARY_RULE`
  as text — they must stay exported under those names.
- `scripts/db/{ingest-docs,seed-silly}.ts` import `ai/connections.ts` by RELATIVE path
  (`../../src/lib/server/ai/connections`) — a `$lib/server/ai` grep misses them.
- Provider env keys are gone by design: `.env.example:74` says keys live in
  `ai.provider_connection`; zero `GROQ_API_KEY|OPENAI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY` in src.
- `pricing.ts`/`provider-limits.ts` are hand-maintained reference tables with deliberately
  zero runtime imports; `MODEL_PRICES`/`PROVIDER_LIMITS` are read in-file by `estimateCost`/
  `fitsTokenMinute` — over-exports, not dead.
- `getTurn` (db/ai/queries.ts) does `select()` on turn/model_call/tool_call → every column
  round-trips into `TurnTrace`; column-level "never read" questions reduce to which TurnTrace
  fields the inspector (`showcases/ai/inspector.ts`, `showcases/ai/_components/*.svelte`) renders.

## Retrieval / graph / hosted MCP — learned 2026-09-19
- `retrieve()` `onEvent` has ONE consumer: `showcases/cycle/ai-handlers.ts` (returns early on anything
  but `pipeline:step`, reads only step/status/detail/error). `pipeline:chunks`, `RetrievalPromptEvent`,
  step-event `phase/instanceKey/retriever/startOffsetMs`, `t0` param, tier `'skipped'` emits have NO
  reader. `docs/blueprint/ai/turn-trace.md` says `pipeline:*` events "are gone" — the code still emits.
- `/api/retrieval/*` routes have zero first-party clients; they are the documented multi-client-core
  API (`docs/system-abstraction.md:217`, registry `retrieval-endpoints`). Never flag the routes; DO flag
  the vocab only they would consume (`INGEST_STEPS`, `IngestStepState` have no reader anywhere).
- Tier 3 (graph) is reachable only via `/api/retrieval/search` body `tiers:[3]`; every in-app caller
  sends `[1]` or `[1,2]`. `layered-rag.md:17` documents it as dormant — MEDIUM, not HIGH.
- Neo4j write-only shapes: `HAS_CHILD{position}`, `NEXT_CHUNK`, `MENTIONS.confidence`, `RELATED_TO.type`
  PROPERTY (readers use the rel TYPE), `Chunk.level`, `:Resource`/`PART_OF` (db:catalog-sync) — zero
  Cypher readers in src/ or scripts/. `Chunk` nodes ARE needed (MENTIONS MATCH) — `batchCreateChunks` live.
- Hosted MCP exported test seams (documented, do not flag as dead): `noopMcpObserver`, `SNAPSHOT_PATHS`,
  `RULE_FIXTURES`, `COLOR_TOKEN_COUNT`, `extractBearer`, `isAllowedOrigin`, `protocolVersionHeaderOk`,
  `buildCallLogRow`, `parseTraceparent`, `scrubSecrets`, `adminStateRegistry` (prod uses
  `createAdminStateRegistry({...ADMIN_MCP_ACTOR, ip})`), `MAX_NEXT_ACTIONS`.
- MCP telemetry: rate-limit refusals deliberately write NO row (observer.ts doc) → any query on
  `outcome='rate_limited'` is permanently 0 (`getHealthSummary.rateLimitedGate`). `subject` column is
  written as literal `null`. `x-v10r-self` header has no in-repo sender — operator tooling by design.
- Snippet rules: all 10 ids carry fixtures INSIDE `mcp/snippet-rules.json`; a grep for a rule id
  outside the JSON is expected empty — check `fixtures[].expect` before calling a rule unreferenced.
- Bare-Bun leaves: `retrieval-shared/embed-config.ts`, `retrieval/plan.ts`, `markdown-split.ts`,
  `db/content-hash.ts`. `scripts/db/ingest-docs.ts:58-59` re-declares `SYSTEM_DOCS_USER_ID` /
  `PROJECT_DOCS_COLLECTION_ID` by documented choice (config.ts is `$lib`-aliased).
- `showcases/ai/retrieval/**/+page.ts` are 308 stubs with "remove after 2026-11" — registry URLs, alive.
- knip `--include exports,types` inside the container catches un-imported consts/types in
  `src/lib/types/*` that the plain `bun run knip` misses; 4 hits here matched the hand census exactly.

## Showcases / schemas / name-check — learned 2026-09-19
- The `grep` shell function is a ugrep wrapper that silently returns NOTHING for paths containing
  `[[locale=locale]]`; use `command grep -a` (some showcase pages also trip "binary file matches").
- knip false positive: a type imported ONLY as `import { type X }` from `.svelte` files reads as unused
  (the Svelte compiler drops type imports) — e.g. `ui/tables/_data/mock-data.ts SortKey/SortDirection`
  are consumed by 3 `_sections/*.svelte`. Confirm with a tokenizer census before trusting knip on types.
- Hub hrefs in `showcases/catalog/registry.ts` resolve via `+page.ts` redirect + `+layout.svelte`
  (23 of 120 hrefs have no `+page.svelte`) — not orphans. Sitemap and `docs-mapping.gate.test.ts`
  both derive from the catalog, so "on disk but not in catalog" == not in sitemap either.
- `showcases/ai/{chat,image-metadata,retrieval,retrieval/{explorer,ingest,rag-chat}}/+page.ts` are
  308 stubs "remove after 2026-11"; `pattern-library/registry.json` no longer contains ANY of those
  URLs (checked 09-19) — only external stale copies justify them now.
- `src/lib/showcases/ai/topology.ts` is consumed ONLY by the showcase route + `topology.drift.test.ts`;
  the admin AI tools page uses `components/admin/ai/ToolTopologyView.svelte` with its own data.
  `AI_EXTRA_EDGES` / `AI_TOPOLOGY_VERSION` have zero readers (the file header promises a footer that
  does not exist).
- `mcp/_components/VizDemoCard.svelte` is a documented byte-copy of `viz/_components/VizDemoCard.svelte`
  ("_components/ are private to the route subtree") — duplication by convention, not accident.
- `showcaseDomains`/`groupByDomain` are read in-file by `groupByDomain()` → `showcases/+page.svelte`;
  every `ShowcaseCard` field has a reader (icon → search adapter + home grid; breadcrumbLabel/ariaLabel
  → ShowcaseLayout + ui/+layout; docs → resolve-docs; children → showcases.ts/search adapter).
- `showcases/showcases.ts showcaseBreadcrumbs/getShowcaseTabs` have ONE consumer (`ui/+layout.svelte`);
  `ShowcaseLayout.svelte:28-33` re-implements both inline because `$lib` cannot import from routes.
- Name-check: `labels.ts nameCheckLabels()` calls every `m.showcase_name_check_*` explicitly (no
  template prefix); every enum value it labels has a server producer (`possibly`/`unrelated` come from
  `nice-classes.ts categoryRelevance`). `quota.ts resetLocalQuota` is a documented test seam;
  `credentialsForVendor`, `bigramDice`, `tokenJaccard`, `to*Drafts`, `euipoQueries`, `parseRdapBootstrap`,
  `rdapBaseFor`, `webSearchVendor` are exported-for-tests AND used in-file.
- Scope files byte-mirrored in `mcp/public-excerpts.snapshot.json`: name-check `check/connections/
  name-source/signal/similarity/sources/rdap`, `showcases/velocity/measurements`, `catalog/registry`,
  `docs-mapping.gate.test` (+ their tests). `src/lib/schemas/**` is NOT mirrored — type deletions there
  need no excerpt rebuild.
- Zero-consumer i18n census: exactly 9 `showcase_ai_*` keys (door_vely, door_note_unconfigured,
  orch_answer, example_lead, graph_tool_results_in, graph_retriever, graph_tools_n, graph_relations,
  graph_no_relations). `showcase_ai_graph_retriever` looks used only because it is a substring of
  `showcase_ai_graph_retrievers_ran` — grep with `\b` or exact JSON key.

## Routes / API handlers — learned 2026-09-19
- `src/routes/api/consent/` is a `+page.server.ts` (form actions `set`/`clear`) living under `/api/` — a
  `+server.ts`-only census misses it. `ConsentBanner.svelte` posts `/api/consent?/set`; withdrawal is
  recorded as `set` with tier `necessary` (action `'change'`), not via `clear`.
- Python `glob('**/[[locale=locale]]/**')` silently matches nothing (`[` = char class) — use `os.walk`.
- `docs/blueprint/api.md` "Endpoint Inventory" (~L1013-1025) + `docs/blueprint/auth.md` ~L660-672 +
  `docs/blueprint/data/neon-branch-refresh.md` ~L115-118 + `docs/stack/capabilities/gdpr.md` L11-26 +
  `docs/blueprint/name-check.md` L9 are what make REST doors "documented" when their only in-repo
  client is a sibling form action (admin grant-requests, admin user grants, blog comment moderation,
  db/ops, name-check, account DELETE, account/data GET, grant-requests). Multi-client core — never HIGH.
- Registry records with `code[]` api paths: architecture-hosted-mcp, app-shell-quick-search,
  admin-privacy-gdpr, ai-surfaces, deskbot-approval-gate, retrieval-endpoints (ingest+search ONLY),
  analytics-live-feed, jobs-scheduler, jobs-platform-scheduling, velocity-asset-delivery.
- Every `+page.server.ts` returns `title`; the ONLY reader is `[[locale=locale]]/+layout.svelte:173`
  `<title>{page.data.title …}` — never flag `title` as write-only.
- `LEAF_DELETE_ROUTES`/`MOVE_ROUTES`/`FOLDER_DELETE_URLS` in `desk/panels/explorer/explorer-actions.ts`
  are the URL→method maps for desk/blog CRUD; `strict:false` entries swallow non-2xx (a 405 from a
  missing method export looks like success). Check exported methods against these maps.
- `LiveFeed.svelte` polls `/api/admin/analytics/recent` and seeds `activeSessions`/`pairedSessions`
  to 0 — SSR values of the same name from `admin/analytics/human` load are not its source.
- Showcase-only API consumers (alive by convention): `/api/analytics/stream`, `/api/notifications/stream`,
  `/api/ai/images/[id]/analyze`, `/api/ai/conversations/[id]/turns/[messageId]`, `/api/ai/profiles/[surface]`,
  `/api/showcases/*`, `DELETE /api/style/palettes/[id]`, `PATCH /api/style/palettes/[id]` (CustomPaletteWorkshop).
- Service worker hard-codes `/offline` (prerendered, `src/routes/offline/+page.ts`), `/icons/icon-192.png`
  (static/icons), `/account/notifications`; `SKIP_WAITING` ← UpdatePrompt.svelte, `FLUSH` ← pwa/sign-out.ts.
- knip treats every `src/routes/**` file as an entry → it reports nothing about handlers or methods.

## Components (viz/primitives/layout/shell/3d/blog/admin/style/…) — learned 2026-09-19
- `viz/index.ts` exports every component straight from its `.svelte`; `viz/graph/index.ts` and
  `viz/plot/index.ts` are PARALLEL sub-barrels consumed only for types (`DagData`, `HeatMapData`, …),
  and `viz/graph/sankey/index.ts` is imported only by `viz/graph/index.ts`. Their component
  re-exports read as unconsumed — the components are alive via `viz/index.ts`; only the sub-barrel
  lines are redundant. Never call a viz component dead from a sub-barrel census.
- Chart.js registrations (`viz/_shared/register.ts`) are reached via
  `await import('../../_shared/register')` inside each chart `.svelte` — a static `from '…'` grep
  misses all six consumers.
- `const _data = data;` / `_orientation` / `_w` / `_cr` lines inside `$effect` (DagGraph, Sankey,
  TreeGraph, Treemap, HeatMap) are dependency reads, not unread consts.
- knip "unused file" for `primitives/pane/types.ts` and `viz/diagram/erd/types.ts` is the
  `import type` from `.svelte` blind spot (PaneGroup.svelte:5, ErdDiagram.svelte:3) — both alive.
- Shell nav items come from `$lib/nav/{nav,admin}.ts` (29 hrefs, all resolve), not from shell
  components; shortcut categories from `$lib/shortcuts/registry.ts` (all 4 registered).
- `calendar.ts` CVA `state` dimension: `Calendar.svelte:76,79` call `calendarCellVariants()` /
  `calendarDayVariants()` with NO args; today/outside styling is `:global([data-today])` CSS.
  Zero-arg cva() calls make whole variant dimensions dead — check call sites, not just keys.
- Props-passed census gotcha: a `<Tag …>` regex ending at `>` is cut short by `=>` inside
  arrow-function attributes (`onedit={(cp) => …}`) — callback props read as never-passed. Verify
  with a `-F "propName"` grep before reporting.
- Blog embed hydration (`blog/embeds/registry.ts`) covers ONLY `scene`; `content-syntax` also
  defines `callout|chart|video`. remark emits placeholders for all four, `hydrate-embeds.ts`
  silently skips unknown kinds — gap is functional, not residue in components/.
- Canvas-probe color resolvers exist 3×: `viz/_shared/theme-bridge.ts cssColorToRgb` (dead),
  `image-kit/_components/EmbedViz.svelte` local copy (live), `3d/css-color.ts resolveCssColor`
  (live, token→hex). A token census counts the EmbedViz local fn as a "consumer" of the dead one.

## Client lib (`state/styles/types/utils/i18n/nav/shortcuts/…`) — learned 2026-09-19
- The `grep` BINARY on PATH is ugrep 7.8 (not only a shell wrapper) — `command grep` does not escape it.
  ugrep returns nothing for `[[locale=locale]]` paths given as FILE ARGS unless quoted; `-rna` over `src`
  is fine. Prefer a Python tokenizer census; use grep only to confirm.
- The lead deletes concurrently during a sweep: 7 types vanished between census (13:47) and verification
  (13:53). Compare `stat -c %y` of the census file vs. sources and RE-RUN the census before the report;
  `git diff HEAD -- <file>` shows what was removed.
- `state/index.ts` re-exports `./notifications.svelte` (no `.ts`) — a relative resolver must map
  `x.svelte` → `x.svelte.ts` or every barrel-only `.svelte.ts` store reads as zero-importer.
- Token census is NOISY for `tokens.ts` (`colors`, `duration`, `layout`, `spacing`, `sidebar` are common
  words) — verify with `import {…} from '$lib/styles/tokens'` clauses. Real consumers: uno.config.ts (10
  keys), PageContainer (`layout`), TokensSection showcase (8 keys). `sidebar`/`duration` are showcase-only
  and duplicate `app.css:61-63` / `uno.config.ts:62-66`.
- Showcase-only client modules (alive by convention, no product caller): `state/optimistic.svelte.ts`
  (OptimisticDemo), `nav/preload.ts` (velocity PreloadTable/PreloadTiming; `preloadOnIdle` test-only),
  `i18n formatCurrency/formatPercent`, `state/session.svelte.ts getSession()` context getter,
  `errors ErrorCode.*` (4 codes rendered by showcases/i18n). Registry names `preloadOnIdle` in two notes.
- `theme.svelte.ts` `accent` is a legacy constant: `+layout.svelte:34` passes `'blue'`, `setAccent` and
  `get accent` have zero callers, `data-accent` has zero CSS selectors (theme-bridge only observes the
  attribute). The live accent system is `styles/random/accent.ts` (`deriveAccentTokens` ← hooks).
- `highContrast` user preference (db `user_preferences.high_contrast`, settings form) has NO consumer;
  `generateRandomStyle({highContrast})` is never passed and `Palette.highContrast` is read only there.
- Two disjoint error vocabularies: `lib/errors/codes.ts ErrorCode` (SCREAMING_CASE, 19) vs server
  `apiError(status, 'snake_case')`; `errorMessage()` falls back to INTERNAL for any wire code.
- Exported-for-tests, used in-file (NOT dead): `desk/formula.ts evaluateFormula/expandRange/parseLiteral`
  (via `createGridResolver`), `wasm/bench.ts summarize`, `analytics/collect-policy.ts stripLocalePrefix/
  LOCALE_SEGMENTS`, `3d/parts.ts SOFA_PARTS` (via `PART_EXPLORERS_BY_MODEL`), `styles/elevation.ts
  resolveLevel/ELEVATION_CEILING`, `state/*.svelte.ts create*State` factories (consumed by `set*Context`).
- `shortcuts/registry.ts` has NO static shortcut list — all registered at runtime in
  `[[locale=locale]]/+layout.svelte:93-155` (global/navigation) and `DeskShortcuts.svelte` (desk).
  Category `'actions'` has never had a registrant; `ShortcutsDialog.svelte:111` guards it with `length>0`.
- Analytics contract is closed: 6 `EVENT_SPECS` names ↔ 6 `push('action', …)` in `telemetry.ts`;
  `kind:'error'` IS emitted (uncaught/unhandled_rejection); timing `props.target` is read by
  `db/analytics/perf-queries.ts` + `aggregations.ts:496`.
- SW protocol: only string messages `'SKIP_WAITING'` (UpdatePrompt) and `'FLUSH'` (pwa/sign-out) — no
  `{type}` objects; a `postMessage({type` grep finds nothing and that is correct.
- No `$env` import anywhere in the client-lib scope dirs; `PUBLIC_*` hits in src are const names.

## Desk + composites components (`components/desk/**`, `components/composites/**`) — learned 2026-09-19
- Scratchpad `/tmp/claude-1000/.../scratchpad` is SHARED by concurrent agents; `census.py`/`census.json` got
  overwritten mid-session. Always write under a private subdir (`scratchpad/clyn<phase>/`).
- Desk state factories are exported but consumed ONLY in-file by their `set*Context` wrapper:
  `createDeskBus`, `createDockState` (also test), `createDeskSettings`, `createWorkspaceState`,
  `createPanelMenusState`, `createDockMobileState`. Over-exports, not dead. Same for `BUILT_IN_PRESETS`,
  `serializeExplorerContext`, `truncateToTokenBudget` (in-file callers).
- `$lib/components/desk` barrel re-exports 130 names; only 33 are ever imported THROUGH it — desk internals
  import each other by relative path. "Barrel-only" ≠ dead; check relative importers before any verdict.
- `Chatbot.svelte` has NO `<Chatbot` template usage anywhere: AppShell.svelte:55-59 loads it via
  `import('$lib/components/composites/chatbot')` + `<svelte:component>`. Composites barrel deliberately
  excludes `chatbot/` and `info-dialog/` (header comment) — direct-path imports only.
- Chat wire contract is `message-metadata` (`turnError`, `harness.{proposal,proposalError}`, `trace`,
  `catalogSources`), NOT `data-*` frames — a `'data-` grep finds nothing on either side and proves nothing.
- Server produces only 4 `DeskEffect` kinds (`desk:open_panel|refresh_file|refresh_explorer|tab_indicator`,
  grep `type: 'desk:` in `server/`); `notify|activate_panel|focus_panel|scroll_to` are handled client-side
  with no producer. `docs/blueprint/desk/README.md` bus table lists PUBLISHERS only, never subscribers.
- Svelte-parser false positives: `class: className` makes `class` look undestructured; `children` is
  implicit element content (a "never passed" census on `children` is always wrong); nested object types in
  `interface Props` leak member names (`workspace`, `typeStyles`, `id`, `name`…) as fake props;
  `_active/_range/_dirty/_saved` in `SpreadsheetPanel.svelte` `$effect` are dependency-tracking reads.
- knip type FPs here (consumed via `.svelte` `import type`): `SaveState`, `SpreadsheetState`,
  `SelectionBarAction`, `CommandGroup`, `ContextMenuItem`, `PaneDefinition`, `GalleryCardItem/Cta`,
  `InfoSection`, `ComponentDoc`, `CommandPaletteItem`. knip WAS right about `getTokenEstimate`,
  `EditorDocument` and every PascalCase `*Variants` type.
- `ChatPanel.svelte errorCopy` kinds `rate_limited`/`unauthorized` are synthesized client-side from HTTP
  status (desk-bot-session.svelte.ts:95-98); `limit_exceeded` comes from chat-orchestrator.ts:174 via
  `X-AI-Error-Kind`. All branches reachable despite not being `AiErrorKind` members.
- Showcase-only composites (alive by convention): `SelectionBar`, `ReorderablePaneLayout`, `Command`
  (only `showcases/ui/menus|splits`). `DESK_PANEL_TYPES` ↔ `panels/<type>/` ↔ `desk/+page.svelte` imports
  ↔ `IOLogSource` 5 kinds ↔ 13 `NodeCapability` grants ↔ formula regex/switch are all closed loops.

## Second pass, area A (ai/retrieval/graph/mcp/name-check) — learned 2026-09-19
- `name-check/errors.ts NameSourceError.retryAfterSeconds` LOOKS write-only (no `.retryAfterSeconds` reader
  by name in check.ts's status map) but `check.ts runSource` catch passes it to `breaker.trip(source.id,
  err.retryAfterSeconds)` — a positional read. Grep the constructor's third arg, not just the field name.
- `mcp/telemetry/outcome.ts inferOutcome` NEVER produces `tool_error` (no-diag isError → `unknown_tool`|`threw`);
  every doc (types.ts, hosted-mcp.md, diag.test.ts header, schema comment) claims it is a "coverage meter".
  The admin usage `uninstrumented` column is structurally 0 — a doc/code contradiction, not a data question.
- `ai/policy/governor.ts requiresApproval()` has ZERO callers (tools hard-code the sentinel; `showcases/ai/
  topology.ts:247` re-implements the predicate). It is registry `code[]` for `ai-tool-harness` and
  `deskbot-approval-gate`, and the ai-tool-harness note "requiresApproval(risk) + shouldRequirePlan" is stale
  (`shouldRequirePlan` lives in `capabilities/desk-plan.ts`). Registry membership ≠ a caller.
- `TurnItemDetail.svelte` renders ~100 `fact('…')` rows — nearly every TurnTrace field has a reader there,
  so field-level "never read" claims in `types/turn-trace.ts` must be checked against its `fact(` list
  first. Exceptions found: `ModelCallRequest.activeTools` (rendered, never produced), `CitationRecord.quote/
  answerStart/answerEnd` + `CitationMatch quote|provider_source` (documented "no producer yet" in
  turn-trace.md "Not recorded").
- `TurnSummary.modelCalls/toolExecutions` (two correlated COUNT subqueries per turn row in
  `db/ai/queries.ts listTurnSummaries`) have no client reader — chatbot-session reads
  activations/citations/cited/outcome, the inspector reads messageId/createdAt/outcome/surface.
- `ProviderQuota.tpm/tokensToday/sourceUrl/resetTimezone` are serialized by `admin/ai/+layout.server.ts`
  and mirrored in `QuotaPanel.svelte`'s local type, but no `p.<field>` render exists; `tokensToday` is the
  only consumer of the `tokens` SUM in `getProviderUsageToday`.
- `tools/desk-execute.ts DeskExecContext.actor` ("recorded for audit") is never read or persisted —
  `grep "\.actor\b"` across server/ai + db/ai + db/desk is empty.
- Cycle showcase (`server/showcases/cycle/ai-handlers.ts`) is STILL the one `retrieve()` `onEvent` consumer
  (a `pipeline:step` grep finds only the type + emitter because the consumer types the event, not the string).

## Server domains B (hooks, notifications, jobs, cache, monitoring, …) — learned 2026-09-19
- Scratchpad is wiped on session interruption; the census `census.json`/`q.py` must be rebuilt, so a
  second pass should re-run greps rather than trust earlier output. Keep helper scripts tiny.
- `hooks.server.ts` locals with ZERO readers outside hooks are still consumed IN hooks:
  `locals.queries` (requestTiming Server-Timing db_queries), `customPaletteColors/AccentOffset` (i18n
  handler `<style>` block). Count hooks-internal reads before calling a locals stamp write-only.
- `locals.consentTier ?? parseConsentTier(...)` / `locals.clientIp ?? getClientAddress()` in
  `analytics/collector.hook.ts` are unreachable in the chain (consentLoader/securityHeaders run first,
  `!building` guards) but `analytics.pglite.test.ts` calls the hook with `locals: {}` — harness-only.
- `createLimiter(prefix, max, window, 'closed')` string form sets `onTimeout`; `{ onError: 'open' }`
  object form appears in 3 routes. Both `LimiterOptions` members ARE set in prod.
- `db/query-budget.ts scoreQueryCensus().suspectedNPlusOne` (+ `SUSPECTED_N_PLUS_ONE_REPEATS`) has NO
  reader — not even the N+1 gate (`overBudget` only). Gate infra ≠ every field alive.
- `security/ticket.ts` `wrong_purpose` reason is unreachable through `signTicket` (purpose-derived
  subkey fails `bad_signature` first) — defense-in-depth, keep.
- `desk` theme `action: 'migrate'` (`migrateDeskTheme`) is a live localStorage→DB import on first
  authenticated desk load (`DockLayout.svelte`), not a finished migration.
- Privacy `PersonalDataReport` `basis/portable/schemaVersion/art15` are consumed by the JSON export
  (`api/account/data/export`), never by the Svelte page — grep the export route before calling them
  write-only. `docs/stack/capabilities/gdpr.md` cites a stale `REPORT_SCHEMA_VERSION` value.
- `Job` registry ↔ `vercel.json` crons: only `/api/cron/due` + `/api/cron/bot-ranges-refresh`;
  `standalone: true` is the one flag that excuses a job from the sweep. Scheduler/delivery-scheduler
  only arm on `platform.persistent` (dev container, Fly, Railway) — never on Vercel, by design.
- `retention/schedule.ts`: all 18 rule ids have a job consumer; `schedule.gate.test.ts` reads job
  sources as TEXT for `from '$lib/server/retention'` — do not suggest re-exporting through a barrel.
- `store/guards.ts SHOWCASE_PRIVATE_PREFIXES` includes `showcase/imagekit/` — producer is
  `showcases/image-kit/storage.ts IMAGEKIT_PREFIX`, not `store/`.

## Area C second pass (components/state/client-lib/app.css/uno) — learned 2026-09-19
- Named-snippet props (`header`, `footer`, `trigger`, `actions`, `skeleton`, `action`, `panelContent`,
  `row`, `content`) are passed as `{#snippet name()}` INSIDE the tag body, never as attributes — a
  props-passed census must grep `{#snippet <name>(` before calling a Snippet prop dead. `Card.header`
  has 250 such producers and zero attribute producers.
- xyflow node components (`FlowNode`, `StateNode`) receive `data`/`isConnectable` from `nodeTypes`
  registration, not from a parent tag; `SceneEmbed.descriptor` comes from `hydrate-embeds` + `embedRegistry`
  `mount()` — zero `<Tag` usages is expected for both.
- `Typography variant="h4"|"code"` reach the CVA only through `FontPreview.svelte` `{sample.variant}` —
  literal-value censuses miss data-driven variant props; check `{...}` values before flagging a CVA key.
- `--color-<x>` tokens can be alive ONLY via `tokens.ts` → UnoCSS utility (`bg-x`, `z-x`, `shadow-x`);
  a `var(--x)` grep is not enough — check the utility class too. `TokensSection.svelte` swatch lists
  every token by name and counts as a documentation consumer, not a functional one.
- `--chart-*` tokens are read by `theme-bridge.ts getCssVar('chart-bg')` (string key, no `--` prefix).
- `visual-viewport.svelte.ts` publishes `--keyboard-inset` + `data-keyboard`; only the data attribute
  has a CSS reader (`.fab-keyboard-hide`) — the inset var/getters are documented "rare JS consumer" seams.
- `getContext<ReturnType<typeof x>>(KEY)` nested generics break a `getContext<[^>]*>` regex — every
  `*_CTX` key in `state/*.svelte.ts` reads as NO-GET; they are all paired.
- `docs/blueprint/**` hrefs in `showcases/catalog/registry.ts` are validated by `docs-mapping.gate.test.ts`
  against the docs manifest, not the route tree — a route-directory resolver reports them all MISSING.
- retrieval `TierDetail`/`RankDetail` fields have no named reader: `CycleDetail.svelte:99` renders
  `JSON.stringify(stage.detail)` — generic consumption, not dead.

## Test layer (`*.test.ts`, `server/test/**`, gates) — learned 2026-09-19
- `podman exec v10r bunx vitest run <one>.pglite.test.ts` DOES run the `db` project's globalSetup
  (verified: "Pulling schema" once, zero `[createTestDb] no schema snapshot` warnings, also with
  `--project db`). `test/db.ts buildFromScratch` is therefore NOT the documented single-file path
  its header claims — it fires only under a config with no globalSetup.
- Export census over tests must strip comments first: a doc comment mentioning the name
  (`routeToChannels` in router.ts:25) reads as in-file usage and hides a test-only export.
- Gates that SELF-AUDIT their lists (a stale entry fails): naming (`allow` files + both duplicate
  maps), architecture (`expectRatchet` `fixed` branch), authz-coverage (`auditAllowlist` ×2),
  docs-mapping (`UNDOCUMENTED_SHOWCASES`), elevation-hardcode-guard (allowlist resolves), credits.
  NOT self-audited — check by hand: naming `RETIRED[].use` pointers, leak-gate `FORBIDDEN` symbol
  names (`betterAuthVersion`, `ADMIN_EMAIL` no longer exist anywhere), authz `GUARD_PATTERNS`
  regex alternatives (`assertImageKey` matches nothing), `EXPIRY_DRIVEN_SWEEPS` slugs.
- Deletion gates for retired names exist in THREE places: naming `RETIRED`, `brand-lock-removed.
  gate.test.ts FORBIDDEN`, `guard-contract.gate.test.ts:36` — same mechanism, report as L/ary.
- `retrieve()` `onEvent` sole consumer `showcases/cycle/ai-handlers.ts` branches on
  `active|done|error` only; `'skipped'` emits (index.ts:75) and `RetrievalStepStatus 'pending'`
  have no reader — `retrieval/index.test.ts 'unused tiers emitted as skipped'` is the only one.
- `CacheScope 'per-user'` has zero production `definePolicy` (8 policies, all `'shared'`); the
  owner-required branch of `cacheKey` is test-only but registry-documented ("refuses both scope
  mistakes") → MEDIUM/editorial, never HIGH.
- Injection seams that look test-only but are the design: `now`/`storageKey`/`registry`/`snap`/
  `leaseMs`/`durationMs`/`maxTurns` defaults, `createProposal.expiresInMs`, `deriveSubkey` env
  override (`ANALYTICS_VISITOR_SALT`), `createLimiter` string form (`per-email.ts:21 'closed'`).
- `vitest.setup.ts` mocks `$env/static/private`, but its only two importers are untested showcase
  `+page.server.ts` files; `$app/environment.version` is imported by nobody. Harmless, not dead-code.
- Fixture liveness reduces to type liveness: `showcases/ai/fixtures/*` are typed `InspectedTurn`;
  the only unread keys are `timings.{preStreamMs,embedMs,generateMs,finalize.*}` + `profileVersion`
  (ledger's TurnTimings item), plus JSON-schema keys inside tool definitions.
- `journey/+server.ts navigationType: v.optional` exists "so pre-field clients keep validating";
  the only client always sends `'spa'` — a compat shim, contrary to the no-backward-compat rule.
