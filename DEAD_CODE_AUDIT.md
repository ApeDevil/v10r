# Dead-Code Reachability Audit — Ledger

Temporary operational state for a multi-context audit. **Read this first after any compaction.**
Then `git status --short`, then resume from "Next exact action". Plan of record:
`~/.claude/plans/temporal-knitting-walrus.md`. Started 2026-09-19 on branch `cleanUp` @ `a65f038d`.

## Objective

Every meaningful first-party implementation must have a demonstrable current purpose (execution
path, contract, framework/runtime/build responsibility, registered capability, or documented
reason). Anything that cannot after investigation is removed as a complete vertical slice.

## Rules of engagement (Stas's decisions, 2026-09-19)

- Lead does ALL deletions; sub-agents detect only. No commit/stage/stash/reset ever. Never `vr`.
- Dead schema tables: removed **in code**; Stas runs `db:push` (DROP) himself. List each here.
- Functionally dead subsystems: delete the full slice when proven; record here.
- Unreferenced design sources (`assets/`, `static/logo/original/`, `static/blender-assets/`) and
  `.archive/`: remove. Applied one-shot DB scripts: delete. Stale `src/` paths in docs: fix/remove.
- Gate: `podman exec v10r bun run validate`. After any export removal: deep knip re-run
  (`podman exec v10r bunx knip --include files,exports,types,dependencies,unlisted`) — validate
  misses a removed export imported by a `.svelte` via a relative path. After barrel/dep changes:
  `validate:build`. After registry-referenced/docs edits: `bun run refresh`.

## Execution roots & dynamic mechanisms (alive = reachable from one of these)

- `src/hooks.server.ts` (17-member sequence; `platform.persistent`-gated `await import()` of
  `jobs/scheduler` + `jobs/delivery-scheduler`), `hooks.client.ts`, `service-worker.ts` (→
  `pwa/sw-policy.ts`), `app.html`/`error.html`, `src/params/locale.ts`.
- Filesystem routes (`+page*`, `+server.ts`, `+layout*`, form `actions`, `entries`), `_components`/
  `_sections`/`_data` are private, imported normally. Showcase hub hrefs = `+page.ts` redirect +
  `+layout.svelte` (no `+page.svelte`) — not orphans.
- Jobs: `server/jobs/index.ts` `jobs` record (slug-keyed) ← `/api/cron/[job]`, `/api/cron/due`,
  schedulers; `vercel.json` crons (`/api/cron/bot-ranges-refresh` served by `[job]`).
- AI: `types/ai-tools.ts` `TOOL_MANIFEST` → `server/ai/profile/index.ts` `PROFILES[surface]` →
  capabilities → tool factories. `capabilities/chunk-place.ts`, `desk-scope.ts` = helpers.
  Template i18n keys: `ai_tool_${name}`, `notif_push_${type}`, `m[messageKey]` (notifications).
- MCP: `mcp/server.ts` stdio (`TOOLS`; reads `pattern-library/registry.json` by relative path),
  hosted `server/mcp/` (`PATTERN_TOOLS`, `ADMIN_STATE_TOOLS`) ← `/api/mcp/{public,private,admin}`.
- Notifications: `channels/index.ts` Map (`email|telegram|discord|push`), `stream.ts` SSE registry,
  `/api/webhooks/telegram`.
- Registries: showcase catalog `lib/showcases/catalog/registry.ts` (120 hrefs), nav
  `lib/nav/{nav,admin}.ts`, shortcuts runtime Map (locale layout + `DeskShortcuts.svelte`), desk
  panels `lib/desk/panels.ts` ↔ `components/desk/panels/<type>/`, analytics `EVENT_SPECS`,
  retention schedule (job slugs; gate), credits registry (gate ↔ package.json), docs manifest
  (`import.meta.glob('/docs/**/*.md')`), content-syntax directives, `.claude/agents/*.md` glob
  (`server/agents`), `/AGENTS.md` glob (showcases/ax), `import.meta.glob('/src/app.css')`
  (mcp snippet rules).
- Workers only via Vite `?worker` (`workers/image-analysis.worker`, `wasm/kernel-bench.worker`);
  `workers/palette.ts` reachable only through the worker graph. WASM kernel vendored
  (`src/lib/wasm/kernel`, hash gate). 3D models = string paths into `static/models/`.
- Drizzle walks `src/lib/server/db/schema/` as a directory (every file an entry); 16 `pgSchema`s
  gated by `schema-filter.gate.test.ts`. Push-only.
- Env: `$env/dynamic/private` everywhere; string-keyed reads: `requireEnv('GITHUB_CLIENT_ID')`
  etc. (`server/auth/index.ts`), `SUBKEY_PURPOSES` (`security/subkey.ts`), destructured
  `UPSTASH_*` (`monitoring/upstash.ts`). `NEON_DATABASE_URL_DEV` = documented spare.
- Scripts: package.json scripts + knip entries (`verify-tx-rollback`, `perf/db-explain`,
  `perf/vely-turn-tap.js`), `scripts/perf/{bundle,ttfb}.sh` documented in `scripts/perf/README.md`,
  `scripts/wasm/build.sh` (host), `scripts/vr/*.sh` ← `bin/vr` (repo-agnostic; prebuilt-deploy
  paths INTENTIONALLY DORMANT).
- Gate tests (22) are roots AND constraints: credits↔deps, schema-filter, naming (cites 2 rename
  scripts + deleted `docs/Ref-ToDo.md`), links, docs-mapping, brand-lock-removed, retention↔jobs,
  handle-chain, authz-coverage, tool-label, mcp boundary/next-actions/rules, kernel-manifest.
- Generated (never hand-edit): `src/lib/paraglide/` (ignored), `docs/pattern-library/`,
  `mcp/public-excerpts.snapshot.json`, `src/lib/wasm/kernel/`, `server/perf/snapshot.json`,
  README Pattern Index region.

## ⚠ Tooling hazard found 2026-09-19 (P6)
The shell `grep` is a ugrep wrapper with `-I` (skip binary). One source file contained a RAW NUL byte
inside a string literal (`image-metadata/+page.svelte:139`, `join('\x00')`) so every grep silently
skipped it; `MetadataApprovalDialog.svelte` was wrongly deleted, caught by the P6 detector, restored,
and the NUL replaced by `\u0000`. Full-tree scan (`command grep -qI ''` per file): that was the ONLY
binary-looking source file, and it references none of the other removed symbols. Rule: for
consumer checks use `command grep -a` or Python, never the wrapper alone.

## Detector gaps (audit supplies its own — scripts live in the session scratchpad
`/tmp/claude-1000/-home-ad-dev-velociraptor/<session>/scratchpad/`; re-create if lost)

- `i18n-unused.py`: 3,066 keys; 3 unreferenced exactly (`admin_ai_models_title`,
  `admin_ai_models_test_stale`, `admin_cache_inprocess_feature_flags`) + 9 `showcase_ai_*` keys
  with zero grep hits (door_vely, door_note_unconfigured, orch_answer, example_lead,
  graph_tool_results_in, graph_tools_n, graph_relations, graph_no_relations; graph_retriever=1 hit)
  → P8. `notif_push_*` are template-built (live).
- `stale-doc-paths.py`: 124 dead paths across 42 docs → P9 (`scratchpad/stale-doc-paths.txt`).
- `assets-unref.sh`: 12 unreferenced files (logo/original ×6, blender ×1, assets ×4;
  security.txt is convention) → P1.
- biome `noUnusedImports/Variables` OFF in `.svelte`; knip "unused files" wrong for `.ts` only
  `import type`d from `.svelte`.

## Phase plan / coverage

```
[✓] P0  setup & baseline
[✓] P1  scripts/ config deps assets .archive mcp/ pattern-library/
[✓] P2  hooks.server.ts, server/{http,platform,security,errors,cache,resilience,abuse,auth,db-client+queries}
[✓] P3  server/{analytics,notifications,jobs,retention,privacy,preferences,desk,blog,content,store,
        imagemeta,feedback,pairing,admin,dbops,neon,monitoring,style,search,docs,patterns,agents} 
[✓] P4a server/ai        [✓] P4b server/{retrieval,retrieval-shared,graph}
[✓] P4c server/mcp       [✓] P4d server/{showcases,name-check,schemas}
[✓] P5  routes/api/**, [[locale]]/{account,admin,auth,desk,pair}, root routes
[✓] P6  showcases: (public)/showcases/** + lib/showcases + components/showcases + server/showcases
        route tree + lib/showcases + server/showcases + schemas swept by the P4d detector (zero orphan files);
        [ ] components/showcases (P7)
[✓] P7  components (desk, composites, viz, primitives, layout, shell, 3d, blog, admin, style, docs, transparency, showcases)
[✓] P8  client lib (state styles types utils i18n nav shortcuts search analytics pwa workers wasm 3d desk credits errors feedback name-check docs content-syntax actions)
[✓] P9  tests & test infra (nothing dead: 28 subject-less tests are gates/guards/parity by design; 8 infra files all wired);
        docs & content (114 stale paths → 46 real-drift fixes; 68 remaining are inside explicitly bannered illustrative blueprints)
[✓] P10 schema & data — 76 tables / 704 columns / 50 enums censused (`scratchpad/schema-census.py`); 5 dead columns + 1 dead
        enum type + 5 dead enum values removed in code (DROP list below); audit/provenance write-only columns kept (listed)
[✓] P11 cross-system pass — deep knip 3/34/142 → 2/24/83 (both files + all 24 exports are wasm .d.ts or knip's
        `.svelte import type` blind spot); cascade removals below; all parked items resolved; i18n 0 unreferenced; env all read
[✓] P12 final verification — `validate` green, `validate:build` green (5 bundle ratchets in ceiling), `refresh`: pattern pages +
        excerpts rebuilt, `db:ingest-docs` 34/~45 changed docs re-embedded then Google embed DAILY quota exhausted (exit 1 —
        rerun pending, see Validation); final report delivered in chat; ledger KEPT for the `db:push` list + open questions
```

## Findings

### Confirmed Dead (deleted → see Deletions)
- P1: 6 one-shot DB scripts (all DDL verified applied on prod: `ai.model_call`, `retrieval.corpus_map`,
  schema `retrieval`, schema `personalization`, `dbops.operation`, enums in `auth.*`;
  `analytics.sessions.human_confirmed_at` backfilled = 89 rows). `scripts/notifications/tunnel-dev.sh`
  (registered a webhook at the WRONG path `/api/telegram/webhook`; only `.archive/` cited it).
  `.archive/` (personal notes). `assets/` ×4, `static/logo/original/` ×6, `static/blender-assets/`.
  `@typescript/native-preview` devDep. `NEON_DATABASE_URL_DEV` (self-declared "not read").
  knip `ignoreMembers: ['.*Relations$']` (no `relations()` exist). 5 stale `.vscode` folder badges.
- P1 batch 2: `content:push --all` (parsed, never read); `bundle.sh ROUTE_JS_FAIL_KB`; `mcp/protocol.ts`
  `ERR.INTERNAL` + `err()` unused `data` param; `Excerpt.totalLines`; 6 internal-only `export`s in
  `mcp/` de-exported; `ingest-docs --force` resume shim (completed hierarchical conversion — 271/283
  docs; the shim made `vr ref -f` a no-op); `setup-neo4j.ts` `DROP CONSTRAINT entity_name_unique`
  (verified absent on the live graph: only chunk_pgid_unique, entity_name_owner_unique, resource_id);
  `content:new --domain` (scaffolds into a dir push/check never read). Rename-residue text fixed in
  `pattern-library/{validate,schema}.ts`, `registry.json` (note + pattern-index record → pages +
  excerpts rebuilt), `search.ts`, `refresh.sh`, `pattern-mcp.md`; `cold-start.sh` now reads
  `budgets.json` (README claim was false); `db-explain.ts` run line used the container name, not the
  compose service.

### Probable dead — awaiting cross-check (ALL RESOLVED in P11)
- `components/viz/_shared/{ChartEmpty,ChartError,SvgTooltip}.svelte` — barrel-only (P7 viz). → DELETED in P7.
- `server/agents` — LIVE: `docs/programming/+page.server.ts` + `[slug]` route + `docs/markdown-urls.ts`
  import `registry.ts`/`render.ts`; the barrel went in P7 (`registry.drift.test.ts` holds the id list).
- Barrel over-exports: `neon` ×6, `content` ×3, `agents` ×2, `retention.retentionRule`,
  `monitoring.THRESHOLDS`, `graph.classifyError`, `store.SHOWCASE_PRIVATE_PREFIXES` (P3/P4b). → P11 census of all 34
  server barrels: 96 re-exports have no consumer outside their domain, but EVERY one is used inside it — the
  symbols are alive, only the barrel line is surplus. Left (public-surface convention); report recommendation.
- `server/mcp/demo/tools.ts` `adminStateRegistry` const — GONE (only a local const in `transport.test.ts` remains).
- 2026-08 audit leftovers to re-examine: "14 documented-but-unconsumed REST doors" (P5),
  `api/consent` `clear` action (P5). RESOLVED: `authDegraded` deleted (P2); quiet hours + digest ARE
  enforced (`send.ts:61,85`, `digest.ts`, job `notification-digest`); `desk:ask` IS wired
  (`BotToolsSection.svelte`, `profile/deskbot.ts`, `tools/desk-ask.ts`) so `desk-retrieval-sync` has a purpose.

### Uncertain (design-surface decisions — reported, not changed)
- Viz interaction props nobody passes: `KnowledgeGraph/NetworkGraph` highlight (`onNodeClick`,
  `highlightedNodeIds/EdgeKeys` + `isHighlightedEdge` logic), `ErdDiagram.highlight` dimming, `FlowDiagram.
  defaultEdgeOptions`, `Pane/PaneGroup/PaneResizer` callback forwards, `PageHeader.headerHeight` bindable (35
  parents, 0 binds). Pattern-library component API — uxy/Stas call whether to showcase or cut.
- `harness-types ProposalError`/`HarnessMetadata.proposalError`: written by the orchestrator, read by no client.
- `mcp` telemetry: `client_name/version`, `requested_protocol_version` now have NO reader after
  `getClientBreakdown` went (columns → P10).

### Uncertain (data-model decisions for Stas — reported, not changed)
- Neo4j write-only shapes: `HAS_CHILD{position}`, `NEXT_CHUNK`, `MENTIONS.confidence` (constant 0.8),
  `RELATED_TO.type` property, `Chunk.level`, and `:Resource`/`PART_OF` from `db:catalog-sync` — no Cypher
  reader names them (the graph explorer may traverse generically). Also `NEXT_CHUNK` chains interleave
  sections (positions restart per section) — moot while unread.
- `mcp.call_log` columns written but never queried: `subject` (always `null` literal), `served_protocol_
  version`, `client_name/version`, `trace_id` (whole `traceparent.ts` feeds only this), `toolCount`
  observation field. Forensic log columns — P10 decision.
- `TurnTimings.preStreamMs/embedMs/generateMs/firstTokenMs[]` + `turn.profile_version`: persisted in
  jsonb, read only by a console line. Field-level, not column-level.
- `DocumentSource 'catalog'` and `ChunkLevel 'sentence'`: enum values with no producer (P10).
- `PanelContextEntry.tokenEstimate/panelId` accepted by the deskbot request schema, never read server-side.
- Defect noted (not dead code): `scripts/db/seed-silly.ts EMBEDDING_OPTS` omits `taskType:
  'RETRIEVAL_DOCUMENT'` which `embed.ts` says degrades similarity. Soft-deleted documents' chunks stay
  retrievable unless `source` is passed (`source-scope.ts`).



- P10 write-only audit/provenance columns — KEPT (the table is the record; documented or self-explanatory
  accountability fields), listed so nobody re-audits them: `grant_request.resolved_at/resolved_by`,
  `grant.revoked_by`, `announcement_dismissals.acknowledged_at`, `pairing_codes.consumed_by_session_id`,
  `consent_events.tier_before/tier_after/ua_hash` (GDPR consent proof), `revision.translated_by`,
  `desk.file.origin_tool_call_id` (documented: blast-radius tracing), `agent_proposal.rejected_reason`,
  `image.ai_proposal.raw_proposal` (append-only AI run snapshot), `image.metadata.field_provenance` (doc: advisory
  audit only), `image.metadata.approved_by`, `dbops.operation.neon_op_statuses`, `mcp.call_log.rc_headers`
  (weakest two: `neon_op_statuses` and `rc_headers` are written on every run/call and displayed nowhere —
  a per-column decision for Stas, same class as the call_log columns above).
- `retrieval.embedding_model` table + `chunk.embedding_model_id` FK — no reader; header documents the
  purpose ("tracks which model produced each embedding for future migration support"); seeded by
  `setup-retrieval.ts`, written by ingest. INTENTIONALLY DORMANT provenance dimension — kept.
- Showcase `showcase.*` PG-types demo columns not rendered by the types page (`type_specimen.longitude`,
  `temporal_record.local_timestamp`, `document_vault.raw_json`, `audit_log.correlation_id`) — kept: the schema
  file is the teaching content (timestamp vs timestamptz, json vs jsonb, uuid default).
- Better Auth-owned columns with no in-repo reader (`passkey.transports`, `account.id_token`,
  `account.refresh_token_expires_at`) — framework contract, kept.

### Confirmed Live (non-obvious, so nobody re-litigates)
- `server/retrieval-shared` (dependency-free constants for bare-Bun scripts; 7 importers).
- `server/schemas` vs `lib/schemas`, `server/errors` vs `lib/errors`, `server/docs` vs `lib/docs`:
  intentional server/client splits.
- `capabilities/chunk-place.ts`, `capabilities/desk-scope.ts`: helpers, not orphan capabilities.
- `static/.well-known/security.txt` (RFC 9116 by convention). `NEON_DATABASE_URL_DEV` (documented).
- `uno.config.ts` safelist entries are deliberately undetectable dynamic classes — never "dead".
- `notification-delivery` registered as daily job AND driven by the 15 s scheduler — intentional.

### Intentional Dormancy
- Tier-3 graph retrieval (`tiers/graph.ts`, `graph/retrieval/queries.ts expandViaGraph`): reachable only
  via the documented `/api/retrieval/search` tier picklist (registry `retrieval-endpoints`); in-app callers
  use tiers [1] / [1,2]; `layered-rag.md` calls tier-3 dormant. Kept as documented API.
- `MCP_SELF_TRAFFIC_TOKEN` + `x-v10r-self` (operator tooling, `.env.example` documents it).
- `showcases/ai/retrieval/*/+page.ts` redirect stubs: self-dated "remove after 2026-11".
- `server/resilience/{retry,shedding}.ts` (`retryWithin`, `defineShedder`): no request-path consumer, but
  they are the code of the deep pattern record `resilience-policy` (registry + `docs/blueprint/velocity/
  runtime.md` + `retry.test.ts` + 3 scenario-harness rows in `scenarios.json`). The pattern library is the
  product → registered capability. Stas may override (delete = registry record edit + harness rows + docs).
- Test seams kept: `cache/singleflight.ts inFlightCount`, `security/subkey.ts resetSubkeyCache`,
  `cache/tiered.ts clearLocalCache`, `abuse/config.ts assertProductionConfig` (self-invokes),
  `query-census.ts` helpers (unit-tested internals of a live logger).
- `db/index.ts Database` ↔ `db/types.ts Database`: allowed duplicate (naming gate lists the reason).
- `scripts/vr/deploy.sh`, `lib.sh` prebuilt-deploy helpers: `vr` is repo-agnostic (Densho uses them).
- `mcp/smoke.ts`: manual diagnostic documented in `mcp/README.md` + `hosted-mcp.md`; not in `test:mcp`.
- `scripts/{db/verify-tx-rollback.ts,perf/{db-explain.ts,vely-turn-tap.js,bundle.sh,ttfb.sh}}`: documented
  manual probes (knip entries / `scripts/perf/README.md`). `content:check --strict/--json`,
  `content:push --json/--dry-run`: CLI affordances with a purpose.

### Duplication noted (NOT dead — for the final report's recommendations, no action)
- Hosted `src/lib/server/mcp/patterns/{search,tools}.ts` re-implements ~170 lines of `mcp/tools.ts`
  rendering (`topoSort`, `patternCard`, `refLines`, plan assembly) that `pattern-library/` could share via
  `$patterns`; snippet engine ×2 + color-token extraction ×3 (`mcp/snippet.ts`, `server/mcp/snippet/
  {engine,rules}.ts`, `scripts/quality/no-token-opacity.ts`); excerpt safety limits ×3; Neon `Pool`
  boilerplate ×7 in `scripts/`; Neo4j HTTP `cypher()` ×3. Parity test covers tool names only.

## Schema changes for Stas's next `db:push` (removed in code, DROP pending)
- ⚠ `db:push` BLOCKER FIXED (2026-09-19, after Stas's first attempt): drizzle-kit loads every TOP-LEVEL file of the
  schema directory as schema (non-recursive `readdirSync`), and `schema/schema-filter.gate.test.ts` imports vitest — vitest
  4's CommonJS entry throws "cannot be imported in a CommonJS module" where vitest 3's stub was silent. The gate test moved
  one level up to `src/lib/server/db/schema-filter.gate.test.ts` (header explains why; its paths are ROOT-relative, still
  passes). Verified with drizzle-kit's own loader: `bunx drizzle-kit export --dialect postgresql --schema ./src/lib/server/
  db/schema` now emits the DDL (323 CREATE statements) and shows every enum below without its removed values. Retry the push.
- ~~SECOND PASS: enum VALUE `mcp.mcp_call_outcome` −`tool_error`~~ REVERTED in the DB type (2026-09-19, push attempt 2
  failed with `operator does not exist: text = mcp.mcp_call_outcome`): drizzle-kit recreates an enum by swapping the
  column to `text`, and the `mcp_call_stage_outcome` CHECK cannot validate against enum-typed literals during the swap.
  The TS `McpOutcome` union, the `uninstrumented` bucket, the badge and the docs stay removed; the DB value is inert and
  commented as such in `schema/mcp/call-log.ts`. (The other four enum recreations have no CHECK on their column.)
  Push attempt 3 then failed on `text = notifications.delivery_status` — same mechanism, this time the 5 partial-index
  predicates (`WHERE status = 'pending'` …) + the column default. `skipped`/`retrying` RESTORED in the DB type (inert,
  commented; schema.md already said exactly this). `consent_action`/`chunk_level`/`document_source` have no predicate or
  default on their column and should recreate. `admin.system_config` DROP confirmed applied by attempt 2 (gone from the
  attempt-3 data-loss list).
  Push attempt 4 failed with Neon `could not extend file because project size limit (512 MB) has been exceeded`
  (code 53100): drizzle-kit's order is enum recreations FIRST, column drops after; `consent_action` recreated fine
  (verified: grant,change), then the `chunk_level` recreation = a full rewrite of `retrieval.chunk` (182 MB: 23 MB heap
  + 62 MB HNSW/other indexes + toast) against a project already at its storage cap. `sentence` RESTORED in the DB type
  (inert, commented in `schema/retrieval/chunk.ts`; the TS `ChunkLevel` stays paragraph|section). Read-only census
  2026-09-19: database 375 MB; `retrieval.chunk` 182 MB, `analytics.datacenter_ip_ranges` 157 MB (114 MB of it indexes
  on 302k rows); still present: the 11 audit columns, `discord_token_refresh_idx`, `desk_file_origin_tool_call_idx`,
  `image_metadata_status_idx`, `blog_post_cover_image_idx`, type `image_metadata_status`, `document_source.catalog`.
  Remaining push work is metadata-only (drops) plus the small `document` rewrite (656 kB) → should fit.
  ⚠ OPS, not audit: a project over Neon's size cap refuses ANY file extension — production INSERTs that need a new
  page (analytics events, bot_hits, mcp.call_log) may be failing with the same error right now. Check the Neon console
  (project storage incl. history retention) before anything else.
  ⚠ INCIDENT, push attempt 5 (≈21:10 CEST): the two `nullsNotDistinct` re-prompts were answered "Yes, truncate" →
  drizzle-kit ran `truncate table blog.{asset_folder,post_folder} cascade;` → blog.post (4), revision (34), asset (3),
  comment (3), post_asset emptied on prod. RECOVERED via Neon "Restore from history" on `production` to a point before
  the push (backup branch `production_old_…` kept). Attempt 6 after the restore: **applied cleanly** — verified against
  prod: blog.post 4 / revision 34 / asset 3 / comment 3 / folders 1+1 intact; 0 audit columns left; `admin.system_config`
  gone; all 4 audit indexes gone; type `image_metadata_status` gone; `consent_action` = grant,change; `document_source`
  without `catalog`; `chunk_level`/`delivery_status`/`mcp_call_outcome` keep their inert values (documented); both unique
  constraints present. **The db:push DROP list is DONE.** Rule for every future push: those two prompts are always "No".
  ⚠ drizzle-kit push is NOT transactional — attempt 2 stopped mid-run, so some DROPs may already be applied; the next
  push re-diffs from the database and only asks for what is left.
- SECOND PASS (2026-09-19): index `desk.file.desk_file_origin_tool_call_idx` — on the write-only provenance column
  `origin_tool_call_id` (kept in P10); the column is an untyped FK, nothing filters or joins on it, so the index served no
  query. Column stays; DROP INDEX on push.
- `personalization.user_preferences.high_contrast` — the settings toggle was stored and shown but applied
  nowhere (generator option never passed). ⚠ Alternative was wiring it (3 lines: pass `prefs.highContrast`
  into `generateRandomStyle`); deleted per the functionally-dead rule — say so if you'd rather have it wired.
- `admin.system_config` table (`schema/admin/system-config.ts` deleted) — prod held 2 rows
  (`feature.ai_chat=true`, `testkey=false`); nothing ever read them.
- `notifications.user_discord_accounts`: columns `access_token`, `refresh_token`, `token_expires_at`,
  `token_refresh_failed_at`, `tokens_refreshed_at` + partial index `discord_token_refresh_idx` —
  written by the callback/refresh job, read by nothing (DMs use the bot token).
- P10 (2026-09-19):
  - `blog.post.cover_image_id` (+ FK → blog.asset, + index `blog_post_cover_image_idx`) — no writer (the PATCH
    schema never accepted it, `updatePostMetadata` only typed it), no reader (no social card / RSS / listing uses
    it). blog.md's design table rows removed; changelog line says why. Every row is NULL today.
  - `retrieval.chunk.overlap_prev`, `overlap_next` — `default 0`, never written, never read.
  - `notifications.user_telegram_accounts.unlinked_at`, `notifications.user_discord_accounts.unlinked_at` — only
    ever written as NULL (on link); `deactivateAccount` sets `is_active=false` without stamping it and there is no
    unlink UI at all (product gap noted below). Every row is NULL.
  - `image.metadata.status` (+ partial index `image_metadata_status_idx`) and **TYPE `image.image_metadata_status`**
    — the only writer set `'approved'`; nothing read it; the doc's `draft → proposed → approved → rejected`
    lifecycle was never built (doc corrected: saving the form IS the approval).
  - Enum VALUE removals (Postgres cannot drop a value: drizzle-kit push recreates the type and re-casts the
    column; safe because no row ever carried these values — none had a producer):
    `notifications.delivery_status` −`skipped`, −`retrying` (schema.md already marked both UNUSED);
    `analytics.consent_action` −`withdraw` (mutation type is `'grant' | 'change'`; one test fixture moved to
    `change`); `retrieval.chunk_level` −`sentence` (plan.ts emits section/paragraph only; `ChunkLevel` unions +
    `LEVEL_LABELS` + i18n `showcase_ai_graph_level_sentence` ×3 followed); `retrieval.document_source` −`catalog`
    (no `document` row is ever inserted with it — the catalog corpus is the in-process ⌘K index; the admin
    pipeline diagram's catalog badge counted `source='catalog'` rows = always 0 → now `buildSearchIndex(locale).length`).

## Deletions done
- P7 + P8 (2026-09-19): COMPONENTS — `composites/citation/ConfirmationCard.svelte` chain (`requiresConfirmation`
  has zero producers; + barrel line, ChatMessage import/prop/branch); `desk-context.state getTokenEstimate` +
  derived + barrel; `panels/editor/types.ts EditorDocument`; `explorer.state updateLabel`; `WorkspaceZone`
  `Tooltip`/`collectLeaves` imports + `getPanelSummary`; `TreeNode` `MenuEntry` type import;
  `ErrorDisplay.context` prop (never read; dropped from 4 `+error.svelte` callers); desk effects never produced
  by the server (`desk:notify/activate_panel/focus_panel/scroll_to` union members + dispatcher cases + 4 tests)
  and dead bus channels (`ai:open_panel`, `ai:highlight`, `ai:notify`, `ai:scroll_to`, publish-only
  `files:select`, `spreadsheet:open`, `editor:save` + their publishes) + `DockLayout.onNotify` plumbing to the
  desk page toast; `desk-context.pure computePanelStatus` (stale duplicate with divergent vocabulary) + tests;
  `viz/_shared/theme-bridge cssColorToRgb`; `SceneEmbed handleError`; `Carousel` unused import; calendar cell/
  day `state` CVA dimensions (called with no args — now house-style empty markers); CVA keys nobody passes:
  typography `large|small|blockquote` (+ element map), accordion `filled`, simple-chart grid `dashed|dotted` /
  axis `medium|semibold` (+ `gridStyle`/`axisWeight` props + 2 type aliases), chart-container `video|wide`;
  content-syntax `chart`/`video` directives (parsed into placeholders nothing hydrates — authored content
  vanished silently) + `blog.md` examples; `VIRTUALIZE_ABOVE` comment truthfulness. CLIENT LIB — theme store
  legacy `accent` (`AccentColor`, `setAccent`, getter, `dataset.accent`, theme-bridge filter; layout passed a
  literal `'blue'`); HIGH-CONTRAST slice (settings switch + 2 i18n keys ×3, schema field, page.server mapping,
  DB column, generator option/branch, `Palette.highContrast` flag, auth fixture rows); store members with no
  callers (`session.markRevoked/get expiresAt/get user` + captured `user`, `notifications.setCount/increment`,
  `sidebar.openMobile`, `optimistic.pendingKeys`); `sitemap.xml escapeXml` → `escapeXmlAttr`; shortcut category
  `'actions'` (never registered) + dialog branch; `ErrorCode` registry trimmed 19 → 5 (14 codes + resolvers +
  14 `errors_*` keys ×3; header corrected: these were never the REST wire codes); `desk/+layout.server.ts
  _grantKinds` tree-shaking hack; `collect-policy isUserLanePath` (test-only wrapper); dead single-decl types
  `SyntaxName`, `StackLayer`, `FeedbackSubmissionInput/Output`, `BotHitRow`, `SearchEngine`, `AccentTokenKey`,
  `NotificationChannel`. Corrections after gate: `errors_auth_session_expired` restored (direct `m.` consumers in
  ChatThread/ChatPanel — my key census covered only 3 of 14 names; lesson: census EVERY key you drop);
  `optimistic.pendingKeys` restored (test-covered API of a registry-referenced pattern, same class as `temporaryId`).
- P5 + P4d/P6a (2026-09-19): routes — `api/admin/ai/health` (zero refs), `POST /api/ai/conversations` +
  `CreateConversationSchema` + test (zero callers; also skipped `surface`), `api/consent` `clear` action
  (no submitter; `consent-mutations` action type narrowed; enum value `withdraw` now producer-less → P10),
  `desk/+layout.server.ts` `governorConfig`/`resolveGovernorConfig`/`DeskGovernorConfig` (zero readers),
  six uncalled GET verbs (`desk/workspaces`, `desk/folders/[id]`, `blog/asset-folders/[id]`, `blog/post-folders/
  [id]`, `blog/assets/[id]`, `admin/analytics/pair`) + `pairing/codes.ts getActivePairings`/`ActivePairing`;
  write-only load fields: `admin/analytics/human` `activeSessions`/`pairedSessions` (2 DB calls per load),
  `admin/mcp/usage` `clients` + `telemetry/queries.ts getClientBreakdown`, `admin/ai` layout
  `settingsUnavailable`, `admin/ai/models` `defaultProviderId`, `admin/mcp` `colors`/`maxMessageLength`,
  preview `toc`, perf `days`, account notifications `page`/`pageSize`, account security `createdAt`/`userAgent`
  (raw UA no longer shipped), desk action `requested`. Schemas — 39 never-referenced `Infer*` type aliases across
  `src/lib/schemas/**` + `showcases/auth/fixture.ts AuthFixture`, `registry-viz.ts PatternRow`, `image-kit.ts
  ImageKitUploadResult`; `showcases/ai/topology.ts AI_EXTRA_EDGES`/`AI_TOPOLOGY_VERSION` (header promised a footer
  + tests that never existed). i18n: 9 `showcase_ai_*` keys ×3. Components (early P7): `viz/_shared/{ChartEmpty,
  ChartError,SvgTooltip}.svelte` (barrel-only) + barrel lines. `image-metadata/+page.svelte` raw NUL → `\u0000`.
- P4a/b/c (2026-09-19): `chat-orchestrator.ts tryFallback` + `createOnFinish` (superseded by
  `streaming-turn.ts` rotation; outer catch unreachable for provider errors — chatbot composes inside
  the stream, desk profile has no embed lane) + outer catch simplified (no cooldown on non-provider
  throws) + 4 tests; `tools/index.ts allToolMeta/getToolRisk` (test-only) + 2 tests; `types/
  ingest-pipeline.ts INGEST_STEPS/IngestStepState`; `types/retrieval-trace.ts` RETRIEVAL_STEPS/
  RetrievalTraceStep/RetrievalStepDescriptor/RetrievalEngine/RetrieverKind/RetrievalPhase/PHASE_OF/
  RETRIEVER_OF/ChunkDisposition/ChunkSummary/RetrievalChunksEvent/RetrievalPromptEvent/GenerateDetail/
  CatalogDetail + step ids `generate|system-docs|catalog` (never emitted; only consumer = cycle showcase
  reading step/status/detail/error); `retrieval/index.ts` `pipeline:chunks` block + `toSummary` + `t0`/
  `startOffsetMs` plumbing + barrel re-export of `OVERFETCH_MULTIPLIER/RRF_K`; `RetrievalOptions.fusion`
  (never read); `RetrievalErrorKind` trimmed to `embedding|ingestion` (the only kinds thrown) + status map;
  `graph/index.ts` barrel `classifyError` (in-file only); `graph/retrieval/queries.ts` constant `labels`;
  `retrieval/queries.ts RawChunkRow.level` (selected, never read); `mcp/telemetry` `rateLimitedGate`
  metric + `rate_limited` gate reason (never produced — limiter rejects before telemetry);
  `db/retrieval/admin-queries.ts getChunkCoverage().byLevel` (never rendered); `mcp/demo/tools.ts
  adminStateRegistry` const (test-only; tests build one). Naming gate `PIPELINE_REGISTRY` pointer
  repointed. Comments: streaming-turn "rag-demo"/"three branches", validation "three schemas", ingest
  emit "Hash content", snippet rules "480 tokens".
- P3 (2026-09-19): FEATURE-FLAG SLICE — `server/admin/flags.ts`, `routes/[[locale]]/admin/flags/{+page.svelte,
  +page.server.ts}`, `schemas/admin/flags.ts`, `schema/admin/system-config.ts` (+2 barrel lines), nav entries
  ×2, showcase admin card, 18 i18n keys ×3 locales (+ `admin_cache_inprocess_feature_flags`,
  `admin_ai_models_title`, `admin_ai_models_test_stale` from the P0 detector), registry record
  `admin-privacy-audit-log` retitled, `state.md`/`gdpr.md` rows. DISCORD TOKEN LOOP — job
  `discord-token-refresh` (+ registry + gate edge + jobs.md), `channels/discord.ts refreshDiscordTokens`,
  callback token encryption/storage, 5 schema columns + index, `channels.md`/`discord.md` rewritten to the
  bot-token model. `notif_push_success`/`notif_push_follow` ×3 (no push column for those types). Dead types
  `blog PostDetail`, `imagemeta ConfidenceMap`, `content Glossary/GlossaryTerm`. `admin/audit.ts
  exportAuditLogCsv` (test now buffers `streamAuditLogCsv`). `server/agents/index.ts` (second glob + list)
  → drift list moved into `registry.drift.test.ts`. DOCS "VIEW SOURCE": `docs/loader.ts docsSourceUrl`
  (`PUBLIC_DOCS_SOURCE_BASE` set nowhere incl. prod — verified 3 pages), `DocPage.svelte` prop/link/CSS,
  5 route pairs. Showcase pipeline SSE `read`/`read-all` listeners (server emits only `init`/`new`).
  Text: router "Phase 3/4" comments, `notif_feedback_received` examples, cron cadence in
  `blueprint/README.md`/`neon-branch-refresh.md`/retention showcase copy, architecture-gate barrel list.
- P2 (2026-09-19): `authDegraded` write-only flag (hooks ×2, `app.d.ts`, `system-abstraction.md` row);
  `db/analytics/aggregations.ts getWebVitals` + `types.ts VitalSummary` + 3 `InferSelectModel` aliases
  (`AnalyticsEvent/AnalyticsSession/DailyPageStat`; `naming.md` row reworded); `cache/tiered.ts dropTiered`
  (+ barrel); `auth/index.ts` `Auth` type; TEST-ONLY fns + describe blocks: `db/ai/mutations.ts
  updateConversationTitle`, `db/desk/queries.ts countFolderContents` (+ `query-budget.ts` row + gate-test
  row + `velocity/data.md` row) and `getAiContextFiles`, `db/notifications/queries.ts getNotificationById`
  (`multi-client-core.md` example renamed to `getFolder`; `desk/spreadsheet.md` list trimmed); de-exported
  `MAX_DOCUMENTS_PER_USER`, `SUSPECTED_N_PLUS_ONE_REPEATS`, `IDLE_GAP_BUCKETS`. Excerpt snapshot rebuilt.
  Duplication noted (not dead): 3 constant-time compares (`http/cron-guard.ts safeEqual` is the weaker
  length-leaking variant vs `mcp/auth.ts`, `mcp/telemetry/self-traffic.ts`); `rowsOf` re-implemented in
  `monitoring/neon.ts`; `http/client-ip.ts getClientIp` wrapper bypassed by 28 direct `locals.clientIp` reads.
- P1 batch 1 (2026-09-19): `scripts/db/{rename-conversation-step,rename-llmwiki-page,rename-rag-schema,
  rename-naming-refactor,fix-auth-enum-schema,analytics-confirmation-backfill}.ts` (727 LOC),
  `scripts/notifications/tunnel-dev.sh`, `.archive/{COMMANDS,LAST-RUN}.md`, `assets/**` (4 PNG),
  `static/logo/original/` (6), `static/blender-assets/v10r-001.blend`; package.json: 5 `db:rename-*`/
  `db:fix-auth-enums` scripts + `@typescript/native-preview` (bun.lock refreshed via `bun install` in
  container); knip `ignoreMembers`; `.env.example` NEON_DATABASE_URL_DEV + webhook path fixed to
  `/api/webhooks/telegram`; `mcp/tools.ts` error text → `pattern-library/registry.json`;
  `naming.gate.test.ts` citations of deleted scripts/Ref-ToDo dropped (retired terms kept);
  `docs/naming.md` Ref-ToDo → drizzle-workflow.md; `docs/blueprint/ai/turn-trace.md` status note;
  `docs/blueprint/data/drizzle-workflow.md` +1 pitfall row; `docs/blueprint/deployment.md` −1 env row;
  `.vscode/settings.json` −5 dead badges.

- P9 (2026-09-19): **`state/notifications.svelte.ts`** slice — the unread-count context nobody read
  (`unreadCount` getter had zero readers; `decrementBy` mutated it after every mark-read; `account/+layout.server.ts`
  ran `getUnreadCount` on EVERY account navigation to seed it). Removed: the store + `$lib/state` barrel line,
  `setNotificationContext` in `account/+layout.svelte`, the layout's `getUnreadCount` fetch/`depends`/`unreadCount`
  return. `depends('app:notifications')` MOVED into `account/notifications/+page.server.ts` — the page's two
  `invalidate('app:notifications')` calls previously re-ran only the dead layout fetch, so the list never refreshed
  after mark-read (functional fix that fell out of the slice; nothing else changed). Pattern registry
  `notifications-sse-stream`: code path → `api/notifications/stream/+server.ts`, summary/keywords corrected (the
  serverless transport is Redis pub/sub, not invalidate()-polling); `patterns:build` + excerpts rebuilt.
  **`GET /api/admin/ai/quota`** — zero callers (QuotaPanel is fed by the admin/ai layout load; the "live poll" the
  route's header describes was never written; sibling `api/admin/ai/health` went in P5). Route dir removed,
  `ai/quota.ts` header + `provider-routing.md` + `ai/README.md` corrected.
  **`docs/handoff.md`** — 2026-09-13 proposal, implemented (memory: chatbot showcase turn graph), not in any hub,
  top-level docs are dropped by the docs section gate; status line "no UI changes made" was false.
  **`doc-filter.ts` BLOCKLIST `docs/codex-review.md`** — file no longer exists (the entry's own comment warns
  about exactly this drift).
  Docs (real drift, 46 fixes across 30 files): app-shell/notifications.md rewritten around what ships (no
  sidebar bell/SSE consumer — `SidebarNotifications` was deleted 2026-08-10, doc still taught it; polling fallback
  section dropped; Components/Data Loading rewritten); shell-state.md (notification-badge section removed,
  theme block synced to the accent-less module, `(app)` layout paths → real files, session section → AppShell
  `setSessionContext`, diagrams); keyboard-shortcuts.md (`handler.ts`→`keyboard.ts`, `ShortcutsModal`→
  `ShortcutsDialog`); session-lifecycle.md (`SessionExpiryModal`→`SessionExpiryDialog`); persistent-chatbot,
  layered-rag, image-metadata, image-kit ×2, visual-identity-architecture, naming.md ×5, auth.md ×8 (incl. the
  `[id]` in grant-request approve/deny), multi-client-core ×2, error-handling (banner + 4), api.md (banner + 7 +
  Endpoint Inventory verbs: `GET/PATCH posts/[id]`, `POST revisions`, `PUT tags|domain`, `GET export`;
  `PUT /api/desk/files/[id]`), pages.md, i18n.md, state.md ×5, progressive-revelation (root layout path),
  graph.md (banner), page-header, user-account (banner), settings.md (banner ×2 incl. `user_preferences` reality),
  ai-assistant, polyglot-freshness (banner), rag-roadmap + knowledge-base (link to deleted `ai-ref-plan.md` →
  plain text), harness-lens ×2 + provider-routing (`tryFallback` → `_shared/streaming-turn.ts`), r2.md (no
  "feature flags"), system-abstraction route table (no `flags`, `+name-check`, desk `files`, retrieval doors
  named), notifications/settings.md (telegram `connect`, not `status`), blog.md ×3 (real `/api/blog/posts/...`
  routes; `scripts/blog-import.ts` never existed → the shipped import door), content/README.md preview path.
  Convention used: where a snippet's path never existed and no shipped equivalent exists, the header comment
  became `// Illustrative — <where the shipped equivalent lives>`; docs whose whole body is a design template
  got one `> **Illustrative …**` banner (api, error-handling, polyglot-freshness) — same form relational.md,
  deployment.md, graph.md, graph-rag.md already used.
  NOT deleted (INTENTIONALLY DORMANT, evidence): the "dead feature sections" named in the plan — GraphQL
  (api.md:769 banner), progressive revelation (doc banner "planned — not yet built" + retrieval-corpus block),
  graph-RAG langchain (graph-rag.md:113 banner), TOON, desk-integration v4 record, blog slash-commands — were
  NEVER in git history (`git log --diff-filter=D` finds nothing for any of their paths; no `graphql`/`langchain`/
  `@toon-format` dep ever in package.json). They are labelled design blueprints of a pattern library, not
  descriptions of removed code; deleting them is an editorial call for Stas, not a dead-code verdict.

- P10 (2026-09-19): schema — see the DROP list: `post.coverImageId` (+ `updatePostMetadata` field, `asset`
  import, index), `chunk.overlapPrev/Next`, `unlinkedAt` ×2 (+ two `unlinkedAt: null` writes),
  `imageMetadataStatusEnum` + `status` column + index (+ `status: 'approved'` write), enum values
  `skipped`/`retrying` (+ admin-queries union, notifications/schema.md ×2), `withdraw` (+ test fixture),
  `sentence` (+ `ChunkLevel`, `retrieval/types.ts`, `ingest/index.ts`, `LEVEL_LABELS`, i18n ×3), `catalog`
  (+ `DocumentSource`, `Exclude<>`, `queries.ts` union, admin-queries comment, admin retrieval loader/page).
  Tests: 28 subject-less test files all by design (gates/guards/parity/`page.server.test.ts` naming); test infra
  (`test/db.ts` 159 importers, `fixtures.ts` 7/7 exports used, setup files wired in `vitest.config.ts`, 3 AI
  showcase fixtures 4–5 importers each) — nothing dead.

- P11 (2026-09-19): cascade + knip-surfaced dead exports — 46 barrel-only CVA `*Variants` type aliases nobody
  (not even their own `.svelte`) imported: command-palette ×2, command ×8, context-menu ×4, dropdown-menu ×3,
  menu-bar ×8, reorderable-panes ×3, selection-bar ×4, `AccordionChevronVariants`, calendar ×8, carousel ×4
  (+ `CycleState`); the aliases and their barrel lines went, `VariantProps` imports trimmed where orphaned.
  `AiFlowEdge` + `AiEdgeKind` (topology.ts, P7 leftover), `ACCENT_TOKEN_KEYS` (+ barrel line), `perf/budgets.ts
  ceilingFor` (+ barrel line; excerpts rebuilt), `NewDbopsOperation`, `McpCallLogRow` (zero refs each).
  Kept from knip's list: `*Variants` types imported by their own component (knip cannot see `.svelte`
  `import type`), `VIRTUALIZE_ABOVE` (documented threshold in velocity/interaction.md), the vendored wasm `.d.ts`
  exports (generated), `verification`/`twoFactor` (Better Auth schema).

## Validation runs
| when | command | result |
|---|---|---|
| P0 | `bun run validate` baseline | exit 0 — 255 files / 2993 tests |
| P1-b1 | `bun run validate` | exit 0 — 255 / 2993 |
| P1-b2 | patterns:validate + patterns:build + mcp:excerpts:build | OK (1 page + snapshot rewritten) |
| P1-b2 | `bun run validate` | red: naming gate `ToolDef/ToolResult` allowance stale after de-export → allowance dropped |
| P1-b3 | `bun run validate` ×3 | run 1: vitest worker fork died (254/255 files); run 2: svelte-check exit 139 SIGSEGV; run 3: **exit 0 — 255 / 2993, svelte-check 11192 files 0 errors**. Host-fault pattern (memory), not code. |
| P2 | validate: biome red (blank line from describe remover) → formatted; validate rerun: worker crash (254/255); `bun run test` alone: **exit 0 — 255 / 2979** (2993 − 14 removed cases); svelte-check OK 11192/0; biome clean |
| P2 | deep knip | no cascade: only the removed symbols left the report (`knip-p2.txt`) |
| P3 | patterns:validate/build + excerpts:build | OK (3 pages + snapshot) |
| P3 | `bun run validate` ×2 | run 1 red: architecture gate's stale-allowance detector (`docs/loader.ts -> $env/dynamic/public` no longer true) → line dropped; run 2 **exit 0 — 255 / 2978**, svelte-check 11161/0 |
| P4abc | `bun run validate` ×2 | run 1: biome unused imports (`ModelMessage`, `ToolSet` after tryFallback) → fixed; run 2: **255 / 2973 green**, svelte-check 11161/0, then excerpts stale (biome reformatted mirrored files AFTER the rebuild) → rebuilt, all 6 check steps OK |
| P5/P4d | `bun run validate` | **exit 0 — 255 / 2969**, svelte-check 11147/0 |
| P7/P8 | `bun run validate` ×2 | run 1: 5 svelte-check errors (dropped i18n key with direct consumers; test-covered getter) → restored; run 2 **exit 0 — 255 / 2960**, svelte-check 11131/0 |
| P9 | patterns:build + excerpts:build; `bun run validate` | 2 pattern surfaces rewritten; **exit 0 — 255 / 2960**, svelte-check 11128/0; `vitest run src/lib/server/docs` 36/36 after the blocklist edit |
| P10 | `bun run validate` ×2 | run 1 red: `LEVEL_LABELS` still keyed `sentence` (svelte-check) → label + i18n key ×3 dropped; run 2 **exit 0 — 255 / 2960**, svelte-check 11127/0 (db lane rebuilt the PGlite snapshot from the trimmed schema) |
| P11 | `bun run validate` | **exit 0 — 255 / 2960**, svelte-check 11127/0 |
| P12 | `bun run validate:build` | **exit 0** — route_js 491.8/630 · baseline 79.5/82 · median 215.8/372 · total_client_js 2205.5/2270 · doc_html 2.9/5 (`scratchpad/validate-build-p12.log`) |
| P12 | `bun run refresh` | patterns:validate OK (162 patterns, 0 errors) · patterns:build 0 changed of 164 (already rebuilt in P9/P11) · mcp:excerpts:build wrote 156 files · **db:ingest-docs exit 1**: 34 docs re-embedded (`scratchpad/ingested.txt`), then 429 `You exceeded your current quota` on the Google embedding key after 6×35 s back-offs. Content-hash idempotent → **rerun `podman exec v10r bun run db:ingest-docs` when the daily quota resets**; it will re-embed the ~8 remaining changed docs (`ai/{graph-rag,image-kit,knowledge-base,persistent-chatbot,rag-roadmap}`, `desk/spreadsheet`, `progressive-revelation`, `visual-identity-architecture`, + the 3 README hubs if ingested) and soft-delete the `/docs/handoff` corpus row (the delete-not-seen reconcile runs at the END of the script, so it did not run). Until then the RAG corpus serves the pre-audit text for those docs. |
| P0 | deep knip baseline | 3 unused files, 1 devDep, 34 exports (21 = vendored wasm .d.ts), 142 types → `scratchpad/knip-baseline.txt` |

## Questions for Stas / live bugs found (not dead code — reported, not fixed)
- Blog `callout` directive parses and keeps its children but has no hydrating component either (renders as a
  plain div) — left because content survives; `chart`/`video` were removed because theirs vanished.
- **Desk Explorer "Delete" on a blog post is a no-op**: `explorer-actions.ts:294,309` sends `DELETE /api/blog/
  posts/[id]` but the route exports only GET + PATCH; the 405 is swallowed (`strict: false`) and the tree
  refreshes. `docs/blueprint/api.md:1015` documents `DELETE` too. Fix = add a DELETE wrapping `softDeletePost`
  (admin form action already does this) or drop the capability. Left for Stas — it is new server behaviour.
- Owner `PATCH/DELETE /api/blog/comments/[id]` (`softDeleteOwnComment`) has no UI at all; documented in api.md.
- `/api/admin/db/ops/[id]/cancel` has no cancel UI (documented in neon-branch-refresh.md).
- Doc drift on routes for P9: api.md:1015 (`GET revisions`, `GET/POST tags|domain` → real `PUT`; `POST export` →
  real `GET`), api.md:1037 + system-abstraction.md:214 `/api/desk/spreadsheets/[id]` (real `/api/desk/files/[id]`),
  system-abstraction.md:217 `retrieval/stats` (no such route), auth.md:667-668 missing `[id]`,
  notifications/settings.md:21 `/api/notifications/telegram/status`, blog.md:226,1215 `/api/blog/[id]/revision|
  publish`, `ai/quota.ts:11` comment "live poll" (no poller).
- P9 corpus notes (not dead code — corpus policy is Stas's): `scripts/db/ingest-docs.ts` RETRIEVAL_ONLY_BLOCK
  rationale for `persistent-chatbot.md` says "BUILT on dev but uncommitted" — it is committed (7c57224d); the
  site-awareness entry says "DESIGNED-not-built" — memory says v1 went live 2026-06-27. Entries left as they
  are; the comments are stale. `docs/ux-review-explosive-discovery.md` (2026-09-18 review record, top-level so
  never served/ingested) kept — one day old, likely in active use.
- **No unlink UI for Telegram/Discord**: accounts can be linked (`telegram/connect`, discord callback) but the
  only deactivation is the delivery job's `deactivateAccount` after a hard bounce. `unlinked_at` went with P10.
- Routes documented only by a directory-level line (no doc names them): `/api/retrieval/documents/[id]`,
  `/api/retrieval/graph/node/[elementId]`, `/api/retrieval/graph/path`, `/api/retrieval/ingest/stream` — kept as
  the multi-client-core API; worth naming in `system-abstraction.md:217`.

## Tree state at completion (2026-09-19)
`git status`: **344 files changed vs HEAD, +1,326 / −7,342, 36 deleted files**; nothing committed (source control is
Stas's). Generated surfaces rebuilt, not hand-edited: `docs/pattern-library/{README,pattern-index,admin-privacy-audit-log,
notifications-sse-stream}.md`, `mcp/public-excerpts.snapshot.json`. Untracked: `DEAD_CODE_AUDIT.md`, `.claude/agent-memory/clyn/`.
Detector scripts (throwaway, not in the repo) live in the session scratchpad: `stale-doc-paths2.py`, `schema-census.py`,
`i18n-unused.py`, `barrels.py`; recreate from the memory file's description if lost.

## SECOND PASS — verification audit (2026-09-19, started after the first-pass report)
Stas's brief: do NOT trust the first pass; re-establish reachability from the current tree with DIFFERENT
methods; challenge survivors; find cascading deadness and dead islands; delete what is proven; validate per batch;
final verification report (rechecked / found / removed / islands / challenged-but-live / dormant / uncertainties /
validation / did it change the first result).

Method (different angles from pass 1): (a) mechanical whole-program import graph in Python (`scratchpad/graph.py`) —
roots = hooks, params, `+` route files, service worker, schema dir, vitest setup, package-script + knip entries,
`?worker`, `import.meta.glob`, `$patterns`; entry→leaf traversal → unreachable files, test-only islands, SCCs with no
external entry; (b) identifier inverted index → every named export ↔ referencing files (zero-ref / test-only);
(c) route path inventory ↔ string callers; (d) event publisher↔subscriber matching (bus, SSE, effects, CustomEvent);
(e) registry entry ↔ consumer; (f) dep ↔ importer, env ↔ reader ↔ `.env.example`; (g) functional-deadness markers
(always-true branches, `@deprecated`, legacy/compat/fallback/TODO); (h) clyn sub-agents (detect-only) for judgement on
the mechanical survivors; (i) knip deep rerun as a cross-check, not the source.

### Second-pass phase plan
[✓] S1 execution map re-established + mechanical scans (scratchpad `graph.py`, `exports.py`, `routes.py`, inline env/asset/i18n/marker scans)
[✓] S2 sub-agent second opinions — 5 clyn reports (A/B/C/D/E), 100+ findings, each re-verified by the lead
[✓] S3 consolidation + deletions — batches 1–3, gate after each
[✓] S4 final zero-assumption pass (export census rerun: only the assessed gate seams/fixtures/pattern API remain; tree scan; docs residue grep) + verification report delivered in chat

### Second-pass findings
**S1 mechanical results (current tree, 2026-09-19):**
- Import graph: 2,059 code files, 648 roots re-derived (hooks/params/`+` route files/schema dir/vitest setup/configs/
  package-script + knip entries/shell-referenced scripts), 261 test roots. App-reachable 1,806; unreachable-from-app = 4:
  `desk-context.fixtures.ts` (test fixture by design), `server/perf/scenarios.ts` (harness, via `scenarios.gate.test.ts` ←
  `perf:scenarios` — known), `src/fontsource.d.ts` + `altcha-types.d.ts` (ambient declarations, no importer by nature).
  0 SCC islands. 3 unresolved specs = template strings (wasm loader text, record-turn snippet).
- Export census (identifier inverted index, comments + barrel lines stripped): 3,224 named exports; 0 declarations with
  zero use anywhere; 15 test-only declarations → 3 dead (`routeToChannels`, `classifyOrigin`, `edgeHandles`), 1 cascade
  (`db-enums.ts NOTIFICATION_CHANNELS` — its `NotificationChannel` type went in P8), rest = gate seams/fixtures (kept).
  544 exports used only in-file (policy-tolerated: `knip.config.ts ignoreExportsUsedInFile`) — not listed.
- knip deep rerun: 2 files / 22 exports / 36 types — 100% its `.svelte import type` blind spot + vendored wasm `.d.ts`
  (each cross-checked against the token index: every one is imported by its own component). `VIRTUALIZE_ABOVE` = 0 code
  readers (docs cite it) → challenged, see S3.
- Route inventory: 100 `+server.ts` routes; every one has an in-code caller except the documented multi-client-core doors
  (api.md §Endpoint Inventory: comments hide/unhide/remove + PATCH/DELETE, grant-requests approve/deny, users grants,
  db-ops cancel, retrieval documents/graph/ingest-stream) — INTENTIONALLY DORMANT, same verdict as P5 from a different
  method. Image-kit `crop/discard/embed/vision` reached via `endpoint(name)`. All form actions have submitters.
- Events: 6 desk-bus channels all publish+subscribe matched; SSE `init`/`new` consumed by the pipeline showcase;
  `EVENT_SPECS` 6 events all emitted by `telemetry.ts`. BUT `scroll_depth` + `form_abandon` events and
  `engagement.maxScroll` + `rage_click.count` properties are stored and read by NOTHING (aggregations read only
  rage/dead-click targets, engagement seconds, command_invoked) → functional deadness, data-collection contract
  (legitimate-interest.md LIA table justifies collecting them) → Stas decision (build the consumer or stop collecting).
- Deps: 98 declared; zero-importer = `@types/*` (all 10 base packages live), tooling (`@biomejs/biome`, `svelte-check`,
  `typescript`), and **`@unocss/preset-icons` + `@unocss/preset-uno`** — `uno.config.ts` imports the presets from
  `unocss`; no file imports the sub-packages; knip `ignoreDependencies` hid it → DEAD deps. Undeclared imports: `hast`,
  `mdast`, `unist`, `vfile`, `hast-util-sanitize` (type-only, knip-ignored policy), `camera-controls` (type-only via
  @threlte/extras) — hygiene note, not dead code. `zod` hit = a string in the AX demo snippet.
- Env: every `.env.example` key has a reader; every non-example read is a shell local, platform-injected var or documented
  script knob. Assets: 26 files, 0 unreferenced. i18n: 3,019 keys, 0 unused (strict m.key/quoted-string rule).
- Marker scan (legacy/compat/shim/TODO): (a) **legacy `{role, content}` chat-message union** in `ai/types.ts`,
  `validation.ts ChatMessageSchema`, `context/history.ts getMessageText`, `chat-orchestrator.ts:315` — both clients use
  the AI SDK `DefaultChatTransport` (UIMessage only); no doc documents the legacy shape → compat layer with zero
  producers → DELETE (S3). (b) `blog/rehype-rewrite-r2.ts` rewrites presigned R2 URLs nothing produces anymore (explorer
  inserts `/api/blog/assets/[id]/image`, content:push writes `/api/blog/media/...`) — DATA-DEPENDENT (old post bodies in
  prod may still carry them) → Stas check: `select count(*) from blog.post where body like '%r2.cloudflarestorage.com%'`
  (+ revision table); delete plugin + test when 0. `blog/media/[...path]` route docstring calls itself "legacy" but it is
  the live file-as-source proxy → comment fix. blog.md:594 cites `Renderer.svelte` (never existed) → doc fix.
  (c) `notifications/outbox.ts` `COALESCE(attempted_at, created_at)` legacy-row rescue: `claimDeliveries` always stamps
  `attempted_at` → unreachable branch + its test case → DELETE (S3). (d) 5 redirect stubs dated 2026-11 — kept.

### Second-pass deletions (S3)
- Batch 1 (2026-09-19): **legacy `{role, content}` chat-message compat layer** — `ai/types.ts ChatMessage` union (alias
  removed; consumers type against the AI SDK `UIMessage`), `validation.ts ChatMessageSchema` union → the UIMessage object
  only, `context/history.ts getMessageText` legacy branch, `chat-orchestrator.ts` legacy→UIMessage normalisation map;
  tests: 2 legacy cases dropped, fixtures in `history.test.ts`/`validation.test.ts`/`chat-orchestrator.test.ts` rewritten
  as UIMessages (61/61 green). **`routeToChannels`** (notifications/router.ts + barrel; its 15-case test retargeted at the
  live pure `channelsForSettings`, null-settings case dropped). **`classifyTarget`/`classifyOrigin`** (telemetry-origin.ts:
  unexecuted TS mirror of the SQL CASE in perf-queries; dev-wins rationale moved to perf-queries; tests now exercise
  `DEV_SCOPE_PATTERN` compiled as the same regex against the sampled targets). **`edgeHandles`** (turn-graph-layout.ts
  duplicate of the layout's own handle logic, no caller) + its `it`. **`db-enums.ts NOTIFICATION_CHANNELS`** (mirror entry
  orphaned when `NotificationChannel` went in P8) + drift-test row + enum import. **outbox `COALESCE(attempted_at,
  created_at)`** (a `processing` row is always claim-stamped) + the "rescues a legacy row" pglite case.
  **`@unocss/preset-icons` + `@unocss/preset-uno`** devDeps (+ knip `ignoreDependencies` lines; `bun install` in the
  container refreshed bun.lock). Comment/doc truth: `blog/media/[...path]` route + authz-gate note no longer call the
  live content:push proxy "legacy"; blog.md:594 `Renderer.svelte` (never existed) → MarkdownProse + hydrate-embeds; blog.md
  component tree entry likewise. Gate fallout fixed: `api/admin/analytics/pair` `listLimit` (the P5-removed GET's limiter,
  biome warning) + header; unused `TurnGraphEdge` import. Index census: `desk_file_origin_tool_call_idx` removed (DROP list).

- Batch 2 (2026-09-19, compiler-proven dead CSS): svelte-check at warning level (a lane the gate's `--threshold error`
  never shows) reported 12 `css_unused_selector` rules → removed: `BotToolsSection` `.confirm-strip/.confirm-text/
  .confirm-actions` (cascade from the P7 ConfirmationCard slice), `CyclePipeline` `.pill-error .pill-icon`, `code`
  descendant rules in 5 showcase pages (`captcha`, `honeypot`, `rate-limits`, `privacy/data`, `privacy/retention`),
  `account/settings .delete-confirm-input`, `admin/access/authors .dialog-body`, `auth/login .login-header p`. Also 58
  unreachable `var(--token, #hex)` fallbacks across 18 files (every token is defined in `app.css`, so the hex never
  applies — and each was a hardcoded color the rules forbid) → `var(--token)`. Remaining svelte-check warnings are a11y
  (29 `tabindex` on non-interactive rows, 2 redundant roles) and 55 `state_referenced_locally` — not dead code, listed
  for the report.

### S2 detector reports (landed; lead verification + deletions in S3 batch 3)
- **Area D (routes/scripts/config)** — H: `svelte.config.js` CSP `script-src` sha256 STALE since `b44f06fd` (2026-09-02
  comment edit in app.html's inline script) → the theme/palette/sidebar flash-prevention script is blocked in PROD (dev
  never enforces CSP) — live bug; `csr=false` in a `.svelte` instance script (no-op); `mutability` `appendOnlyRecords`
  full-table query unread; observability/budgets `ageDays/metrics/fieldBudgets` unread; `depends('admin:db')` with no
  invalidator; `queryMs` unread in 6 showcase loaders; notifications/send `userId/userName`; blog `total` ×3; M: `days` ×4,
  `errorKind`/`totalSize`, pair `code`, 8 unread action-payload keys; L: robots.txt `/de/app/` `/ru/app/` (no `/app`
  routes), security.txt `Policy:` → deleted SECURITY.md, 7 no-op `prerender=false`, cony.md stale paths, `EDGE_ICONS` ×3
  unused (data check: blog icon rows), drizzle `out` cosmetic. Confirmed live: all layout keys, nested tool/session fields,
  `_components` (84/84 imported), `+error.svelte` per layout, mcp TOOLS 6=6, scripts all wired, vercel crons ↔ jobs, deps.
- **Area A (server ai/retrieval/mcp/name-check)** — H: `McpOutcome 'tool_error'` consumed (usage page "uninstrumented"
  meter, docs) but `inferOutcome` can never produce it; `ModelCallRequest.activeTools` rendered by the inspector, never
  written. M: `policy/governor.ts requiresApproval()` zero callers (tools hard-code `requiresApproval: true`; registry note
  also stale re `shouldRequirePlan`); `DeskExecContext.actor` never read; `TurnSummary.modelCalls/toolExecutions` 2 COUNT
  subqueries per turn row, no reader; `ProviderQuota.tpm/resetTimezone/sourceUrl/tokensToday` (+ `tokens` SUM) unrendered;
  `CitationMatch quote/provider_source` + `quote/answerStart/answerEnd` "no producer yet" (reserved); conversations `meta.
  totalTokens` SUM unread; `TurnComposition.{errors,activations,grounding,state}` test-only; `FixedUIMessagePart file/
  source-url` accepted, never sent (security surface). L: `CallEndInput.outcome` never passed; `deskComposition` hoist for
  the deleted tryFallback; `X-Error-Source` header test-only; `AiError.code` never read; `onSourceSettled` documented
  future seam; never-emitted vocab (`pending`×2, `EmbedDetail.tokens`, `requestId`, `IngestStepId 'done'`); `CostEstimate`
  6 unrendered fields (jsonb-persisted); `ChildHit.content` selected unread; `createConversation` optionals. Also flagged:
  chatbot request with an empty last user text routes down the deskbot profile (not dead code — decision).

- **S2 reports B, C, E landed** (after the restart). B (server product domains): H — `notifications/health.ts` probe timeout
  never wired (`controller.signal` unused → LIVE DEFECT: admin probes had no timeout), `monitoring/neon.ts` namespace list
  stale (`app`,`rag` phantom; 10 live schemas hidden from /admin/db/observe), `renderBlogPost(_permalinks)`,
  `RenderResult.frontmatter` + `remark-extract-frontmatter` dep, `rawFrontmatter`, `includeHidden` always-true guard,
  `QueryVerdict.suspectedNPlusOne`; M/L — `'shed'` kind, `retryAfterSeconds`, `windowSec`, exif make/model/width/height,
  Neon `tableBytes/indexBytes/lastAutoanalyze`, `ageSeconds`, `inFlightCount`, `onRetry`, delivery-log `attemptedAt/
  sentAt`, `ClaimResult.pairedAt/expiresAt`, digest `subject`, `LiveEvent.sessionId`, `TtlSnapshot.capturedAt`,
  `NeonBranch.currentState`, gdpr.md version drift; Uncertain — the notification pipeline's ONLY producer is the
  showcase send page. C (components/client): H — `PageHeader.sticky`, workspace `setWorkspaces/setActiveId`, `Altcha.
  onexpired`, citation `quote/provider_source` + offsets, 9 app.css vars + `--z-base`; M — write-only `--color-accent-
  hover/--color-on-accent`, 4 tokens listed only in the tokens showcase, `containers` theme, carousel vertical/loop,
  toggle-group vertical/outline/multiple, accordion lg/multiple/collapsible, size dims on Toggle/ScrollArea/
  TagSelectable/SimpleChart, KnowledgeGraph→NetworkGraph `onNodeClick`, `DagGraph.orientation`, `Command` flat items +
  hideInput, `TagInput` 4 options, `InfoDialog.sections`, `SimpleChart` 5 toggles, 3D renderMode/thumbnail/orbit limits,
  `ProposalCardData.estimatedWrites`, `optimistic` test-only helpers; L — ~40 default-only props, `class` passthroughs.
  E (tests): M — `test/db.ts` from-scratch fallback (header claim disproved by running it), retrieval `skipped` emits,
  cache `per-user` scope, journey `navigationType` compat shim, `onSourceSettled` seam, naming-gate stale `use:` text;
  L — vacuous leak-gate entries, empty `UNDOCUMENTED_SHOWCASES`, authz regex naming a guard that does not exist,
  `KNOWN_BOT_FAMILIES`, `budgetKeys`, setup mocks; no weakened tests, no orphan mocks/fixtures.
- **Batch 3 (2026-09-19, the detector findings, each re-verified by grep before the edit):**
  SERVER — `McpOutcome 'tool_error'` meter (unproducible: `inferOutcome` maps no-diag → unknown_tool/threw) removed from
  the union, the schema enum + CHECK (→ DROP list), `getToolBreakdown.uninstrumented`, the usage-page badge, 4 comment
  claims + hosted-mcp.md; `ModelCallRequest.activeTools` + inspector row; `DeskExecContext.actor`/`DeskActor` + 2 literals
  (+ 2 test fixtures); `TurnSummary.modelCalls/toolExecutions` (2 correlated COUNTs per turn row) + 2 fixtures;
  `ProviderQuota.tpm/resetTimezone/sourceUrl/tokensToday` + `ProviderUsageToday.tokens` SUM + QuotaPanel type;
  `getConversationStats().totalTokens` SUM + `StorageMeta.totalTokens`; `CallEndInput.outcome` (never passed);
  `deskComposition` hoist (tryFallback residue) → block-scoped const; `X-Error-Source` header + assertion;
  retrieval `RetrievalStepStatus` −pending −skipped + the skip-emission loop + its test, `EmbedDetail.tokens`,
  `RetrievalStepEvent.requestId` (showcase `TraceStatus` now its own union); `ChildHit.content` column;
  `TurnComposition.activations/grounding/errors` (recorder carries them; profile tests retargeted at `state`);
  registry note for governor.ts corrected. `notifications/health.ts`: signal wired through `fn(signal)` into both
  fetches (the timeout now exists — 3-line fix of a dead controller, reported); `monitoring/neon.ts` namespace list
  derived from the schema barrel's `pgSchema` exports; `renderBlogPost` param, `RenderResult.frontmatter` +
  `remarkExtractFrontmatter` + `yaml` import + **`remark-extract-frontmatter` devDep** (bun.lock refreshed) + blog.md
  snippet; `rawFrontmatter`; `includeHidden`; `suspectedNPlusOne` + constant; `'shed'` + `retryAfterSeconds`;
  `windowSec` → `LIVE_WINDOW_SEC`; exif fields + `numOrNull`; Neon table fields; `ClaimResult.pairedAt/expiresAt`;
  delivery-log `attemptedAt/sentAt`; digest `subject` (+ 2 test lines); `LiveEvent.sessionId`; `TtlSnapshot.capturedAt`;
  `NeonBranch.currentState`; gdpr.md version.
  ROUTES/CONFIG — **CSP `script-src` hash recomputed** (`aeayArX…`; stale since 2026-09-02 → theme-flash script blocked
  in prod) + NEW gate `security/csp-script-hash.gate.test.ts` (recomputes it from app.html); no-op `csr=false`;
  `appendOnlyRecords` query + `queryMs`×6 + `start` timers; budgets `ageDays/metrics/fieldBudgets`; `depends('admin:db')`;
  send `userId/userName`; blog `total`×3; `days`×3; `errorKind`/`totalSize`; pair `code` (→ `failure: null`);
  action keys `notificationId/type`, `counterValue/poppedValue`, `defaultSaved`, `cancelled`, consent `success/tier`;
  robots.txt `/de/app/` `/ru/app/`; security.txt dead `Policy:`; 7 no-op `prerender=false` (+2 redundant `ssr=false`);
  cony.md paths.
  COMPONENTS — `PageHeader.sticky` (+ doc section); workspace setters; `Altcha.onexpired` + statechange listener;
  9 app.css vars + `--z-base` + `zIndex.base` (+ design docs); carousel → horizontal/looping only (5 CVA maps, item,
  keyboard, arrows); ToggleGroup → single/horizontal/one variant (+ `type="single"` dropped at 5 sites); Accordion →
  single, no `lg`, no `collapsible`; size dimension dropped from Toggle/ScrollArea/TagSelectable/SimpleChart; SimpleChart
  `labels/showGrid/showLabels/showTooltip/animate`; `onNodeClick` chain; `DagGraph` vertical; `Command` flat items +
  `hideInput`; `TagInput` `delimiters/allowDuplicates/validate/tagVariant`; `InfoDialog.sections` + `InfoSection` (+
  showcase copy); 3D `RenderMode`/`viewportRenderMode`/`cardRenderMode`/`thumbnail`/`controls.enabled|minDistance|
  maxDistance|autoRotateSpeed`; `estimatedWrites`; `Surface.svelte` header truth. REVERTED after svelte-check: the
  `containers` token — it IS rendered by the tokens showcase (detector claim was about `@md:` variants).
  TESTS — `test/db.ts` from-scratch fallback → loud throw; `navigationType` required + compat test dropped; naming-gate
  pointer; authz regex; `budgetKeys` inlined into its test (export + barrel line gone).
  KEPT after challenge: `FixedUIMessagePart file/source-url` (SDK history echo — the model can emit file parts; the
  security angle is Stas's), `AiError.code` (base-class contract), `CitationMatch quote/provider_source` (documented
  reserved contract, turn-trace.md "Not recorded"), `requiresApproval()` (documented pattern rule; registry note fixed;
  wiring vs deleting is Stas's), `cache 'per-user'`/`ageSeconds`/`onRetry`/`inFlightCount`/`temporaryId` (registered
  pattern code exercised by its own tests), `OwnerCookiePayload.expiresAt` (verify round-trip), `EDGE_ICONS` ×3 (data
  check), `--color-accent-hover/--color-on-accent` (design decision), `KNOWN_BOT_FAMILIES`, setup mocks, gate tripwires.

### Second-pass validation
| when | command | result |
|---|---|---|
| S3-b1 | targeted vitest (ai history/validation/orchestrator; router; telemetry-origin; turn-graph-layout; db-enums drift; outbox pglite) | 8 files green (61 + 27 + 54 tests) |
| S4 | `bun run validate:build` | **exit 0** — route_js 490.6/630 · baseline 79.4/82 · median 215/372 · total_client_js 2203.2/2270 · doc_html 2.9/5 |
| S4 | `bun run validate` (final, single run) | **exit 0** — svelte-check 11127/0, biome clean, 256 files / 2948 tests, mcp 21/0, registry + surfaces + excerpts + i18n + content + opacity OK |
| S3-b3 | `bun run validate` ×2 + step reruns | run 1: 1 test red (`admin/ai/models` asserted the removed `defaultSaved` key → assertion retargeted at `message`); run 2: svelte-check 11127/0, biome clean, **256 files / 2948 tests green**, mcp 21/0, registry OK, `patterns:check` stale (registry note edit → `patterns:build` rewrote 2 surfaces), then excerpts/i18n/content/opacity OK |
| S3-b2 | `bun run validate` (fresh container, 5 agents + Vite cold-compile in parallel) | svelte-check 11127/0, biome clean, 254/255 files — `resilience/retry.test.ts` "spends one budget" (real-timer 40 ms windows) failed under load; rerun ×3 in isolation 12/12 green → load flake, not red |
| S3-b1 | `bun run validate` ×2 | run 1: biome red (unformatted gate note; unused `TurnGraphEdge` import) + surfaced the P5 leftover `listLimit` → fixed; run 2: svelte-check 11127/0, biome clean, **255 files / 2949 tests green**, registry + pattern surfaces OK, excerpt snapshot stale (mirrored file edited) → rebuilt; excerpts/i18n/content/opacity checks OK |

### Post-commit gate repair (2026-09-20)
The `sentence` revert in `chunk.ts` (push attempt 4) landed AFTER the S4 final validate, so commit `ee34e39f` carried a red
gate: `db/ai/queries.ts:229` read `chunk.level` (DB union incl. the inert `sentence`) into `ChunkLevel = 'paragraph' |
'section'` (svelte-check 1 error). Fixed at the DB boundary with a documented narrowing (prod has 0 `sentence` rows:
11 764 paragraph / 7 681 section) and folded the duplicate inline `'paragraph' | 'section'` in `retrieval/ingest/index.ts`
into `ChunkLevel`; `mcp:excerpts:build` rerun (ingest/index.ts is registry-mirrored). Gate after: svelte-check 11127/0,
biome clean, 256/256 test files, mcp 21/0, all checks OK.

Same morning: the dev server SIGSEGV'd twice (11:40:11, 11:54:43 CEST) — NOT the tree. Kernel log for the same minutes:
`apport` (python3.14) segfault at 11:54:43 and VS Code's NodeService utility process `trap invalid opcode` at 11:56:06;
`/var/crash` adds nautilus (09-19) and ChatGPT (09-18). Restarted container: cold start ready in 7.8 s, 6 pages 200,
validate green with the dev server up, no host fault during the run. Host memtest86+ is installed (`/boot/mt86+x64`,
GRUB entry "Memory test") and still not run.

### Second-pass next exact action
**SECOND PASS COMPLETE.** Tree: 495 files vs HEAD, +2,126 / −8,959, 36 deleted files, 1 new file
(`security/csp-script-hash.gate.test.ts`); nothing committed. For Stas, unchanged from the first pass plus: (1) `db:push`
now also recreates `mcp.mcp_call_outcome` without `tool_error` and drops `desk_file_origin_tool_call_idx`; (2) the CSP hash
fix ships with the next deploy (prod's theme-flash script has been blocked since 2026-09-02); (3) decisions listed under
"KEPT after challenge" and the detectors' "Uncertain" items (analytics events nobody reads, notification pipeline's
showcase-only producer, `requiresApproval()` rule, reserved citation contract, accent token pair, `EDGE_ICONS`,
`rehype-rewrite-r2` data check); (4) rerun `db:ingest-docs` when the embedding quota resets; (5) delete this ledger after.
