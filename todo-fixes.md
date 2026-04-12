# Codebase Review — 14-Agent Audit (2026-04-12)

## Critical / High

### Security

- [x] **XSS: Blog `Renderer.svelte` single-layer sanitization** — Added `isomorphic-dompurify` defense-in-depth inside `Renderer.svelte`. Sanitizes after R2 URL rewrite with `FORBID_TAGS: ['script', 'style']`
  - `src/lib/components/blog/Renderer.svelte:23`

- [x] **IDOR: R2 key confirmation accepts arbitrary keys** — Added regex validation `/^blog\/[0-9a-f-]{36}\.\w{1,10}$/` to `ConfirmUploadSchema.key`
  - `src/lib/server/blog/schemas.ts:41`

- [x] **CSP: Enabled nonce mode** — Added `csp.mode: 'nonce'` to `svelte.config.js`. JSON-LD `application/ld+json` is a data block exempt from CSP `script-src` per HTML spec — no nonce needed for it
  - `svelte.config.js:17`

- [x] **AI: Tool outputs have no size limit** — Added `MAX_TOOL_OUTPUT_CHARS` (8000) with `truncateOutput()` applied to all desk-read tool outputs (markdown, spreadsheet, file tree)
  - `src/lib/server/ai/tools/desk-read.ts`

- [x] **AI: RAG content not redacted for credentials** — Added `CREDENTIAL_RE` redaction (`sk-|ghp_|gho_|glpat-|AKIA|Bearer`) to `formatContextForPrompt()` output
  - `src/lib/server/retrieval/index.ts:188`

### API Contracts

- [x] **`requireApiUser` breaks error envelope** — Changed `requireApiUser`, `requireApiAuthor`, `requirePostOwnership`, `requireAssetOwnership` to throw `apiError()` Response instead of SvelteKit `error()`. All 45 endpoint callers now get consistent `{ error: { code, message } }` shape
  - `src/lib/server/auth/guards.ts`

- [x] **5 endpoints return non-standard error shapes** — Migrated all to `apiError()`/`apiOk()` from `$lib/server/api/response`
  - `src/routes/(shell)/api/notifications/read-all/+server.ts`
  - `src/routes/(shell)/api/notifications/telegram/connect/+server.ts`
  - `src/routes/(shell)/api/ai/streaming/+server.ts`
  - `src/routes/(shell)/api/notifications/discord/authorize/+server.ts`

- [ ] **8+ list endpoints have no pagination** — unbounded queries returning all rows:
  - `src/routes/api/blog/tags/+server.ts`
  - `src/routes/api/blog/domains/+server.ts`
  - `src/routes/api/blog/assets/+server.ts` (generates presigned URL per asset — N+1 against R2)
  - `src/routes/(shell)/api/desk/files/+server.ts`
  - `src/routes/(shell)/api/desk/folders/+server.ts`
  - `src/routes/(shell)/api/desk/spreadsheets/+server.ts`
  - `src/routes/(shell)/api/retrieval/documents/+server.ts`
  - `src/routes/(shell)/api/ai/conversations/+server.ts`

- [x] **Telegram webhook returns 403 on auth failure** — Changed to return 200 on auth failure (suppresses retries). Switched to `request.text()` + `JSON.parse()` for HMAC-compatible body handling
  - `src/routes/(shell)/api/telegram/webhook/+server.ts`

### Latent Bugs

- [x] **`process.once('SIGTERM')` collision** — Changed both schedulers from `process.once()` to `process.on()` so both handlers fire on shutdown
  - `src/lib/server/jobs/scheduler.ts:31`
  - `src/lib/server/jobs/delivery-scheduler.ts:38`

- [x] **Notification delivery has no concurrency guard** — Added in-process mutex flag (`processing`) to prevent overlapping batch execution
  - `src/lib/server/jobs/notification-delivery.ts:51`

- [x] **`$env/static/private` for Neo4j/DB** — Switched all three to `$env/dynamic/private`: graph/index.ts, db/index.ts, auth/index.ts
  - `src/lib/server/graph/index.ts:1`
  - `src/lib/server/db/index.ts:3`
  - `src/lib/server/auth/index.ts:4`

### Testing

- [ ] **`chat-orchestrator.test.ts` tests stubs, not real code** — local reimplementations of `windowMessages`/`buildSystemPrompt` diverge from actual module (different signatures, missing params). Test via `MockLanguageModelV3` through `orchestrateChat`
  - `src/lib/server/ai/chat-orchestrator.test.ts:14-66`

- [ ] **`classifyAIError` completely untested** — security boundary between provider errors and user messages. Status 404 → model classification is likely too broad (catches "endpoint not found")
  - `src/lib/server/ai/errors.ts`

- [ ] **Desk DB layer zero test coverage** — IDOR checks on `getFile`, `updateSpreadsheetByFileId`, `listFiles` untested. Copy pattern from `db/notifications/mutations.test.ts`
  - `src/lib/server/db/desk/queries.ts`
  - `src/lib/server/db/desk/mutations.ts`

- [ ] **4 of 7 auth guards untested** — `requireAuthor`, `requireApiAuthor`, `requirePostOwnership`, `requireAssetOwnership`. Admin bypass path is security-relevant
  - `src/lib/server/auth/guards.ts`

---

## Medium

### Database

- [x] **Missing index on `spreadsheet.fileId`** — Added `spreadsheet_file_id_idx`
  - `src/lib/server/db/schema/desk/spreadsheet.ts`

- [x] **`spreadsheet.fileId` nullable** — Changed to `.notNull()` and removed migration comment
  - `src/lib/server/db/schema/desk/spreadsheet.ts:27`

- [x] **No uniqueness on `embeddingModel(provider, modelName)`** — Added unique constraint on `(provider, modelName)` and partial unique index on `isDefault = true`
  - `src/lib/server/db/schema/rag/embedding-model.ts`

- [x] **`dailyPageStats.date` stored as `text`** — Changed to `date('date', { mode: 'string' })`
  - `src/lib/server/db/schema/analytics/aggregates.ts:12`

- [x] **Missing `folders` in `userRelations`** — Added `folders: many(folder)` to userRelations
  - `src/lib/server/db/schema/relations.ts:327`

- [x] **Neo4j missing existence constraints** — Added `IS NOT NULL` constraints for `Technology.category`, `Layer.order`, `Showcase.path`
  - `src/lib/server/graph/showcase/constraints.ts`

### Architecture

- [ ] **Settings page embeds S3 upload/delete inline** — `uploadAvatar`/`removeAvatar` actions contain `PutObjectCommand`/`DeleteObjectCommand`, file validation, key construction, DB updates. Extract to domain module (e.g., `$lib/server/user/avatar.ts`)
  - `src/routes/(shell)/app/settings/+page.server.ts:79-130`

- [ ] **Routes bypass barrel exports** — multiple routes import directly from `$lib/server/db/[domain]/` instead of through domain barrels. Re-export needed query functions from domain index files
  - `src/routes/(shell)/app/notifications/+page.server.ts`
  - `src/routes/(shell)/app/notifications/settings/+page.server.ts`
  - `src/routes/(shell)/admin/` (multiple)

- [ ] **No user/account domain module** — dashboard and account pages query auth tables directly. Create `$lib/server/user/` domain module
  - `src/routes/(shell)/app/dashboard/+page.server.ts`
  - `src/routes/(shell)/app/account/+page.server.ts`

### SvelteKit

- [ ] **Notification settings: 14 manual `$state` mirrors** — 17 `state_referenced_locally` suppressions. Replace with Valibot schema + Superforms
  - `src/routes/(shell)/app/notifications/settings/+page.svelte`
  - `src/routes/(shell)/app/notifications/settings/+page.server.ts`

- [x] **`?success=` query params not cleaned after toast** — Added `goto(page.url.pathname, { replaceState: true })` after displaying success/error toasts
  - `src/routes/(shell)/app/notifications/settings/+page.svelte`

- [x] **`exportData` runs 3 sequential DB queries** — Wrapped in `Promise.all` for parallel execution
  - `src/routes/(shell)/app/account/+page.server.ts`

- [x] **RAG chat tier guard uses `$effect` for state sync** — Reviewed: `$effect` is correct here since `selectedTierValues` is mutable state bound to `ToggleGroup`. `$derived` can't replace it
  - `src/routes/(shell)/showcases/ai/retrieval/chat/+page.svelte`

### UX / Accessibility

- [x] **Login email field has no label** — Added `aria-label="Email address"`
  - `src/routes/(shell)/auth/login/+page.svelte:121`

- [x] **OTP digit inputs have no accessible labels** — Added `aria-label="Digit {n} of 6"` to each input
  - `src/routes/(shell)/auth/verify/+page.svelte:140`

- [x] **Session expiry modal: no focus trap, raw buttons** — Rewrote to use `Dialog` primitive (Bits UI focus trap) + `Button` component. Removed all custom modal CSS
  - `src/lib/components/shell/session/SessionExpiryModal.svelte`

- [x] **Input focus state fails WCAG 2.4.11** — Added `outline: 2px solid var(--color-primary)` on `:focus-visible` alongside bottom border
  - `src/lib/components/primitives/input/Input.svelte`

- [x] **Toast close button 24px tap target** — Expanded to 2.75rem (44px) to meet WCAG 2.5.5 minimum
  - `src/lib/components/composites/toast/ToastContainer.svelte:103`

- [x] **Admin pages hand-roll pagination** — Replaced with `Pagination` component + `goto()` for URL-based navigation. Removed hand-rolled pagination CSS
  - `src/routes/(shell)/admin/users/+page.svelte`

- [ ] **Consent banner: 4 simultaneous choices** — choice overload on mobile. Keep Accept All + Necessary Only as primary; move others to customize drawer
  - `src/lib/components/shell/ConsentBanner.svelte`

- [x] **Account delete-confirm uses raw `<input>`** — Replaced with `Input` component + `aria-label`
  - `src/routes/(shell)/app/account/+page.svelte:149`

- [x] **`formattedTime` in SessionWarningBanner is `$derived(() => ...)` not `$derived.by()`** — Fixed to `$derived.by()`
  - `src/lib/components/shell/session/SessionWarningBanner.svelte:19`

### AI/LLM

- [x] **Streaming endpoint uses deprecated static `chatModel`** — Replaced with `getActiveProvider(user.id)` for dynamic per-user provider resolution
  - `src/routes/(shell)/api/ai/streaming/+server.ts:4`

- [x] **Fallback path skips error classification** — Wrapped in `createUIMessageStream` with `onError: classifyStreamError`
  - `src/lib/server/ai/chat-orchestrator.ts:234`

- [x] **No context size cap on RAG injection** — Added `maxChars` parameter (default 16K ~4K tokens), truncates by whole chunks
  - `src/lib/server/retrieval/index.ts:190`

- [x] **Stale docs: embedding provider** — Updated tables to show Google Gemini instead of Mistral
  - `docs/blueprint/ai/README.md:39,47`

### API Contracts (continued)

- [ ] **15+ mutation endpoints missing rate limiting** — all blog CRUD, desk mutations, announcements
  - `src/routes/api/blog/posts/[id]/+server.ts` (and siblings)
  - `src/routes/(shell)/api/desk/` (multiple)
  - `src/routes/api/announcements/[id]/dismiss/+server.ts`

- [x] **SSE streams lack named events and event IDs** — Notification stream now sends named events (`event: init`, `event: new`, etc.) matching client listeners. Analytics stream uses unnamed events (client uses `onmessage`) — consistent. `Last-Event-ID` not added (no durable event store to replay from)
  - `src/routes/(shell)/api/notifications/stream/+server.ts`
  - `src/lib/server/notifications/stream.ts`

- [x] **`v.any()` in cell/columnMeta validation** — Replaced with typed `CellValue` union (string|number|boolean|null) + `CellObject` record + 500KB JSON size check
  - `src/routes/(shell)/api/desk/files/[id]/+server.ts`

- [x] **Audit export: inline auth, no validation, no rate limiting** — Replaced inline auth with `requireAdmin()` guard, added rate limiter (10/min), added date format validation
  - `src/routes/(shell)/admin/audit/export/+server.ts`

### Aesthetics

- [x] **`pill-variants.ts` — `bg-primary text-primary` = invisible text** — Fixed to use container/light bg tokens with contrasting text colors
  - `src/lib/components/primitives/pill-variants.ts`

- [x] **`desk-panels.ts` duplicates label/icon** — Derived `DESK_ACTIVITY_BAR_ITEMS` from `Object.values(DESK_PANELS).map()`
  - `src/lib/config/desk-panels.ts`

- [x] **`TabNav` naming inconsistency** — Renamed to `NavTab` across 15 consumer files + barrel export
  - `src/lib/components/composites/nav-tab/NavTab.svelte`

- [x] **`ChatInput` raw buttons** — Replaced raw `<button>` with `<Button variant="primary" size="icon">` (send) and `<Button variant="ghost" size="icon">` (settings). Removed redundant scoped CSS
  - `src/lib/components/composites/chatbot/ChatInput.svelte`

---

## Low / Watch

### Dependencies

- [ ] **bits-ui `^1.0.0-next.0`** — severely outdated, current is 2.16.3. Pre-release pin won't resolve to stable. Highest-risk dep gap. Migration involves `el`→`ref`, `asChild`→`child` snippet, Select API redesign
- [ ] **UnoCSS `^0.58.0`** — significantly behind (current 66.x). Version discontinuity means `^` won't auto-upgrade
- [ ] **Vite `^7.2.6`** — Vite 8 shipped March 2026. Rename `rollupOptions`→`rolldownOptions`. ~15s build improvement
- [ ] **Better Auth `~1.4.18`** — behind 1.6.2. Tilde pin blocks minor updates. v1.6.0 `freshAge` breaking change requires migration step
- [ ] **Three.js `^0.170.0`** — 13 revisions behind (r183). Will jump on next install due to `^` range

### Latent Issues

- [x] SSE `start()` uncaught async error can kill notification stream silently — Wrapped `getUnreadCount` in try/catch with fallback
- [x] `userPreferences` Map in `providers.ts` never cleans up (slow memory leak) — Added MAX_PREFERENCES (10K) with FIFO eviction
- [x] Workspace queries swallow all DB errors, return empty arrays — Removed stale try/catch blocks, errors now propagate
- [x] Analytics SSE has no reconnection on error — Added auto-reconnect with 3s delay on `onerror`, cleanup on effect teardown
  - `src/routes/(shell)/showcases/analytics/live/+page.svelte`
- [x] `DockLayout` theme timer not cleaned on unmount — Refactored to use `$effect` cleanup return
- [x] Notification pipeline showcase page silently broken — Server now sends named SSE events (`event: init\n`, `event: new\n`, etc.) matching client `addEventListener()` listeners. Fixed both `stream.ts` and `notifyUser()`
  - `src/lib/server/notifications/stream.ts`
  - `src/routes/(shell)/api/notifications/stream/+server.ts`
- [x] `prepareStep` double-cast through `unknown` — Replaced `msg as unknown as { role: string; content: unknown }` with direct `msg: ModelMessage` type annotation (already imported)
  - `src/lib/server/ai/chat-orchestrator.ts`
- [x] `refreshDiscordTokens` catch block can throw on its own DB write — Wrapped inner DB write in try/catch
- [x] In-memory rate limiter in showcase endpoint leaks memory — Added periodic cleanup when map exceeds 1000 entries
- [x] Palette CSS `data-palette` attribute interpolated without sanitizing `pid` — Added regex sanitization `[^a-zA-Z0-9_-]`

### Documentation

- [x] `docs/README.md` references non-existent `implementation/` directory — Removed implementation row, fixed `primary/` → `core/` + actual subdirectory paths
- [x] `docs/blueprint/ai/README.md` is ~1000 lines of stale implementation (not an index) — Rewrote as navigation hub: overview, provider table, module map, architecture diagram, document index. 1000 lines → 40 lines
- [x] 8 broken links across README files — Fixed `features/` → `capabilities/` in viz.md, notifications/README.md, resend.md. Removed stale `implementation/` refs from db/README.md and caching.md
- [x] `docs/blueprint/i18n.md` says sveltekit-i18n — Reviewed: doc already references Paraglide JS v2 (false positive in original audit)
- [x] `docs/blueprint/db/README.md` describes fictional `compose.yaml` local setup — Replaced with actual cloud-hosted setup (Neon, Neo4j Aura, R2, Upstash). Removed broken implementation/ links
- [x] `docs/guides/` and `docs/blueprint/data/` missing README.md indexes — Added both README.md files with topic tables

### Bun / Config

- [x] `validate` script uses `bun biome check .` instead of `biome ci .` — Fixed to `biome ci .`
- [ ] No `bunfig.toml` (low impact, optional install cache config)
- [x] Missing `warmup.ssrFiles` in vite config for server entry points — Added `hooks.server.ts`, `db/index.ts`, `auth/index.ts`
- [x] Redundant `--host 0.0.0.0` in both CMD and vite config — Removed from `Containerfile.dev` CMD (already in `vite.config.ts`)

### Real-World Gotchas (from scout)

- [x] Better Auth rate limiting silently off without `x-client-ip` header injection in hooks — Added `event.request.headers.set('x-client-ip', event.getClientAddress())` before `svelteKitHandler` call
  - `src/hooks.server.ts`
- [x] AI SDK `Chat` class doesn't update on route navigation — Reviewed: all 4 `Chat` instances are in leaf pages/components, not layouts. They recreate on navigation naturally. No fix needed
- [ ] Neo4j Aura Free auto-deletes after 90 days paused
- [ ] Neon free tier 100 CU-hours/month cap — background polling defeats scale-to-zero
