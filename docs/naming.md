# Naming

One name, one concept. One concept, one name.

CLAUDE.md makes naming load-bearing — the codebase is meant to explain the system by
itself, which only works if a term means the same thing everywhere it appears. This file is
the authority for that vocabulary. `src/lib/naming.gate.test.ts` enforces the retired-term
column; everything else here is a decision record you read before inventing a name.

For *translation* vocabulary (en/de/ru term lock, voice per locale) see
[`content/glossary.md`](../content/glossary.md) — a different file for a different job.

---

## Canonical terms

| Concept | Canonical name | Retired |
|---|---|---|
| The three-tier retrieval pipeline | `retrieval` | `rag`, `nRAG`, `rag-shared` |
| A user's authenticated login | `Session` | — |
| An anonymous analytics visit | `AnalyticsSession` | analytics-local `Session` |
| An AI model vendor | `provider` | — |
| An external notification transport | `channel` | `NotificationProvider`, `notifications/providers/` |
| An infrastructure service we depend on | `dependency` | monitoring `ProviderStatus` / `ProviderResult` |
| A job execution | `run` (owned by `jobs/`) | — |
| A Neon branch maintenance action | `branch operation` | `dbops` `Run*` |
| Which retriever produced a result | `RetrieverId` (field `retriever`) | `RetrieverLane` (field `lane`) |
| Which corpus a chunk came from | `RetrievalCorpus` | `RetrievalLayer` |
| Which build emitted a telemetry sample | `TelemetryOrigin` | `TelemetryLane` |
| Which corpus a context probe searched | `ProbeCorpus` | `ProbeLane` |
| Anonymous vs authenticated analytics | `lane` | — |
| A sanitized client-facing projection | `Public<Concept>` | `<Concept>DTO` |
| The member area | `account` | `app`, `me` |
| Which engine a retrieval step belongs to | `engine` (`RetrievalEngine`) | the step's `path` field |
| The panel workspace | `desk` → `dock` → `workspace` → `panel` | `workbench` |
| Per-user personalization storage | pgSchema `personalization` | pgSchema `app` |
| A Neon branch-operation row | `dbops.operation` | `dbops.run` |
| An overlay component | `Dialog` | `*Modal.svelte` |
| Sending a notification | `sendNotification` | `NotificationService.send` |
| Crawler hits not yet in Postgres | `bot-hit buffer` (`bufferBotHit` / `flushBotHits`, Redis list) | per-hit `recordBotHit` |
| What the daily cron sweep runs | `jobsDueOn` (`/api/cron/due`) | one `vercel.json` entry per job |
| The MCP demo-state domain module | `mcp/demo/state.ts` | `mcp/demo/service.ts` |
| The registry of pattern MCP *tools* | `mcp/patterns/tools.ts` | `mcp/patterns/registry.ts` |
| The showcase Redis key namespace | `SHOWCASE_CACHE_PREFIX` / `assertShowcaseCacheKey` | cache-local `SHOWCASE_PREFIX` |
| The design system's icon size scale | `iconSize` (`styles/tokens.ts`) | sidebar-local `iconSize` |
| The sidebar's computed icon width | `sidebarIconSize` | `iconSize` |
| Formatting a date for a reader | `formatDate(date, locale)` from `$lib/i18n` | five page-local `formatDate`s |
| The Cloudflare account id | env `R2_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID` |
| An AI-domain error | `AiError` / `AiErrorKind` / `classifyAiError` / `safeAiMessage` | `AIError`, `classifyAIError`, `safeAIMessage` |
| Retrieval's admin overview | `RetrievalOverviewStats` / `RETRIEVAL_PAGE_SIZE` | `RAGOverviewStats`, `RAG_PAGE_SIZE` |
| Reading a CSS custom property at runtime | `getCssVar` | `getCSSVar` |
| The tabbed chart/data/code demo wrapper | `VizDemoCard` | mcp-local `DemoCard` |

Two of these deserve their reasoning spelled out, because the losing name looked fine:

- **`channel`, not `provider`, for notification transports.** The database already says so:
  `notification_channel` is a persisted enum, and `notifications/router.ts` routes to
  channels. The code was the only place still calling them providers. `provider` now means
  exactly one thing — an AI model vendor.
- **`RetrievalCorpus`, not `RetrievalLayer` or `RetrievalStore`.** The module's own header
  calls these "the four corpora"; `RetrievalStore` was rejected because the type already has
  a `store` field naming the physical table each corpus lives in.

## Words that carry a metaphor

`lane`, `layer`, `surface`, `step`, `run` and `path` are cheap to reach for and expensive to
share. Each is spoken for:

- **`lane`** — the two documented two-lane product models (analytics: anonymous vs
  authenticated; search: static vs server) and nothing else. Retrieval uses `RetrieverId`,
  telemetry uses `TelemetryOrigin`, probes use `ProbeCorpus`.
- **`layer`** — the seven-layer abstraction hierarchy, the component layer order, and the UI
  z-order stack (`state/layer-stack.svelte.ts`). Not a retrieval or AI-pipeline term.
- **`surface`** — which part of the product something belongs to. `ai_surface`,
  `mcp_surface`, `user_surface` and `SearchSurface` are one concept applied to four
  subsystems, which is why they share the word: a search hit's surface (`page`, `showcase`,
  `doc`, `blog`) names the same kind of thing an `ai_surface` does.
  `layout/Surface.svelte` is the unrelated design-system sense (an elevated plane) and is
  safe because it never meets the other four.
- **`step`** — always qualified by its pipeline: `RetrievalStepId`, `IngestStepId`,
  `ProposedStep`, `ProposalCardStep`. A bare `Step` is never right.
- **`path`** — a file path, a URL path, or a graph path. Not an axis: the retrieval step's
  engine is `engine`, and the retriever that produced a result is `retriever`.
- **`run`** — a job execution. A Neon branch action is a *branch operation*.

## Discriminator columns

Three words, three jobs. The schema already follows this in most tables; new tables must.

| Column | Means | Examples |
|---|---|---|
| `kind` | This row is a fundamentally different *shape* of thing | `auth.grant.kind`, `retrieval.llmwiki_page.kind` |
| `type` | A closed classification of an otherwise uniform row | `notifications.type`, `desk.file.type` |
| `category` | Taxonomy or grouping, often user-visible | `analytics.bot_hits.category`, pattern-registry `category` |

Existing columns that disagree are left alone deliberately — renaming a live column is churn
against stored data for no reader benefit. The rule binds new work.

## Suffix conventions

- **`<x>Schema`** is a Drizzle `pgSchema()` namespace. A Valibot schema that would collide
  with one takes a qualifier: `feedbackFormSchema`, not `feedbackSchema`.
- **`Public<Concept>`** is a sanitized projection crossing to a client. There is no `DTO`
  suffix in this repo.
- **`<Concept>Result`** is the outcome of one operation; qualify it by domain
  (`IngestResult`, `DeliveryResult`) rather than leaving a bare `Result`.

## Acronyms are words

Inside a mixed-case name an acronym is spelled as a word: `AiError`, `McpCallLog`,
`RetrieverId`, `getCssVar`. The repo was already almost unanimous — the give-away was
`AIError` sitting one import away from `SimulateAiError`, which teaches a reader that both
spellings exist and lets them guess wrong. SCREAMING_SNAKE constants are a different casing
system and keep the acronym intact: `AI_PAGE_SIZE`, `MCP_ADMIN_TOKEN`, `R2_ACCOUNT_ID`.

The gate reads declared names, splits them into segments and refuses a shouted acronym.

## i18n keys are namespaced

The Paraglide key space is flat and global, so an unprefixed key squats on a common English
word for the whole app. `greeting`, `sample_text`, `items_count`, `current_language` and the
`section_*` / `formatted_*` families belonged to `/showcases/i18n` alone and would have
silently answered for any later page reaching for the same word. They are now
`showcase_i18n_*`, like the other 1,246 showcase keys.

Every key's first segment names its area, and the gate holds that list. Singular and plural
are one area, not two: `error_5xx_feedback_text` joined the `errors_*` family it belonged to.

## Files are named for what they own

A filename is a name. `service.ts`, `helpers.ts`, `utils.ts`, `constants.ts`, `shared.ts`,
`core.ts`, `handler.ts`, `manager.ts`, `data.ts`, `common.ts` and `misc.ts` name a bucket
instead of a responsibility, and the bucket is what lets unrelated things accumulate:
`admin/helpers.ts` held an audit-context builder *and* an analytics range parser, and
`notifications/service.ts` was a single-method object around what is now `sendNotification`.
The gate refuses those names outright.

Two consequences worth stating:

- **A one-method "service" object is a function.** `NotificationService.send(input)` became
  `sendNotification(input)`. The domain layer is plain functions everywhere else.
- **Constants go in `config.ts` when they are policy** (`mcp/demo/config.ts`), and in a file
  named for what they are when they are not — `db/analytics/sentinels.ts` holds the
  `UNKNOWN_COUNTRY` / `UNKNOWN_CLIENT` sentinels, which are vocabulary, not policy.

`$lib/utils/` survives as a *directory*: every leaf inside it is sharply named (`cn.ts`,
`safe-path.ts`, `xml.ts`), so the meaning lives where a reader looks for it.

## Singular and plural

For cookies the repo distinguishes them, and the distinction is worth keeping: a **singular**
`cookie.ts` owns one named cookie's contract (`pairing/cookie.ts`, `styles/random/cookie.ts`),
a **plural** `cookies.ts` is a cookie *utility* module (`$lib/utils/cookies.ts`).
`analytics/cookies.ts` held only the consent cookie and is now `analytics/consent-cookie.ts`.

## Names that stay overloaded on purpose

Flagged by audit, examined, kept:

- `AiLayer` / `AiLane` in `showcases/ai/topology.ts` — diagram vocabulary (bands stacked,
  lanes side by side), self-documenting and scoped to one module.
- `'blog-author'` and `'tool-result'` kebab-case enum values among otherwise snake_case
  ones. The first mirrors a URL path segment, the second mirrors the Vercel AI SDK's own
  wire literal `part.type`.
- `Database` declared in both `db/types.ts` and `db/index.ts` — the re-derivation is
  commented, and exists so CLI consumers avoid pulling `$env/dynamic/private`.
- Per-domain `config.ts` files repeating `RATE_LIMIT_WINDOW`, `MAX_UPLOAD_SIZE` and friends.
  Same name, independent values, by design — policy belongs to its domain.
- `$lib/actions/` (Svelte `use:` directives) beside SvelteKit's form `actions`. Both are
  established framework terms; neither is ours to rename.
- The AI tool `search_pattern_library` beside the MCP tool `search_patterns`. Same registry,
  but two tools on two surfaces with separate telemetry — one name would make an admin
  dashboard unable to say which one ran. The rationale is in the tool's own header.
- `?q=` in GET search URLs (`/api/search`, `/admin/users`, `/admin/content/posts`, …) beside
  `query` in JSON bodies and tool arguments (`/api/retrieval/search`, `search_catalog`).
  Each is uniform within its context, and `q` is the web's convention for a GET search param.
- `PanelEmptyState` beside `composites/empty-state/EmptyState`. Not a duplicate: a dock leaf
  needs a compact state, the page-level one has a 18.75rem floor. Same prop names, on purpose.
- `providerMessageId` on `DeliveryResult`. That id belongs to the external service, not to our
  `DeliveryChannel` abstraction, and it is stored as `provider_message_id`.
- `lane` inside the wasm and workers showcases (benchmark bars) and the search two-lane model.
  Route-local visual metaphors and a documented product model, not a general axis word.
- `verifyConnection` in three sibling showcase domains (`graph`, `store`, `cache`). One
  operation against three backends; the shared verb is what lets a reader move between
  `/showcases/db/{graph,storage,cache}/connection` without relearning. The relational page's
  local `measureConnection` was renamed *to* `verifyConnection` for the same reason.
- `markFailed` in `notifications/outbox.ts` and `db/ai/proposals.ts`. Each marks its own
  entity terminal; they never meet in one module.
- `registry` as a filename in seven places. It means the same thing every time — a catalogue
  keyed by id. The one real collision was `mcp/patterns/registry.ts`, which was a registry of
  *tools*, not of patterns, and is now `tools.ts` beside its sibling `mcp/demo/tools.ts`.
- `assertShowcaseKey` / `SHOWCASE_PREFIX` in `server/store/`. The canonical pair keeps the
  plain name: it is security-critical (SEC-N01) and pinned by a regex in
  `security/authz-coverage.gate.test.ts`. The Redis copy took the qualifier instead.

## Names we cannot move

- **MCP tool names** (`search_patterns`, `get_pattern`, `get_file_excerpt`,
  `trace_capability`, `recommend_emulation_plan`, `validate_snippet`) — external clients
  call them, and `mcp/patterns/parity.test.ts` guards stdio↔HTTP agreement.
- **Pattern-registry `id`s** — the MCP surface, the generated docs pages and external
  agents all address patterns by id.
- **Better Auth's tables** — vendor-owned.
- **Stored enum values and column names** — renaming needs DDL; route it through
  `docs/Ref-ToDo.md`.
- **The `notif_*` i18n key names.** They look like an abbreviation to tidy, but
  `notifications.message_key` *stores* them and `renderNotification` resolves the stored
  value against the Paraglide registry at send time. Renaming the keys would blank every
  notification already in the table. An i18n key is only free to move when nothing persists
  it — check before assuming.

## Before you add a name

1. Search for the concept first. If it exists under another name, use that one.
2. Search for the *name* you want. If it exists for another concept, pick a different word.
3. If the name needs a qualifier to be unambiguous, add one qualifier — not three.
4. Local variables are exempt. This file is about exported and architectural names.
