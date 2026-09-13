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
| The version of a file a plan step was proposed against | `reviewed baseline` (`ProposedTarget`, field `target`) | a live read inside the replay |
| The durable per-step outcome of an approved plan | `step receipt` (`agent_proposal_step`, `ProposalStepReceipt`) | `executionResult` jsonb |
| The client-side lifecycle of one proposal | `proposal run` (`ProposalRun`, `ProposalRunPhase`) | `proposalBusy` |
| The deterministic assistant message an approval leaves in the thread | `execution receipt message` | the `[resumeFromProposalId:…]` resume turn |
| The step after which a deskbot turn stops for a decision | `approval boundary` (`stoppedAtApproval`) | — |
| How an approved step is undone | `recovery` (`ProposalStepRecovery`: `revision`/`soft_delete`/`rename_back`/`none`) | model-authored `rollback` text |
| The database or transaction a domain mutation runs on | `handle` (`DbHandle`) | — |
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
| A measured segment of one request | `span` (`RequestTiming`, `http/request-timing.ts`) | — |
| A level in the cache hierarchy | `CacheTier` (`local` / `shared` / `origin`) | `CacheLayer`, `CacheStore` |
| Work that runs after the response | `deferAfterResponse` (`platform/after-response.ts`) | a bare `waitUntil` at each call site |
| Work streamed inside a response body | `safeDeferPromise` (`http/defer.ts`) | — |
| A dependency we have stopped calling | `breaker` (`resilience/breaker.ts`); it is **open** when calls are refused | `cooldown` outside the AI domain, `fuse`, `tripwire` |
| A cap on concurrent calls to one dependency | `bulkhead` (`resilience/bulkhead.ts`) | `pool`, `semaphore`, `throttle` |
| Refusing optional work under pressure | `shed` (`resilience/shedding.ts`, `admit()` returns a reason) | `drop`, `reject`, `throttle` |
| The remaining latency budget of a request | `Deadline` (`http/deadline.ts`); slices come from `child()` | `timeout`, `budget` on its own |
| The client having stopped listening to a response | `cancellation` (`startCancellation` in `http/cancellation.ts`: the body's `cancel()` joined with `request.signal`; `TurnHooks.signal`, `onCancellation`) | `abort` (the SDK's word for any fired signal, the timeout included), `disconnect`, `stop` on the server |
| Counting one request's database round trips | `QueryCensus` (`db/query-census.ts`) | `QueryLog`, `QueryTracker`, `QueryCounter` |
| The normalized form of a statement | `shape` (`queryShape`) | `fingerprint`, `signature`, `template` |
| Round trips one operation may make | `QueryBudget` (`db/query-budget.ts`) | `QueryLimit`, `QueryQuota` |
| One adverse condition, measured | `scenario` (`perf/scenarios.ts`) | `benchmark`, `case`, `situation` |
| Where each system runs | `LocalityRow` (`perf/locality.ts`) | `RegionMap`, `DeploymentMap` |
| An administrator's saved credentials + model for one AI vendor | `provider connection` (`ai.provider_connection`, `ProviderEntry` once loaded, `PublicProviderConnection` on the wire) | `AiSettings`, `ProviderConfig`, `ProviderCredentials` |
| The admin's generation probe against one provider/model | `connection test` (`ai/connection-test.ts`) | `health check`, `ping`, `verifyConnection` (that one is the showcases' backend probe) |
| An optimistic-concurrency counter on a row | `version` (`mcp.demo_state.version`, `ai.provider_connection.version`) | `revision` — which is a *stored snapshot row* (`blog.revision`, `desk` `fileRevision`), never a counter |
| AES-256-GCM over a caller-supplied key | `encryptAesGcm` / `decryptAesGcm` (`security/aes-gcm.ts`) | `notifications/crypto.ts` `encrypt`/`decrypt` |
| Catalog rows put in the prompt before generation for a "where is…" question | `navigation grounding` (`wantsNavigation`, `<catalog-results>`, the `navigation` capability) | `nav search`, `pre-search`, `catalog prefetch` |
| What the assembly hands the tools so they do not redo its work | `seed` (`docsSeed`, `catalogSeed` on `RetrievalToolOptions`) | `cache`, `prefetch`, `warm` |
| The rule that a tool-mounted turn's last allowed step answers | `answerOnLastStep` (`ai/policy/step-budget.ts`) | `finalStepNoTools`, `forceAnswer` |
| A turn's failure as the client receives it | `error frame` before any content (`aiErrorFrameText`, text `[kind] message`); `turnError` metadata after content (`TurnError` in `$lib/types/ai-error.ts`) | `streamError`, `partialError`, an `error` frame after text |
| What the status row says the live turn is doing | `turn progress` (`turnProgress` → `retrieving` · `catalog` · `generating`, `awaitingAnswer`; `composites/chatbot/turn-progress.ts`) | `typing indicator`, `loading label`, `phase` (taken by the panel's `open`/`minimized`) |
| One user message and the assistant message it produced | `turn` (`ai.turn`, keyed by the assistant `message_id`) | `exchange`, `round`, `request` (an HTTP request, or a provider request) |
| The recorded account of a turn — live-partial, persisted, or a recorded demo | `turn trace` (`TurnTrace`, `TurnTraceSnapshot`, `$lib/types/turn-trace.ts`; `createTurnRecorder` in `ai/trace/recorder.ts` is its one author) | `pipeline events`, `telemetry` (the usage columns alone), `probe` (a second run) |
| One provider request of a turn (attempt × step) | `model call` (`ai.model_call`, `ModelCallRecord`, `callStart`/`callEnd`) | `conversation_step`, `conversationStep`, bare `step` |
| One tool `execute` of a turn | `tool execution` (`ToolExecutionRecord`; the row stays `ai.tool_call`) | `tool run`, `invocation` |
| One provider of the turn's rotation, tried in order | `attempt` (`AttemptRecord`, `attemptStart`/`attemptEnd`; `streaming-turn.ts` `TurnAttempt`) | `retry`, `fallback` on its own |
| What the assistant is told about the user's situation (page, desk panels, layout, workspace, granted scopes, locale, visibility ceiling) | `awareness` (`TurnAwareness`; site-awareness and desk-awareness are its two surface profiles) | `environment` (collides with `$env` and the runtime environment), `context` on its own |
| Retrieved or indexed material a turn draws on | `grounding` (`GroundingSource` per corpus/index, `GroundingItem` per candidate, `GroundingSourceId`) | `knowledge`, `evidence`, `lane` per corpus |
| Where an item stands relative to the answer | `TurnItemState`: `available` → `considered` → `included` → `executed` → `cited` — inclusion never claims influence | `used`, `relevant`, `chosen` |
| The showcase section that opens one recorded turn | `turn inspector` (`/showcases/ai/{chatbot,deskbot}#orchestration`, `TurnInspector.svelte`, `TurnTree`/`TurnItemDetail`/`TurnSourcePicker`, the pure projection `$lib/showcases/ai/inspector.ts`) | `probe`, `x-ray`, `galaxy`, `context orchestration` (the old second-run section), `replay`/`TracePlayer` (the retired frame scrubber) |
| The proposal a deskbot turn stopped on, as its owner reads it back | `turn proposal` (`TurnProposal` on the trace's read side, resolved by `proposalId` through `resolveTurnProposal`; the inspector's `proposal` group) | `plan` on its own (the model's `desk_propose_plan` input), `approval` (the door, not the record) |
| One turn as the inspector reads it — the trace plus the question, the answer and the profile | `InspectedTurn` | `TurnFixture`, `ReplayTurn` |
| Where a shown turn came from | `provenance` (`TurnProvenance.kind`: `authored` · `recorded` · `live`; rendered by `ProvenanceBadge` — one chip and, where the reader is owed it, one sentence of gloss (`showcase_ai_prov_*`); never inferred) | `source` on its own (the spine's old `recorded`/`live` flag), `demo`, a `mode chip` for a turn |
| Renaming every id of a recorded turn to a `demo_` id before it becomes a fixture | `scrubTurn` (`$lib/showcases/ai/inspector.ts`; the recording script and the fixture test share it) | `anonymize`, `sanitize`, `redact` (the retention pass that empties bodies) |
| The upper description of one surface's assistant: identity + capabilities | `profile` (`AssistantProfile`, `ai/profile/<surface>.ts`, `PROFILES` by surface); its client-safe projection is the `profile manifest` (`AssistantProfileManifest`, `GET /api/ai/profiles/[surface]`) | `persona`, `agent config`, `system prompt` for the whole |
| Who an assistant is and the rules it always follows — the `<role>` + `<instructions>` block | `identity` (`AssistantIdentity`, `identityBlock()`; the shared tail is `shared-rules.ts`) | `SYSTEM_PROMPT`, `DESK_SYSTEM_PROMPT`, `persona` |
| One thing an assistant can do — tools, when-to-use guidance, activation rule, grounding lane, guide, verifier | `capability` (`AssistantCapability`, `ai/capabilities/<id>.ts`, `CapabilityId`; `TOOL_MANIFEST` names each tool's) | `skill`, `plugin`, `feature`, `tool group` |
| A capability's cache-stable when-to-use text vs. its on-demand detail | `guidance` (the `<id>-guidance` block, present whenever the capability is active) vs. `guide` (injected when its rule fires: `planning`, `page-abstention`, `tool-degrade`) | `instructions` for either (that is the identity's tag), `hint`, `tail` |
| Composing one turn from a profile: activations → grounding lanes → prompt in cache order → tools → step budget | `composeTurn` (`ai/profile/profile.ts`; `TurnInput` in, `TurnComposition` out, `TurnState` shared by the capabilities) | `assembleChatbotContext`, `buildSystemPrompt`, `buildSystemPromptBlocks`, `createDeskTools`, `buildRetrievalTools`, `stepsForScopes` |
| A per-turn rule that decided what the turn could do | `activation` (`Activation` with `id: CapabilityId` — a capability's `activates(turn)` verdict; a lane may revise it) | `ActivationId`, `gate` (the approval gate keeps that word), `flag` |
| One block of the assembled system prompt, with its text | `PromptBlock` (`id` from the one `PromptBlockId` union, `capability` = its owner, `section`: identity · guidance · grounding · awareness · guide, `stable`) | `AssembledBlock`, `SystemPromptBlock`, `PromptOutline` (viewer-only, retiring with the spine viewer) |
| A deterministic fact tying the answer to a grounding item | `citation` (`CitationRecord`, `match`: path · quote · provider_source · unsurfaced) | `verdict` (kept inside `verifyCatalogCitations`), `reference`, `paraphrase` (the hash-verified match of the retired wiki verifier) |
| The three-column picture of one turn — sources, context and model calls, tools — drawn from recorded relations only | `turn graph` (`TurnGraph`, `turnGraph()`, `$lib/showcases/ai/turn-graph.ts` — the projection; `turn-graph-layout.ts` — its geometry; `TurnGraphCanvas` / `TurnGraphList` / `TurnGraphCard` / `TurnGraphGroupNode` under the AI showcase's `_components/turn-graph/`) | `map`, `galaxy`, `x-ray`, `flow` on its own |
| One of the turn graph's three fixed columns | `column` (`TurnGraphColumn`: `sources` · `context` · `tools`) | `layer`, `lane`, `swimlane` |
| What an edge of the turn graph stands for | `TurnGraphEdgeKind`: `containment` (where a record sits) vs. the data-flow kinds `inclusion` · `request` · `execution` · `result` · `citation` | `link`, `relation` on its own, `invocation` |
| A turn-graph node drawn with its visible members inside it | `group` (`TurnGraphLayout.groups`, `TurnGraphGroupNode`; a card's `variant`: `card` · `header` · `row`) | `frame` (a stream frame), `container`, `cluster` |
| Where a turn-graph edge travels so it crosses no card | `gutter` (the space between two columns), `track` (one vertical run in a gutter), `rail` (a column's shared line for its own edges), `detour` (the run beneath the columns) — `routeEdges`, `EdgeRoute` | `lane` (retrieval and analytics own it), `channel`, `bus` in code |
| A page that shows the Vely thread in place of the dock | `embedded host` (`chatbotSession.embedded`, `attachEmbeddedHost()`; the chatbot showcase's `ChatbotExample`) | `inline chat`, `panel mode`, a fourth `ChatPhase` |
| The conversation projection the dock and the embedded host share | `ChatThread` (`composites/chatbot/ChatThread.svelte`) — the dock around it stays `Chatbot` | `ChatView`, `MessageList` |
| The inspector tracking the thread's newest turn | `follow` (`TurnInspectorState.follow`, `followLatest()`, `observeThread()`) | `auto-select`, `live mode`, `sync` |
| Where the live turn stands on the inspector | `InspectorStatus`: `recorded` · `idle` · `streaming` · `loading` · `ready` · `error` | `state` (the rune), `phase` (the panel's) |
| The tool calls whose results a provider request carried | `toolResultIds` (`ModelCallRequest`) — absent means not recorded, empty means none | `historyCount` as a proxy, `toolResults` |
| A chunk's place in its document, as a turn records it | `chunkPlace()` (`ai/capabilities/chunk-place.ts`): `parentId` · `level` (`ChunkLevel`) · `position` · `contentHash` · `path`; `retriever` (`RetrieverId`) per item, `retrievers` per source | `ancestry`, `depth` (a number), `tiers` on the source, `lineage` |
| The deterministic, ingest-built map of one collection's corpus — what it covers, without loading it | `corpus map` (`retrieval.corpus_map`, `getCorpusMap` / `countCorpusMaps` in `db/retrieval/queries.ts`; the chatbot's is the `project-map` capability, injected as `<project-overview>`) | `llmwiki` (the LLM-compiled pointer layer, retired 2026-09-12 — it had no writer and every fresh user's wiki was empty), `llmwiki_page`, `overview page`, `LlmwikiPage`, `loadOverview`, `get_llmwiki_pages`, `get_source_chunks` |

Two of these deserve their reasoning spelled out, because the losing name looked fine:

- **`channel`, not `provider`, for notification transports.** The database already says so:
  `notification_channel` is a persisted enum, and `notifications/router.ts` routes to
  channels. The code was the only place still calling them providers. `provider` now means
  exactly one thing — an AI model vendor.
- **`RetrievalCorpus`, not `RetrievalLayer` or `RetrievalStore`.** The module's own header
  calls these "the four corpora"; `RetrievalStore` was rejected because the type already has
  a `store` field naming the physical table each corpus lives in.
- **`CacheTier`, not `CacheLayer` or `CacheStore`.** `layer` is spoken for three times over
  (the seven-layer hierarchy, the component layer order, the z-order stack) and `store/` is
  R2 object storage. `tier` is already the pattern registry's word for a rung in a graded
  scale, which is exactly what this is; the two never meet.
- **`deferAfterResponse` beside `safeDeferPromise`.** Two lifetimes, two names.
  `safeDeferPromise` keeps a promise alive *inside* a streaming response body;
  `deferAfterResponse` runs work *after* the response is finished. Both were "deferral" and
  one file holding both is how a bucket starts.
- **`cooldown` stays inside the AI domain.** `ai/providers.ts` keeps `markCooldown` /
  `isCooledDown` because that is the word its surfaces already say — the admin models board,
  the desk provider list, the chat fallback log. The general mechanism is a `breaker`. One
  concept, two registers: the domain owns the vocabulary, `resilience/` owns the mechanism.
- **`Deadline`, not `timeout` or `budget`.** A `timeout` is a duration chosen for one call; a
  `Deadline` is a point in time the whole request shares, and the difference is the entire
  pattern. `budget` alone was rejected because `budgets.json` already owns it for performance
  targets — hence `budgetMs` as a field on a `Deadline`, never a type of its own.
- **`census`, not `log` or `tracker`.** A census counts a population once and reports totals;
  it does not retain what it counted. That is exactly the contract — `QueryCensus` keeps shapes
  and counts, never statements or parameters, so it can sit on every request without becoming
  a place personal data accumulates. `QueryLog` would promise a record that does not exist.
- **`shape`, not `fingerprint` or `signature`.** Both rejected names imply an identifier
  derived by hashing, and would make the collapse of parameter lists look like a collision
  rather than the deliberate rule it is. A shape is what is left when the values are removed.
- **`QueryBudget` alongside `budgets.json`.** Same word, same concept, different subject:
  `budgets.json` budgets *metrics*, `query-budget.ts` budgets *operations*. Keyed by a function
  name and meaningless without it, which is why it is a separate declaration rather than
  another section of the same JSON.

## Words that carry a metaphor

`lane`, `layer`, `surface`, `step`, `run` and `path` are cheap to reach for and expensive to
share. Each is spoken for:

- **`lane`** — the two documented two-lane product models (analytics: anonymous vs
  authenticated; search: static vs server) and nothing else. Retrieval uses `RetrieverId`,
  telemetry uses `TelemetryOrigin`, the trace uses `GroundingSourceId`.
- **`layer`** — the seven-layer abstraction hierarchy, the component layer order, and the UI
  z-order stack (`state/layer-stack.svelte.ts`). Not a retrieval or AI-pipeline term.
- **`surface`** — which part of the product something belongs to. `ai_surface`,
  `mcp_surface`, `user_surface` and `SearchSurface` are one concept applied to four
  subsystems, which is why they share the word: a search hit's surface (`page`, `showcase`,
  `doc`, `blog`) names the same kind of thing an `ai_surface` does.
  `layout/Surface.svelte` is the unrelated design-system sense (an elevated plane) and is
  safe because it never meets the other four.
- **`step`** — always qualified by its pipeline: `RetrievalStepId`, `IngestStepId`,
  `ProposedToolCall` (a persisted plan step), `ProposalCardStep` (as the card shows it),
  `ProposalStepReceipt` (as it ran). A bare `Step` is never right.
- **`path`** — a file path, a URL path, or a graph path. Not an axis: the retrieval step's
  engine is `engine`, and the retriever that produced a result is `retriever`.
- **`run`** — a job execution. A Neon branch action is a *branch operation*.
- **`path`, continued** — "critical path" stays PROSE. In code the three work classes are
  `criticalWork` / `deferredWork` / `backgroundWork`, because `path` already means a file,
  URL or graph path.
- **`tier`** — a rung in a graded scale: a pattern record's depth (`deep`/`light`) and a
  cache level (`local`/`shared`/`origin`). Not a synonym for layer, lane or surface.
- **`capability`** — a shared word, one concept, three subjects, always qualified:
  `ModelCapabilities` (what a **model** can do), the product capabilities under
  `docs/stack/capabilities/`, and `AssistantCapability` (what an **assistant** can do — the
  unit a profile is composed from, `ai/capabilities/`). A bare `Capability` is never right.
- **`profile`** — the per-surface variant of a shared thing: an *assistant* profile
  (`AssistantProfile`, the top), the *retrieval* profile (which corpus and tiers a surface
  asks the shared kernel for) and the *location-awareness* profile (site- vs desk-awareness)
  are the same word because each is one surface's reading of one mechanism; the last two are
  now capabilities inside the first.

## Discriminator columns

Three words, three jobs. The schema already follows this in most tables; new tables must.

| Column | Means | Examples |
|---|---|---|
| `kind` | This row is a fundamentally different *shape* of thing | `auth.grant.kind`, `ai.agent_proposal_step.kind`, `dbops.operation.kind` |
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

## Names the framework owns

- **Never name a Svelte prop `state`.** It collides with the `$state` rune and fails at
  compile time with `store_invalid_shape`. Use the thing's own name (`status`, `phase`,
  `layout`) — the collision is the only reason this generic word is off-limits.

## Before you add a name

1. Search for the concept first. If it exists under another name, use that one.
2. Search for the *name* you want. If it exists for another concept, pick a different word.
3. If the name needs a qualifier to be unambiguous, add one qualifier — not three.
4. Local variables are exempt. This file is about exported and architectural names.
