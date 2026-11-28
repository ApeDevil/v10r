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
| An anonymous analytics visit | `analytics.sessions` row | analytics-local `Session` type |
| An AI model vendor | `provider` | — |
| An external notification transport | `channel` | `NotificationProvider`, `notifications/providers/` |
| An infrastructure service we depend on | `dependency` | monitoring `ProviderStatus` / `ProviderResult` |
| A capability a pattern needs the target project to run (relational database, key-value store, …) | **infrastructure need** (`InfrastructureNeed`, `INFRASTRUCTURE_NEEDS` in `pattern-library/schema.ts`; a record's `needs`) — named for the capability, never the product; v10r's product is the need's **binding** | `requires` / `PATTERN_REQUIREMENTS`, `requirement` (that word is retired for workload profiles too), product words as needs (`postgres`, `redis`, `cron`, `ai-provider`, `third-party-api`) |
| How strictly a pattern needs one | **need level**: `required`, `conditional` (with `when`), `optional` (with `why`), `implementation` (v10r's reference uses it, the pattern does not; with `why`) | `soft`/`hard` requirement, "nice to have" |
| A need that only one technology satisfies | a **pin** (`pinned`, with `why`) | `locked`, `hard dependency` |
| A technology a target names instead of a capability (`postgres`, `redis`) | **technology** (`TECHNOLOGY_NEED`); `target_infra` accepts need ids and technologies | `vendor`, `provider` (that is an AI model vendor) |
| What a registry record is, and what adopting it means | **entity kind** (`kind`, `ENTITY_KINDS`, `ADOPTION_SEMANTICS` in `pattern-library/schema.ts`): `pattern` (build it), `principle` (apply it), `workflow` (perform it) | `type`, `category` (that is navigation), "pattern" for a record that is a principle or workflow; implementation inventories, documentation views and showcases are not kinds — they are refs and evidence of a pattern |
| A registry record's identifier | the concept's name in kebab-case — never the taxonomy location (no category prefix) or a product name; renamed without aliases, every change in `pattern-library/reconciliation/manifest.json` | `architecture-…`, `ui-…`, `databases-…` prefixes, old ids kept as redirects |
| The registry's content identity | **registry digest** (`registryDigest`, `pattern-library/registry-digest.ts`); the schema shape is the registry **format** (`REGISTRY_FORMAT`) | registry `version` (a hand-bumped string that never moved with the content) |
| The person who runs a deployment: Impressum provider, GDPR controller, DSA contact point | `siteOperator` (`#lib/server/legal`) | hard-coded identities on each legal page |
| The placeholder controller the privacy showcase renders instead of a real identity | `templateController` (`#lib/showcases/privacy`) | — |
| A job execution | `run` (owned by `jobs/`) | — |
| A Neon branch maintenance action | `branch operation` | `dbops` `Run*` |
| Which retriever produced a result | `RetrieverId` (field `retriever`) | `RetrieverLane` (field `lane`) |
| Which corpus a chunk came from | `RetrievalCorpus` | `RetrievalLayer` |
| Which build emitted a telemetry sample | `TelemetryOrigin` | `TelemetryLane` |
| Anonymous vs authenticated analytics | `lane` | — |
| A step-by-step pattern for real work, published as a tutorial at `/workflows/<slug>` | `workflow` (`WorkflowCard`, `#lib/workflows/catalog.ts`; tutorial bodies at `content/workflows/<category>/<slug>/<locale>.md`; i18n prefix `workflow_`), its downloadable example job folder `starter folder` (`buildStarterFolder`, `<slug>/starter/<locale>/`) and its hub section `workflow category` (`WorkflowCategoryId`: `office`, …) | a `showcase` (that is a live feature demo), `recipe` (that is the PIM transform recipe) |
| The brand-name pre-screen | `name check` (`server/name-check/`, `/showcases/name-check`, `/api/name-check`, `showcase_name_check_*`) | `clearance`, `brand search`, `viability` |
| One upstream the name check asks | `NameSource` (`name-check/sources/*.ts`) | `adapter` (that is `*.adapter.ts`), bare `source` |
| What a live name source's search reads that can change its answer — the result cache's key | `searchInputs` on `LiveNameSource` | `cacheIdentity` (`identity` is the assistant's), `fingerprint`, `derivation key` (that one is stored beside a derived output) |
| What a name source found | `NameMatch`, discriminated on `kind` (`trademark` · `company` · `domain` · `web`) | `sourceType`, `hit`, `result` |
| How far each name source got | `NameCheckCoverage` (`NameCoverageStatus`) | `availability`, `health` |
| The evidence summary of a name check | `NameConflictSignal` (`level` + `reasons`) | `risk score`, `verdict`, `safety` |
| A record's origin vs the user's scope | `jurisdiction` (on `NameMatch`) vs `territory` (on the query) | `region`, `market` |
| A sanitized client-facing projection | `Public<Concept>` | `<Concept>DTO` |
| The member area | `account` | `app`, `me` |
| What a visitor or user sends from `/feedback`, and its lifecycle | `feedback` (`#lib/server/feedback/`, `feedback.feedback`; the brief's "request" is not a code name — it already means an HTTP request, a `request id`, a `grant request`) | `request`, `ticket`, `issue` |
| What a piece of feedback is about | `category` (`FEEDBACK_CATEGORIES`: `feature` · `bug` · `improvement` · `general`) | `type`, `kind` (the shape is the same) |
| Where a piece of feedback stands | `status` (`FEEDBACK_STATUSES`, 8 states; `closed` carries a `close reason`: `rejected` · `duplicate` · `archived`); what the submitter sees is the coarse `submitter status` | `state` as a prop, `stage` |
| An admin's decision on untriaged feedback | `triage action` (`applyTriageAction`, `TRIAGE_TRANSITIONS`) | `transition` alone as a type name, `workflow` (that is `/workflows`) |
| The one development state at a time | `development slot` (`ACTIVE_DEVELOPMENT_STATUSES`, index `feedback_one_active_development_idx`) | `lock`, `lease` |
| What account erasure keeps of feedback that held engineering state | `engineering shell` (`ENGINEERING_STATUSES`, `erased_at`) | `tombstone` (that is retrieval's soft-delete), `anonymized` |
| An item's engineering record from Gate 1 on (branch, scope, report, release) | `development record` (`feedback.development`, `approveDevelopment`; Gate 1 is `development approval`, Gate 2 is `release approval`) | `ticket`, `job` (that is `#lib/server/jobs/`), `task` |
| What Gate 1 hands the maintainer to paste into a coding session | `development brief` (`renderDevelopmentBrief`) | `prompt` (that is the AI chat's), `instructions` |
| The agent's pasted account of its work | `implementation report` (`v10r-implementation-report/1`, `parseImplementationReport`); its claims are reported evidence, not verification | `result`, `attestation` |
| What Gate 2 hands the maintainer as the ship instruction | `release handoff` (`renderReleaseHandoff`) | `release brief`, `deploy order` |
| The ship script's pasted record of a ship | `shipping receipt` (`v10r-shipping-receipt/1`, `parseShippingReceipt`); not an authenticated attestation | `ship report` (that is the ship skill's prose), `proof` |
| How a release was confirmed | `release verification` (`live_version` · `maintainer`) | `verified` alone |
| One Gate 1 approval of an item, with its own branch | `development attempt` (`attempt`, `development_attempts`; branch suffix `-a<attempt>` from the second) | `run`, `try`, `iteration` |
| Which recorded report Gate 2 approves | `report revision` (`report_revision`, bumped per report) | `version` (that is the app version) |
| A report claim that rules a normal release out | `release blocker` (`releaseBlockers`, refusal `not_releasable`) | `gate failure` (the gate is the ship's) |
| The submitter's opt-in diagnostics | `technical context` (`FeedbackTechnicalContext`, `includeContext`) | `metadata`, `telemetry`, `diagnostics` |
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
| Anything the model may ask the application to do | `agent action` — a `TOOL_MANIFEST` entry; in code it stays a `tool` (`ToolDescriptor`) | `command`, `intent`, `operation` as a type name, a second `ActionRegistry` |
| Where an agent action runs | `executor` (`ToolExecutor`: `server` · `client`) | `surface` (that is which product part a tool belongs to), `side`, `target`, `runtime` |
| An agent action the user's browser executes and answers for | `client action` (`#lib/client-actions/`: `ClientActionContract`, `ClientActionResult`, `ClientActionRunner`, `ClientActionHandler`; `readClientActionResults` on the server) | `frontend tool`, `UI action`, `browser command`, `desk effect` (that is a server tool's consequence, with no result) |
| The risk of changing what is shown without changing stored data | `view` (`ToolRisk`) | `ui`, `navigate`, `ephemeral`, `safe` |
| The Desk's client actions, their scope and their capability | `arrange` (`desk:arrange`, `desk-arrange`, `DESK_ARRANGE_ACTIONS`, `mountArrangeHandlers`) | `layout` (the persisted tree owns it), `navigate`, `control`, `desk:view` |
| The three facts about a client action that are never merged | `requested` → `executed` → `confirmed`; only the status `completed` means all three | `dispatched`, `sent`, `done`, `success` as a status |
| The request that carries client action results back into the same turn | `continuation` (`ClientActionReading.continuation`) | `resume` (the retired proposal resume turn), `follow-up`, `round trip` as a name |
| A typed, declarative description of a solid — parameters, operations, outputs — that an assistant writes instead of code | `parametric model` (`ParametricModel`, `#lib/schemas/parametric-model.ts`; generator id `parametric-model`) | `scene`, `script`, `design`, `CAD model` |
| The ordered operations of a parametric model, each referencing only earlier ids | `feature graph` (`operations`; one `operation`, discriminated on `op`) | `node graph`, `steps`, `commands` |
| A shareable URL whose fragment carries a whole parametric model (`m1.` + base64url deflate) | `model link` (`encodeModelLink`, `decodeModelLink`, `/3d/view#…`) | `share id`, `permalink`, `model id` (nothing is stored to refer to) |
| The stateless parametric modeling MCP service at `/api/mcp/3d` | `MCP 3D` (identity `v10r-mcp-3d`; registry `modelingRegistry`) | `3D MCP`, `CAD MCP`, a Pattern MCP tool |
| The compact quantized mesh an MCP App draws when it cannot run the kernel | `preview mesh` (`encodePreviewMesh`, format `v10r-preview-mesh@1`) | `thumbnail`, `lod`, `proxy mesh` |
| The signed record that lets the AG-UI endpoint admit its own server tool result when a client replays it | `tool result ticket` (`issueToolResultTicket` / `checkToolResultTicket`, `ai/ag-ui/tool-result-ticket.ts`; carried as the `TOOL_CALL_RESULT` `messageId`; a `security/ticket.ts` ticket) | `seal` (that is encryption), `receipt` (that is a proposal step's outcome), `signature` as the name |
| One AG-UI request and its event stream | `AG-UI run` — always qualified, the protocol's word (`AgUiRun`, `readAgUiRunInput`, `serveAgUiRun`, inside `ai/ag-ui/`); a bare `run` stays the job execution | `turn` for the AG-UI side (the turn is the orchestrator's, which the run carries) |
| The step after which a deskbot turn stops for a decision | `approval boundary` (`stoppedAtApproval`) | — |
| How an approved step is undone | `recovery` (`ProposalStepRecovery`: `revision`/`soft_delete`/`rename_back`/`created`/`none` — the same kinds a `StepRecoveryPoint` carries) | model-authored `rollback` text |
| What undoing one executed step needs, captured when it ran | `recovery point` (`StepRecoveryPoint`, column `agent_proposal_step.recovery`) | `rollback data`, `snapshot` (that is a `revision`) |
| Undoing a plan that ran, and its per-step evidence | `revert` (`revertProposal`, `revert_status`, `POST …/revert`) and `revert receipt` (`agent_proposal_revert_step`) | `rollback` (there is none — compensation is not atomic), `undo` as a type or route name (it is the button's word) |
| The database or transaction a domain mutation runs on | `handle` (`DbHandle`) | — |
| What the daily cron sweep runs | `jobsDueOn` (`/api/cron/due`) | one `vercel.json` entry per job |
| The MCP demo-state domain module | `src/lib/server/mcp/demo/state.ts` | `mcp/demo/service.ts` |
| The registry of pattern MCP *tools* | `src/lib/server/mcp/patterns/tools.ts` | `mcp/patterns/registry.ts` |
| The one bridge from a tool registry to the official MCP SDK server, shared by stdio and HTTP | `tool server` (`mcp/tool-server.ts`, `createToolServer`; a surface's self-description is `McpServerIdentity`) | `transport` (the SDK owns the transports), `protocol layer`, `mcp/protocol*.ts` (the retired hand-written modules) |
| The stdio server with the SDK inlined, the file the container runs | `stdio bundle` (`mcp/server.bundle.js`, built from `mcp/stdio-server.ts`, started by the registered entry `mcp/server.ts`; `mcp:bundle:build` / `mcp:bundle:check`) | `dist/`, `build` |
| The showcase Redis key namespace | `SHOWCASE_CACHE_PREFIX` / `assertShowcaseCacheKey` | cache-local `SHOWCASE_PREFIX` |
| The design system's icon size scale | `iconSize` (`styles/tokens.ts`) | sidebar-local `iconSize` |
| The sidebar's computed icon width | `sidebarIconSize` | `iconSize` |
| Formatting a date for a reader | `formatDate(date, locale)` from `#lib/i18n` | five page-local `formatDate`s |
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
| A separately deployed process the app calls over HTTP | `external service` — first-party or a vendor's; the reference is `services/runtime-lab`, shown at `/showcases/external-service`, recorded as `external-service-runtime` | `sidecar` (the JSONB i18n column), `microservice`, `upstream` as a type, `dependency` (infrastructure we run on) |
| The deployed reference external service | `runtime lab` (`services/runtime-lab`, binary and compose service `runtime-lab`, Render `v10r-runtime-lab`) — named for its role, a second runtime v10r runs and measures; the domain it evaluates is order-lifecycle rules (`order.rs`). The *External Service Lab* is the showcase page that calls it | `order-rules` (that names the domain it evaluates, not the deployable), `sidecar` |
| One named, server-configured place an external service is reached | `service target` (`ServiceTargetId` = `local` · `remote`; `ResolvedServiceTarget` with `setup` = `configured` · `unconfigured` · `misconfigured`) | `environment` (`$app/env`, GitHub environments), `endpoint`, `host` |
| How one external-service call ended | `ServiceCallOutcome` = `ok` · a `ServiceFailureKind` · `unconfigured` · `misconfigured` (nothing sent) | `status` (that is the service's `/v1/status`), `health`, `error` |
| The correlation value one call carries across processes | `request id` (`x-request-id` header, `requestId` field; the same concept as `ai.turn.request_id`) — not `auth/grant-requests.ts`'s `requestId`, which is a grant-request row id | `correlationId`, `traceId` (OpenTelemetry's word) |
| The app-side code that calls one external service | `service client` (`callService` in `client.ts`; its overhead is `clientMs`) | `adapter` (that is `*.adapter.ts`, the env reader beside it), `gateway`, `proxy` |
| A named, server-owned request body the lab can send | `preset` (`EvaluationPresetId`, `EVALUATION_PRESETS`) | `scenario` (that is `perf/scenarios.ts`, one adverse condition) |
| A service build's semantic version | `release` (`StatusResponse.release`, Cargo's version = the spec's `info.version`; `CONTRACT_RELEASE` is the one this app was built against) — names the contract too: releases sharing major.minor share one contract | `version` (the optimistic-concurrency counter) |
| Release → contract digest, append-only | **contract release record** (`services/runtime-lab/contract-releases.json`, `releaseRecordProblems`) | `changelog`, `version history`, `lockfile` |
| How a running service's contract relates to the app's | **contract skew** (`ContractSkew` = `none` · `service_ahead` · `service_behind` · `breaking` · `unknown`; `contractSkew()`) — a diagnosis, never a gate | `compatibility check`, `version mismatch`, `drift` (that is the build-time mirror check, `contractDrift()`) |
| The service credential being rotated out, still accepted | `SERVICE_TOKEN_PREVIOUS` — the key ring's `_PREVIOUS` convention | `SERVICE_TOKEN_NEXT`, `OLD_TOKEN` |
| The top-level workspace for engineering a system before building it | **Studio** (`/studio`, `#lib/studio/catalog.ts`); its sections are **Studio areas** (`StudioArea`), each with **modes** (`StudioMode`) | `tools`, `lab` (that is a measured experiment), `workbench` |
| The first Studio area: the decision discipline for where work runs, how parts talk, where data lives and how it ships | **Architecture Engineering** (`pattern-library/architecture-engineering/`, `/studio/architecture`, registry `architecture-engineering`) | `architecture advisor`, `architecture AI` |
| One versioned architectural decision with its alternatives, ordered rules and evidence | **decision record** (`ArchitectureDecision`, catalogue `decisions.json`, `DECISION_CATALOG`) — after ADR/MADR | `ADR` in code, `policy`, `strategy` |
| The facts a recommendation is computed from | **workload profile** (`WorkloadProfile`, factors `WORKLOAD_FACTORS`, value `unknown` = not known); a named one is a **workload example** (`WORKLOAD_EXAMPLES`) | `scenario` (that is `perf/scenarios.ts`), `preset` (the runtime lab's request bodies), `requirements` |
| What Explore returns for one decision | `DecisionOutcome` (`basis` = `rule` · `fallback`), all of them an `ArchitectureRecommendation` | `evaluation` (the runtime lab's word), `score`, `verdict` |
| The editable description of a system's components, zones and connections | **architecture model** (`ArchitectureModel`; positions live apart in `ArchitectureLayout`; on disk an `ArchitectureFile`) — always qualified, because a bare `model` is an AI model | `diagram` (that is the projection), `graph`, `topology` |
| A deployable or managed part in an architecture model | **component** in copy, `ArchitectureNode` (kind `NodeKind`) in code — `node` is xyflow's word for its rendering | `service` (that is one kind of component), `box` |
| A static check result on an architecture model | `ArchitectureFinding` (code, fixed `FindingSeverity`, `FindingCategory` with `security` apart) | `CompositionDiagnostic` (that is the 3D product-composition word), `lint`, `issue` (that is a parser `ModelIssue`) |
| A model derived from another, with the reason recorded | **variant** (`deriveVariant`, `derived_from`, `change_reason`); the original is its **baseline** | `fork`, `branch` (that is a Neon branch), `version` |
| A v10r experiment that measures an architectural trade-off, or the stated gap where none exists | **evidence lab** (`EVIDENCE_LABS`) | `benchmark` (one lab is not a benchmark suite), `scenario` |
| A deliberate, labelled failure demonstration | `drill` (`ServiceDrillId`) — changes only what the caller sends | `fault injection`, `chaos`, `simulation` |
| A rule's "no" to a valid request | `refusal` (`RuleRefusal`, `outcome: "refused"`) — an answer, not an error; a submission the lab turns away before calling anything is a `rejection` (`LabRejection`) | `error` for either |
| An administrator's saved credentials + model for one AI vendor | `provider connection` (`ai.provider_connection`, `ProviderEntry` once loaded, `PublicProviderConnection` on the wire) | `AiSettings`, `ProviderConfig`, `ProviderCredentials` |
| An administrator's saved credentials for one external name-check vendor | `source connection` (`name_check.source_connection`, `NameSourceConnection` once opened, `PublicNameSourceConnection` on the wire) | `provider connection` (that is the AI one), `NameCheckSettings`, `SourceCredentials` |
| One external company behind a name source | `vendor` (`NameSourceVendor` = `euipo` · `tavily` · `brave`; `webSearchVendor` picks one) | `provider` (an AI model vendor, exactly one thing) |
| The admin's probe of one saved or draft connection | `connection test` (`ai/connection-test.ts` for a provider/model, `name-check/connection-test.ts` for a vendor) | `health check`, `ping`, `verifyConnection` (that one is the showcases' backend probe) |
| An optimistic-concurrency counter on a row | `version` (`mcp.demo_state.version`, `ai.provider_connection.version`, `name_check.source_connection.version`) | `revision` — which is a *stored snapshot row* (`blog.revision`, `desk` `fileRevision`), never a counter |
| AES-256-GCM over a caller-supplied key | `encryptAesGcm` / `decryptAesGcm` (`security/aes-gcm.ts`) | `notifications/crypto.ts` `encrypt`/`decrypt` |
| A sealed secret's state under the deployment's key ring | `KeyStatus` `none` · `ready` · `undecryptable` (`openSecret` in `security/aes-gcm.ts`; one declaration for every table that holds an envelope) | `SecretStatus`, `keyState` |
| What a person typed into a form, kept in the browser until they submit | **form draft**: `createFormDraftStore` (`state/form-draft.ts`), `createFormDraft` (`state/form-draft.svelte.ts`); a stored draft that differs is an **offer** (`DraftRecoveryNotice`) | `autosave` (that is the desk's server save queue), `form snapshot` (SvelteKit's `snapshot` is history-scoped) |
| Asking before a navigation that would lose work | **leave guard**: `guardUnsavedChanges`, `leaveDecision` (`state/leave-guard.svelte.ts`) | `unsaved-changes prompt`, `beforeunload handler` |
| Where the content of a tool's result comes from | **result origin**: `ToolResultOrigin` `system` · `user` (`TOOL_MANIFEST.resultOrigin`, `resultOriginOf`) | `trust level`, `taint` |
| Whether a tool can move data out of the deployment | **reach**: `ToolReach` `internal` · `external` | `egress`, `network access` |
| A user-origin tool result as the model reads it | **untrusted-content boundary**: `<untrusted-content source="…">`, `wrapUntrusted`, `withUntrustedBoundary`, `boundHistoryToolResults` (`ai/untrusted-content.ts`) | `sanitizer` (that is `utils/markdown.ts`), `quarantine` |
| A question with the facts its recorded turn must show | **eval case** (`EvalCase`, `ai/eval/eval-case.ts`); the committed set is the **golden set** (`golden-cases.json`) | `test prompt`, `benchmark` (that is `pattern-library/bench/`, retrieval accuracy) |
| One deterministic check of a recorded turn | **grader** (`grade`, `ai/eval/graders.ts`) over a `GradedTurn` | `judge` (a model grading a model, which v10r does not do) |
| The pass rate an eval run must hold | **floor** (`baseline.json`, `checkFloor`) — a ratchet like the perf ceilings | `threshold`, `target` |
| Search params read and written through one typed spec | **URL state**: `UrlParam`, `urlParam.*` codecs, `readUrlState` / `writeUrlState` / `urlStateHref` (`state/url-state.ts`); `createUrlState` with write mode `navigate` · `shallow` (`state/url-state.svelte.ts`); a route's spec is `<page>ListParams` in `list-params.ts` | `query state`, `search state`, `syncUrl`, `buildUrl` |
| The keys a deployment opens envelopes with — `ENCRYPTION_KEY` seals, `ENCRYPTION_KEY_PREVIOUS` only opens | **key ring**: `EncryptionKeyRing` (`security/aes-gcm.ts`), read once by `getEncryptionKeyRing()` | `keychain`, `keyset`, `key store` |
| The 8-hex fingerprint an envelope names its key by | **key id** (`kid`, `keyIdOf`) | `key version`, `key name` |
| Moving envelopes onto the current key | **re-seal**: `resealEnvelope`, `resealEnvelopes`, job `encryption-reseal` | `re-encrypt`, `rotate` (rotation is the operator's ring change; the job only re-seals) |
| Catalog rows put in the prompt before generation for a "where is…" question | `navigation grounding` (`wantsNavigation`, `<catalog-results>`, the `navigation` capability) | `nav search`, `pre-search`, `catalog prefetch` |
| What the assembly hands the tools so they do not redo its work | `seed` (`docsSeed`, `catalogSeed` on `RetrievalToolOptions`) | `cache`, `prefetch`, `warm` |
| The rule that a tool-mounted turn's last allowed step answers | `answerOnLastStep` (`ai/policy/step-budget.ts`) | `finalStepNoTools`, `forceAnswer` |
| A turn's failure as the client receives it | `error frame` before any content (`aiErrorFrameText`, text `[kind] message`); `turnError` metadata after content (`TurnError` in `#lib/types/ai-error.ts`) | `streamError`, `partialError`, an `error` frame after text |
| What the status row says the live turn is doing | `turn progress` (`turnProgress` → `retrieving` · `catalog` · `generating`, `awaitingAnswer`; `composites/chatbot/turn-progress.ts`) | `typing indicator`, `loading label`, `phase` (taken by the panel's `open`/`minimized`) |
| One user message and the assistant message it produced | `turn` (`ai.turn`, keyed by the assistant `message_id`) | `exchange`, `round`, `request` (an HTTP request, or a provider request) |
| The recorded account of a turn — live-partial, persisted, or a recorded demo | `turn trace` (`TurnTrace`, `TurnTraceSnapshot`, `#lib/types/turn-trace.ts`; `createTurnRecorder` in `ai/trace/recorder.ts` is its one author) | `pipeline events`, `telemetry` (the usage columns alone), `probe` (a second run) |
| One provider request of a turn (attempt × step) | `model call` (`ai.model_call`, `ModelCallRecord`, `callStart`/`callEnd`) | `conversation_step`, `conversationStep`, bare `step` |
| One tool `execute` of a turn | `tool execution` (`ToolExecutionRecord`; the row stays `ai.tool_call`) | `tool run`, `invocation` |
| One provider of the turn's rotation, tried in order | `attempt` (`AttemptRecord`, `attemptStart`/`attemptEnd`; `streaming-turn.ts` `TurnAttempt`) | `retry`, `fallback` on its own |
| What the assistant is told about the user's situation (page, desk panels, layout, workspace, granted scopes, locale, visibility ceiling) | `awareness` (`TurnAwareness`; site-awareness and desk-awareness are its two surface profiles) | `environment` (collides with `$app/env` and the runtime environment), `context` on its own |
| Retrieved or indexed material a turn draws on | `grounding` (`GroundingSource` per corpus/index, `GroundingItem` per candidate, `GroundingSourceId`) | `knowledge`, `evidence`, `lane` per corpus |
| Where an item stands relative to the answer | `TurnItemState`: `available` → `considered` → `included` → `executed` → `cited` — inclusion never claims influence | `used`, `relevant`, `chosen` |
| The showcase section that opens one recorded turn | `turn inspector` (`/showcases/ai/{chatbot,deskbot}#orchestration`, `TurnInspector.svelte`, `TurnTree`/`TurnItemDetail`/`TurnSourcePicker`, the pure projection `#lib/showcases/ai/inspector.ts`) | `probe`, `x-ray`, `galaxy`, `context orchestration` (the old second-run section), `replay`/`TracePlayer` (the retired frame scrubber) |
| The proposal a deskbot turn stopped on, as its owner reads it back | `turn proposal` (`TurnProposal` on the trace's read side, resolved by `proposalId` through `resolveTurnProposal`; the inspector's `proposal` group) | `plan` on its own (the model's `desk_propose_plan` input), `approval` (the door, not the record) |
| One turn as the inspector reads it — the trace plus the question, the answer and the profile | `InspectedTurn` | `TurnFixture`, `ReplayTurn` |
| Where a shown turn came from | `provenance` (`TurnProvenance.kind`: `authored` · `recorded` · `live`; rendered by `ProvenanceBadge` — one chip and, where the reader is owed it, one sentence of gloss (`showcase_ai_prov_*`); never inferred) | `source` on its own (the spine's old `recorded`/`live` flag), `demo`, a `mode chip` for a turn |
| Where any value came from — entity, producing activity, agent | `provenance` (the general concept; `TurnProvenance` and `fieldProvenance` are instances, see `docs/blueprint/integrity/derivation.md#provenance-record`) | `lineage` (spoken for — rejected for chunk ancestry), `origin` as a type name |
| The freshness key of a derived output | `derivation key` (`derivationKey(transform, inputs)` in `db/content-hash.ts`; column `derivation_key`) | `cache key` (that is `cacheKey` in `server/cache/`), `fingerprint` on its own, a `--force` flag |
| Renaming every id of a recorded turn to a `demo_` id before it becomes a fixture | `scrubTurn` (`#lib/showcases/ai/inspector.ts`; the recording script and the fixture test share it) | `anonymize`, `sanitize`, `redact` (the retention pass that empties bodies) |
| The upper description of one surface's assistant: identity + capabilities | `profile` (`AssistantProfile`, `ai/profile/<surface>.ts`, `PROFILES` by surface); its client-safe projection is the `profile manifest` (`AssistantProfileManifest`, `GET /api/ai/profiles/[surface]`) | `persona`, `agent config`, `system prompt` for the whole |
| Who an assistant is and the rules it always follows — the `<role>` + `<instructions>` block | `identity` (`AssistantIdentity`, `identityBlock()`; the shared tail is `shared-rules.ts`) | `SYSTEM_PROMPT`, `DESK_SYSTEM_PROMPT`, `persona` |
| One thing an assistant can do — tools, when-to-use guidance, activation rule, grounding lane, guide, verifier | `capability` (`AssistantCapability`, `ai/capabilities/<id>.ts`, `CapabilityId`; `TOOL_MANIFEST` names each tool's) | `skill`, `plugin`, `feature`, `tool group` |
| A capability's cache-stable when-to-use text vs. its on-demand detail | `guidance` (the `<id>-guidance` block, present whenever the capability is active) vs. `guide` (injected when its rule fires: `planning`, `page-abstention`, `tool-degrade`) | `instructions` for either (that is the identity's tag), `hint`, `tail` |
| Composing one turn from a profile: activations → grounding lanes → prompt in cache order → tools → step budget | `composeTurn` (`ai/profile/profile.ts`; `TurnInput` in, `TurnComposition` out, `TurnState` shared by the capabilities) | `assembleChatbotContext`, `buildSystemPrompt`, `buildSystemPromptBlocks`, `createDeskTools`, `buildRetrievalTools`, `stepsForScopes` |
| A per-turn rule that decided what the turn could do | `activation` (`Activation` with `id: CapabilityId` — a capability's `activates(turn)` verdict; a lane may revise it) | `ActivationId`, `gate` (the approval gate keeps that word), `flag` |
| One block of the assembled system prompt, with its text | `PromptBlock` (`id` from the one `PromptBlockId` union, `capability` = its owner, `section`: identity · guidance · grounding · awareness · guide, `stable`) | `AssembledBlock`, `SystemPromptBlock`, `PromptOutline` (viewer-only, retiring with the spine viewer) |
| A deterministic fact tying the answer to a grounding item | `citation` (`CitationRecord`, `match`: path · quote · provider_source · unsurfaced) | `verdict` (kept inside `verifyCatalogCitations`), `reference`, `paraphrase` (the hash-verified match of the retired wiki verifier) |
| The three-column picture of one turn — sources, context and model calls, tools — drawn from recorded relations only | `turn graph` (`TurnGraph`, `turnGraph()`, `#lib/showcases/ai/turn-graph.ts` — the projection; `turn-graph-layout.ts` — its geometry; `TurnGraphCanvas` / `TurnGraphList` / `TurnGraphCard` / `TurnGraphGroupNode` under the AI showcase's `_components/turn-graph/`) | `map`, `galaxy`, `x-ray`, `flow` on its own |
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
| Capability nested by meaning and revealed as intent becomes specific — on one page, and across a user's journey — plus the structure it recommends and the method that reviews for it | `Explosive Discovery` (the principle: `docs/foundation/explosive-discovery.md`; the review method: `docs/blueprint/design/explosive-discovery.md`, registry `explosive-discovery`); `Nested Depth` (the structure: directions that narrow intent, detail on entry) | `Progressive Revelation`, `ProgRev`, `progressive-revelation` (the planned journey-stage feature — absorbed 2026-09-20 as the journey axis of Explosive Discovery; the blueprint with its unbuilt schema was deleted). `progressive disclosure` is not retired: it stays the design *intent*, principle 3 in `design/README.md` |
| A card whose actions rest neutral and take their colour when the user engages it (hover, focus, touch tap), with depth opened only on purpose | `Latent Cards` (the pattern: `docs/blueprint/design/latent-cards.md`, registry `latent-cards`); `LatentCard` (`composites/latent-card/`); the card is `engaged`, its actions `latent` at rest; a touch tap `pins` it (`data-pinned`, `nextPinned`); on touch the card nearest the screen's center is `centered` (`data-centered`, `pickCenteredCard`, `trackCenterEngagement`); levels: card · latent actions · `depth` | `hover card` (a preview popover, another component), `reveal`, `awake`, `active` (the selected-item word), `disabled` for a resting action |
| Work kept only on this device that a sign-out would erase (today: undelivered spreadsheet and record drafts) | `unsaved work` (`UnsavedWork`, `#lib/state/unsaved-work.ts`; drained → confirmed → discarded) | — |
| A record whose labelled, typed facts its user defines at runtime, the definitions stored beside the values | `self-describing record` (`AttributeRecord`, `#lib/dynamic-attributes/`); the pattern is **Dynamic Attributes**; on the desk the file type `record` (`desk.record`, Drizzle `deskRecord`, ids `rcd_`) | `custom fields`, `properties`, `metadata`, `entity`, `record` for the Drizzle export (collides with TS `Record` and Valibot `v.record`) |
| One labelled, typed value of a self-describing record | `attribute` (`Attribute`: `id` `att_…`, `label`, `kind`, `value`, `config`, `previous`); identity is the id, the label is display text | `field` (forms' and Drizzle's word), `property`, `key` |
| The registered type of an attribute: its config, accepted values, text form and conversion | `attribute kind` (`AttributeKind`, field `kind`; `createAttributeKindRegistry`, `CORE_ATTRIBUTE_KINDS`); an application's own kinds take a prefix (`app.rating`) | `type` (TypeScript's), `field type`, `widget` (that is the control, `AttributeControl`) |
| The shared, revisioned set of attribute definitions many records bind to | `attribute dictionary` (`AttributeDictionary`, `#lib/dynamic-attributes/dictionary.ts`); one entry is an `attribute definition` (`AttributeDefinition`, ids `def_…`, `labels` per locale, `status` active · deprecated · retired); one step of its history a `dictionary revision` (`DictionaryRevision`, `reviseDictionary`) | `schema` (Valibot's and the database's), `template` (retired), `catalog` (the navigation catalog's), `glossary`, `version` (the record's concurrency counter) |
| An attribute's link to its definition | `binding` (`AttributeBinding`: `definition`, `revision`); a bound attribute vs a `local` one; `bindAttribute`, `unbindAttribute`, `syncRecordToDictionary`, `promoteAttribute` | `link`, `reference` (a future kind), `inherit` |
| How one consumer reads records: which definitions, under which names and paths, with which typed steps and render hints, pinned to a dictionary revision | `attribute projection` (`AttributeProjection`, `projectRecord` → `Projection`; one step a `ProjectionStep`; the `pin` is `dictionaryRevision`; `checkProjectionImpact` → `ProjectionImpact`); its reader is a `consumer` | `channel` (a notification transport), `mapping` (too vague), `view`, `transform recipe` (the PIM's sheet-to-sheet ops) |
| What one attribute held across a record's stored versions | `value history` (`valueHistory`, `StoredRecordVersion`, `ValueHistoryEntry`) | `audit log`, `revisions` on their own |
| The client save queue of a versioned document: debounce, serialized saves, conflict state, rebase | `document autosave` (`createDocumentAutosave`, `#lib/state/document-autosave.ts`), its device copies `document drafts` (`document-drafts.ts`) and its per-tab registry `document sessions` (`document-sessions.ts`) | `spreadsheet autosave` (retired 2026-11-05 when the queue became generic over content) |
| Where an agent runs — the Podman container vs Claude Code on the web | `local session` / `cloud session` (Claude Code's own terms; detected by `CLAUDE_CODE_REMOTE`) | `execution profile` (`profile` is spoken for), `environment` (collides with `$app/env` and GitHub environments) |
| Moving an approved feature branch into production: squash into GitHub `main`, GitLab sync, Vercel deployment — only on ApeDevil's explicit instruction in the conversation | `ship` / `shipping mode` (`docs/stack/ops/shipping.md`, skill `ship`, step `scripts/ship/squash-into-main.sh`); the default state is `development mode`. GitLab's copy of `main` is kept by the `GitLab sync` (`gitlab-sync.yml`) | `promote` / `promotion` / `candidate` for this flow (the retired Pattern Incubator's two-stage acceptance, never merged); `release`, `deploy` (Vercel's step, not Claude's). `PROMOTION` survives only as the `.vrrc` key that selects how `main` moves |
| The persisted shape number of a document or file | `format` (`COMPOSITION_FORMAT`, `#lib/schemas/product-composition.ts`; `ATTRIBUTE_RECORD_FORMAT`, `#lib/dynamic-attributes/record.ts`) | `version` (the optimistic-concurrency counter), `revision` (a stored snapshot row), `schemaVersion` |
| The editable document of products and how they connect | `product composition` (`ProductComposition`, `#lib/product-composition/`) | `assembly` (the AI turn's word), `scene` (the renderer's), `layout` |
| A reusable product a composition places | `ProductDefinition` — its `body` is its own geometry and ports, or an arrangement of other products (a subassembly is a definition, not a second type) | `component` (Svelte's), `part` (the part explorer's mesh group), `template` |
| One placed use of a definition | `ProductOccurrence` (field `placement`) | `instance`, `node`, `item` |
| The occurrences, couplings and conduits of one level | `Arrangement` | `scene`, `graph` |
| A typed attachment point on a product | `ProductPort` (field `ports`; `PortRef` = occurrence + port) | bare `Port` (the hexagonal-architecture sense), `connector`, `socket`, `handle` (xyflow's) |
| The interface kind a port speaks, and its coupling rules | `PortStandard` (`PortStandardRegistry`, supplied by the caller — domain content never enters the core) | `PortType` (`type` is a closed classification), `profile`, `connectionType` |
| A logical edge between two ports | `Coupling` (`mode`: `mated` · `conduit`) | `connection` (provider/source connections own it), `link`, `edge`, `mate` as a type |
| The physical pipe or cable path that realises a coupling | `Conduit` (`waypoints`; ends derived from the live ports) | `route` (SvelteKit's and the turn graph's), `path`, `run`, `track`, `pipe`/`cable` (domain words) |
| A primitive's surface role, resolved to a material by the renderer | `finish` (beside `tone`, the colour role) | `material` (the customizer's material options own it), `texture` |
| The architecture a composition is shown in — scenery, never part of the document | `RoomLayout` (`RoomBackdrop` draws it) | `scene`, `stage`, `environment` (the image-based light) |
| Ports joined through a product's body | `passages` (on a geometry body) | `bridge`, `internalLink`, `throughPort` |
| The ports a composed product offers to the outside | `exposedPorts` (each `from` an inner occurrence's port; it speaks that port's standard) | `externalPorts`, `boundary`, `pins` |
| A connected set of ports, derived from couplings and passages | `PortNetwork` (derived, never stored) | `system`, `circuit` (IFC's explicitly assigned groups — and heating words), `net`, `graph` |
| Making a 3D asset programmatically from a structured request | `asset production` (`#lib/asset-production/`, `#lib/server/asset-production/`; i18n prefix `showcase_3d_produce_`) — always qualified | bare `production` (the deployed environment, and `NODE_ENV`), `fabrication` (physical manufacturing), `render` (drawing a frame) |
| The one validated description of an object to produce | `AssetRequest` (`assetRequestSchema`, discriminated by `generator`) | `job` (that is the run's record), `spec`, `order`, `prompt` |
| Code that turns bounded parameters into a mesh | `AssetGenerator` (`ASSET_GENERATORS`, `structuralRingGenerator`) | `builder` (`MeshBuilder` accumulates one primitive), `template`, `recipe` (the PIM transform recipe) |
| What runs the stages of one request | `AssetProductionEngine` (`proceduralEngine`, id `procedural-ts`); its result is an `EngineRun` | bare `engine` (the retrieval step's `RetrievalEngine`), `pipeline` on its own, `exporter` |
| Where an engine run executes | `AssetExecutionEnvironment` (`in-process`, `isolated-process`) — always qualified | bare `environment` (the image-based light of a scene; `.env`), `runner` (the job runner), `sandbox` |
| One run of one request, with its status machine | `AssetJob` (`queued` → `running` → terminal; `moveAssetJob`) | `task`, `run` alone (a job execution in `jobs/`) |
| What a job hands back and keeps beside its GLB | `AssetReport` (output, derivation, inspection, diagnostics, measurements, provenance) | `manifest` (the wasm build manifest), `result`, `metadata` alone |
| One closed surface inside a mesh primitive | `shell` (`MeshShell`) | `part` (the part explorer's mesh group), `body`, `solid` (implies a booleaned union) |
| One finding of composition validation | `CompositionDiagnostic` (`code` · `severity` · `subject`; plausibility only, never a safety verdict) | `error`, `violation`, `issue` (`CompositionIssue` is a parse failure) |
| A supplier's or ERP's tabular product export, held as text with source line numbers | `product sheet` (`ProductSheet`, `ProductRow.line`; `#lib/server/pim/`) | `catalog` (the navigation catalog's), `spreadsheet` (the desk file type), `feed` |
| What the destination accepts: attributes, kinds and rules, plus the key column | `target schema` (`TargetSchema`, `checkSheet` → `SheetCheck` of `SheetIssue`s) | `channel` (a notification transport), `template` (a retired product-composition word), `mapping` |
| The bounded summary of a product sheet an AI agent reads instead of its rows | `sheet profile` (`SheetProfile`, `profileSheet`) | `sample`, `preview`, `stats` |
| The reviewable, replayable list of typed ops that turns one product sheet into the target's | `transform recipe` (`TransformRecipe`, one op a `RecipeOp`; run → `RecipeRun`) | `plan` (the deskbot's `desk_propose_plan`), `step` (a persisted plan step), `pipeline`, `script` |
| A value an op could not read and left unchanged | `unresolved` (`OpReport.unresolved`) | `error`, `skipped`, `invalid` |
| A folder of instructions a coding agent loads on demand (agentskills.io), generated from the pattern registry | `agent skill` (`skills/<name>/SKILL.md`, `renderAgentSkills`, `skills:build` / `skills:check`) | `skill` alone where an A2A skill or a Claude Code development skill (`.claude/skills/`) could be meant |
| A capability an A2A agent advertises on its card | `A2A skill` (`REVIEW_SKILL_IDS`, `ReviewSkillId`) | `agent skill` (that is the folder above), `capability` (that is the AI capability) |
| A UI the model describes as data and the renderer builds from catalogue components | `generative surface` (`#lib/generative-ui/`, `LazyGenerativeSurface`, `GenerativeSurfaceAction`, `GenerativeSurfaceRefusal`); its closed component set is the `generative UI catalog` (`GENERATIVE_UI_CATALOG_ID`) | `widget`, `dynamic UI`, `A2UI surface` as a type name (A2UI is the wire protocol) |
| The two halves of that one catalog: what any derived app needs, and what only this product needs | `general section` / `domain section` (`GENERATIVE_UI_GENERAL_COMPONENTS`, `GENERATIVE_UI_DOMAIN_COMPONENTS`; one catalog id) | `basic catalog` (that is A2UI's own Lit catalog), `custom catalog`, `extension catalog` (implies a second id) |
| One Button press as the client sends it and the user row persists it | `surface action record` (`SurfaceActionRecord {action, renderId, eventId}`, `SurfaceActionRecordSchema`); on the message it is the `data-surface-action` part (`SURFACE_ACTION_PART`) | `surface event` (the event is the Button's declared `action.event`), `click`, `interaction` |
| The identity of one press, minted by the client | `event id` (`eventId`, a UUID; refusal `duplicate_event`) | `request id`, `idempotency key` (that is the submission key's job), `nonce` |
| What a press says — render, surface, source, event name, resolved context — as canonical JSON | `submission key` (`surfaceActionKey`; refusal `duplicate_submission`; the admitted row id `surfaceActionMessageId` is its hash) | `dedup key`, `action hash`, `fingerprint` |
| A committed surface that shows one job a catalog component exists for | `catalog example` (`GENERATIVE_SURFACE_CATALOG_EXAMPLES`, `fixtures/catalog-examples.ts`) | `scenario` (that is the bench's four-way comparison fixture, `GENERATIVE_SURFACE_SCENARIOS`), `demo`, `sample` |
| A scripted later turn of a golden eval case: a typed question or a press built from the persisted thread | `follow-up` (`FollowUpSchema`, `EvalCase.followUps`, `scriptedSurfacePress`) | `step` (spoken for), `turn` alone (a follow-up *produces* a turn) |
| The HTML UI an MCP Apps host renders for one tool's results (SEP-1865), served as a `ui://` resource | `View` (`AppView`, `ToolRegistry.views`; `#lib/server/mcp/apps/`, built by `mcp:apps:build`); the tool it renders is an `App` tool only in the SDK's API names | `widget`, `generative surface` (that is the A2UI catalog UI), `component`, `panel` |
| Another party's MCP server v10r calls as a client | `MCP peer` (`McpPeer`, `#lib/server/ai/mcp-client/`; projected tool names `mcp_<peer>_<tool>`) | `server`, `connector`, `integration` |
| Another party's A2A agent v10r delegates to | `A2A peer` (`A2aPeer` in `peer-policy.ts`: origin plus `PrivateDestination`s; `createA2aPeerFetch`) | `remote agent` as a type name |
| The SHA-256 of an MCP tool's name, description, schemas and annotations, pinned at approval | `tool fingerprint` (`toolFingerprint`); a changed fingerprint is `tool drift` (`detectToolDrift`) | `hash`, `version` — and not a query `shape` (that is a parameter-free SQL form, not a hash) |
| The per-turn cap on external MCP calls | `PeerCallBudget` (`createPeerCallBudget`) | `QueryBudget` (operations), `budgets.json` (metrics) |
| The model-facing identity of a peer tool, unique across all peers and the manifest | `peer tool name` (`peerToolName`, a pure function of peer id + remote name; `projectPeerCatalogue` withholds collisions as `name_collision` / `name_reserved`) | `alias`, `qualified name`, `toolId` |
| What one external call sends out, and the check before it is sent | `disclosure` (`PeerCallDisclosure`, `preparePeerArguments`, `PeerDisclosurePolicy`; `sends: 'tool_arguments_only'`) | `egress` on its own (the address policy's word), `payload`, `context` |
| A human's approval of exactly one external call (peer, endpoint, tool, fingerprint, arguments hash, user, permission digest, expiry) | `peer call approval` (`PeerCallApproval`, `createPeerCallApproval`); its execution-time check is `verifyApprovedPeerCall`, its refusal a `PeerCallRefusal` | `McpCallApproval` (`McpCallLog` is the server side's), `grant` (that is `auth.grant`), `consent` |
| The durable outcome of one approved external call | `peer call receipt` (`PeerCallReceipt`: `outcome` `succeeded` · `failed` · `unknown` · `refused`, `delivery` `sent` · `not_sent` · `possibly_sent`; `executeApprovedPeerCall`, `PeerCallReceiptStore`) | `step receipt` (the desk proposal's), `result` (`PeerCallResult` is the wrapped answer inside it) |
| Whether a peer tool's effect can be taken back, as the operator states it | `reversibility` (`PeerToolReversibility`: `reversible` · `compensatable` · `irreversible` · `unknown`, default `unknown`) | `recovery` (`ProposalStepRecovery` is the desk's undo mechanism), `undoable` |
| An assistant action that leaves the deployment (an MCP peer tool call or an A2A delegation), approved once and executed at most once | `external operation` (`#lib/server/external-operations/`, `ExternalOperationRequest`, `ExternalOperationAdapter`, table `ai.agent_external_operation`); the per-protocol plug-in is its `adapter`, registered in `ExternalOperationAdapters` | `external call` as a type name, `remote action`, `integration` |
| Taking an approved external operation for execution, and the mark written just before it may leave | `execution claim` (`claimExternalOperation`, `claim_token`) and `dispatch marker` (`markExternalDispatched`, status `dispatched`); a stale claim settled after the lease is `healed` (`healInterruptedExternalOperation`) | `lock`, `lease` as the row's name (the lease is the time bound), `retry` (there is none) |
| The check of what an external operation's arguments carry before it is proposed | `content screen` (`screenExternalArguments`); its verdict is an `ExternalContentClass` (`arguments_only` · `quotes_read_content`) with `quotedFrom` | `DLP`, `filter`, `sanitizer` |
| The user's separate yes to sending text the turn read | `quoted-content authorization` (`authorizeQuotedContent` on the approve body and `ProposalDecision`) | `consent` (that is GDPR's), `grant` (that is `auth.grant`) |
| A user's permission for one external application (an OAuth client, e.g. an MCP host) to call a protected service on their behalf | `application authorization` (`application-authorizations.ts`: `checkApplicationAuthorization`, `listApplicationAuthorizations`, `revokeApplicationAuthorization`); stored as Better Auth's `auth.oauth_consent` row, whose name the framework owns | `consent` in our own code (that is GDPR's), `grant` (that is `auth.grant`), `connection` outside the `/account/connections` page title |
| An MCP endpoint that requires an OAuth access token for its own audience and scope | `protected MCP service` (`ProtectedMcpService`, `PROTECTED_MCP_SERVICES`, `MCP_3D_SERVICE`; `auth/protected-mcp-services.ts`) | `private MCP` (that is the bearer surface `/api/mcp/private`), `authenticated MCP` |
| The check in front of a protected MCP service: challenge, token, audience, scope, liveness | `resource access` (`verifyResourceAccess`, `ResourceAccess`, `ResourceCaller`; `auth/resource-access.ts`) | `guard` (the session guards keep it), `gate` (the approval gate keeps it), `middleware` |
| How far an OAuth client's identity is established | `application identity` (`ApplicationIdentity`: `verified-domain` · `self-declared`; `describeApplicationIdentity`) | `trusted client` (Better Auth's `trustedClients` is a different, first-party notion), `verified app` |
| A bound on simultaneous work in one server instance, overall and per key | `in-flight limit` (`createInFlightLimit`; `http/in-flight-limit.ts`) | `concurrency limiter`, `semaphore`, `rate limit` (that counts a window) |
| The OAuth authorization request carried across sign-in as `returnTo` | `authorization resume path` (`authorizationResumePath`, `isAuthorizationResumePath`, `AUTHORIZATION_ENDPOINT_PATH`) | `oauth redirect`, `callback` (the provider callback keeps it) |
| Where the authorization page may send the browser after Allow/Deny: the signed, registered client callback | `callback destination` (`classifyCallbackDestination`, `CallbackDestination`; `auth/callback-destination.ts`) | `redirect target`, `return URL` (`returnTo` is the sign-in resume) |
| The app-owned form of SvelteKit's refusal of cross-site form POSTs | `cross-site form check` (`crossSiteFormCheck`, `isCrossSiteFormSubmission`, `OAUTH_SERVER_TO_SERVER_PATHS`; `security/csrf.ts`) | `csrfProtection` (the `/api/*` X-Requested-With check), `checkOrigin` (removed in SvelteKit 3) |
| The operator's list of MCP peers and their reviewed tools | `peer directory` (`peer-directory.ts`, tables `ai.mcp_peer` / `ai.mcp_peer_tool`, `/admin/ai/peers`); one entry is a `DirectoryPeer`; a tool's reviewed fingerprint is its `activation` (`activatePeerTool`) | `registry` (that is the pattern registry), `connector`, `marketplace` |
| The operator's list of A2A peers the assistant may delegate to | `delegation directory` (`a2a/delegation-directory.ts`, env `A2A_DELEGATION_PEERS`); one entry is an `A2aDelegationPeer` | `peer directory` (that is the MCP one, in the database), `agent registry` |
| The capability that mounts activated peer tools on a deskbot turn | `external-tools` (`externalTools`; one mounted tool is a `MountedPeerTool`) | `mcp-tools`, `peer-tools` (that is the MCP client module) |
| An operator's exception for one private address + port | `private destination` (`PrivateDestination`, `isAllowedPrivateDestination`) | `trustedNetwork` (retired: a blanket bypass), `allowlist` alone |
| Connecting to the address the egress check validated, keeping the name for TLS and `Host` | `pinned fetch` (`fetchPinned`, `resolvePinnedAddress`, `EgressRequestError.requestSent`) | `dispatcher`, `pinned agent` |
| What a remote A2A agent's report is to v10r | `remote review claim` (`claimed` · `declined` · `refused`, always `verified: false`) with `RemoteFinding`s | `result`, `verdict`, `finding` alone (that is a local check's) |
| Refusing server-side requests to non-public addresses | `egress address policy` (`server/http/egress-address.ts`: `isNonPublicAddress`, `resolvePublicAddresses`) | per-domain `isBlockedAddress` copies |
| The one secured outbound fetch to an operator-configured peer, shared by the MCP and A2A clients (admission by the protocol, header hygiene, pinned connect, no redirects, byte cap, abort) | `peer egress` (`server/http/peer-egress.ts`: `createPeerEgressFetch`, `PeerEgressProblem`; each protocol's wrapper keeps its name: `createMcpPeerFetch`, `createA2aPeerFetch`) | `secured transport` as a type name, `egress` alone (the address policy's word), `transport` (the SDKs own those) |
| An operator-listed A2A peer the assistant may delegate to (id, label, origin, allowed A2A skills, credential by `A2A_PEER_SECRET_*`, private destinations, reversibility) | `A2A delegation peer` (`A2aDelegationPeer`, `delegationPeerProblems`, `delegationPeerPolicy`) | `remote agent`, `endpoint`, `integration` |
| The bound on how many delegations a turn and a conversation may propose, and how deep | `delegation budget` (`createDelegationBudget`; refusals `turn_budget` · `conversation_budget` · `depth`; limits `A2A_DELEGATION_LIMITS`) | `PeerCallBudget` (that is MCP's per-turn call cap), `quota` |
| What became of a remote A2A task after a timeout or abort | `cancellation` on a refused delegation (`DelegationCancellation`: `confirmed` · `not_confirmed` · `no_task`) | `aborted` (that is the refusal code), `revoked` |
| The ids a peer gave the remote work, kept beside the turn | `remote task` (`ExternalRemoteTask` on an external execution result; `RemoteTaskRecord` on `ToolExecutionRecord.remoteTask`) | `correlation id` as a type name, `trace id` (that is OTel's) |
| The A2A external-operations adapter and the tool that proposes through it | `A2A delegation adapter` (`createA2aDelegationAdapter`), tool `delegate_architecture_review`, capability `agent-delegation`, its turn input `DelegationTurnContext` | `delegate tool`, `a2a tool` |
| The page that shows every interop adapter with its evidence | `Agentic Interoperability Lab` (`/showcases/interop`, i18n `showcase_interop_*`); each section is `live` · `recorded` · `authored` | `playground`, `demo`, `sandbox` |

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
- **`Explosive Discovery`, beside `progressive disclosure` — and `Progressive Revelation`
  retired.** Two names, two jobs. *Progressive disclosure* is the intent (show what is needed
  now, principle 3). *Explosive Discovery* is the principle that says how — capability nested
  by meaning, directions, context promotion, an expert path, one hierarchy per device — and
  the review method that checks for it. *Progressive Revelation* used to sit beside them as a
  third concept: content revealed by journey stage. It was the same idea stretched along time,
  held under a second name for a feature nobody built. One concept, one name: it is now the
  journey axis of `foundation/explosive-discovery.md`, and the gate catches the old word.

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
  URL or graph path. The **critical rendering path** is the browser's term for the resources
  that must arrive before first paint — a separate concept with its own pattern record
  (`critical-rendering-path`), always written in full so it never reads as the server work
  class.
- **`tier`** — a rung in a graded scale: a pattern record's depth (`deep`/`light`) and a
  cache level (`local`/`shared`/`origin`). Not a synonym for layer, lane or surface.
- **`capability`** — a shared word, one concept, four subjects, always qualified:
  `ModelCapabilities` (what a **model** can do), the product capabilities under
  `docs/stack/capabilities/`, `AssistantCapability` (what an **assistant** can do — the
  unit a profile is composed from, `ai/capabilities/`), and a pattern record's `capabilities`
  (what a **pattern** enables — free discovery vocabulary, D-07). An **infrastructure need**
  names a capability the *target* must run; it is the need, not a `capability` field. A bare
  `Capability` is never right.
- **`profile`** — the per-surface variant of a shared thing: an *assistant* profile
  (`AssistantProfile`, the top), the *retrieval* profile (which corpus and tiers a surface
  asks the shared kernel for) and the *location-awareness* profile (site- vs desk-awareness)
  are the same word because each is one surface's reading of one mechanism; the last two are
  now capabilities inside the first.
- **`depth`** — in code, an elevation rung (`useSurface().depth`, `elevationAttr(depth + 1)`).
  A chunk's place is its `level` (`ChunkLevel`); a pattern record's is its `tier`. "Nested
  Depth" is prose — the name of the shape a menu hierarchy takes — and never a field.
- **`path`, once more** — "discovery path" and "expert path" are PROSE, like "critical path".
  Code names the mechanism: a `shortcut` on a menu item, a palette item, a `recent` entry.
- **`budget`, once more** — "choice budget" is prose for a review trigger (~5±2 simultaneous
  choices). There is no `choiceBudget` constant, by design: the number is a reason to look,
  never a limit to enforce.

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
- **Constants go in `config.ts` when they are policy** (`src/lib/server/mcp/demo/config.ts`), and in a file
  named for what they are when they are not — `db/analytics/sentinels.ts` holds the
  `UNKNOWN_COUNTRY` / `UNKNOWN_CLIENT` sentinels, which are vocabulary, not policy.

`#lib/utils/` survives as a *directory*: every leaf inside it is sharply named (`cn.ts`,
`safe-path.ts`, `xml.ts`), so the meaning lives where a reader looks for it.

## Singular and plural

For cookies the repo distinguishes them, and the distinction is worth keeping: a **singular**
`cookie.ts` owns one named cookie's contract (`pairing/cookie.ts`, `styles/random/cookie.ts`),
a **plural** `cookies.ts` is a cookie *utility* module (`#lib/utils/cookies.ts`).
`analytics/cookies.ts` held only the consent cookie and is now `analytics/consent-cookie.ts`.

## Names that stay overloaded on purpose

Flagged by audit, examined, kept:

- `AiLayer` / `AiLane` in `showcases/ai/topology.ts` — diagram vocabulary (bands stacked,
  lanes side by side), self-documenting and scoped to one module.
- `'blog-author'` and `'tool-result'` kebab-case enum values among otherwise snake_case
  ones. The first mirrors a URL path segment, the second mirrors the Vercel AI SDK's own
  wire literal `part.type`.
- `Database` declared in both `db/types.ts` and `db/index.ts` — the re-derivation is
  commented, and exists so CLI consumers avoid pulling `$app/env/private`.
- Per-domain `config.ts` files repeating `RATE_LIMIT_WINDOW`, `MAX_UPLOAD_SIZE` and friends.
  Same name, independent values, by design — policy belongs to its domain.
- `#lib/actions/` (Svelte `use:` directives) beside SvelteKit's form `actions`. Both are
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
  *tools*, not of patterns, and is now `tools.ts` beside its sibling `src/lib/server/mcp/demo/tools.ts`.
- `assertShowcaseKey` / `SHOWCASE_PREFIX` in `server/store/`. The canonical pair keeps the
  plain name: it is security-critical (SEC-N01) and pinned by a regex in
  `security/authz-coverage.gate.test.ts`. The Redis copy took the qualifier instead.

## Names we cannot move

- **MCP tool names** (`search_patterns`, `get_pattern`, `get_file_excerpt`,
  `trace_capability`, `recommend_emulation_plan`, `validate_snippet`) — external clients
  call them; both transports serve them from `pattern-library/query.ts`, and
  `src/lib/server/mcp/patterns/parity.test.ts` proves stdio↔HTTP agreement by running both.
- **Pattern-registry `id`s** — the MCP surface, the generated docs pages and external
  agents all address patterns by id.
- **Better Auth's tables** — vendor-owned.
- **Stored enum values and column names** — renaming needs hand-written `ALTER … RENAME`
  DDL run before `db:push` (push sees a rename as DROP + CREATE); see
  [blueprint/data/drizzle-workflow.md](./blueprint/data/drizzle-workflow.md).
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
