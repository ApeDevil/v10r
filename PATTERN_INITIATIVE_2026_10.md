# Pattern initiative 2026-10 — ledger

Operational state for the 15-candidate pattern initiative (P01–P15). **Read this first after
any compaction**, then `git status --short`, then resume from "Next exact action". Plan of
record: `~/.claude/plans/pasted-content-id-79b6-v10r-declarative-quasar.md`. Started
2026-10-10 on branch `dev` @ `91f61a76`. Stas commits; nothing here is committed by the agent.

## Next exact action

Initiative complete except the open items in section I. Next session: re-run `podman exec v10r bun run db:ingest-docs` once the Gemini embed daily quota has reset (F5) — it resumes from the keyed docs; then click-test approve → Undo on the desk (F11).

## Rules of engagement

- Every command via `podman exec v10r …`; never `vr`; never commit/stage/stash/reset.
- Sub-agents that edit: tree carries concurrent uncommitted work; no stash/reset/checkout/
  restore/commit. One agent at a time on `pattern-library/registry.json`.
- Gate per phase: `podman exec v10r bun run validate`. Registry/docs edits: `bun run refresh`
  at the end (Phase 8) — `patterns:build` + `mcp:excerpts:build` after each registry phase.
- A phase is closed only with the gate output recorded below. Failing gates are recorded as
  failing.

## Decisions (Stas, 2026-10-10)
- Execute **all phases 0–8** sequentially, stopping at each phase boundary with the gate
  green (Stas reviews/commits); re-ask only for destructive or architecture-changing steps.
- `db:push` approved for **additive** changes; anything else (Phase 5 PK change) → show the
  statement list and ask first; always answer "No" to truncate re-prompts.
- P14: **full revert changeset** (server + route + PlanCard Undo + i18n + tests).
- Taxonomy: **new "Integrity" group** + `docs/blueprint/integrity/` family.

## A. Capability matrix

| ID | Coverage | Where it already lives | Real gap | Cx | Risk | Disposition |
|---|---|---|---|---|---|---|
| P01 authority | Partial-strong (practice ×10) | `naming.gate`, `db-enums.drift`, `schema-filter.gate`, `retention/schedule.gate`, `credits/registry.gate`, `doc-filter.ts`, `content-hash.ts`, `loadProviderRegistry` (fail-closed) | no named pattern; owner/mirror/gate method only in prose | L | L | **Add** deep record (docs + refs to existing gates) |
| P02 provenance | Partial ×5, divergent shapes | `blog.revision`+`contentHash`, `retrieval.document/chunk`, `TurnTrace`, `image_metadata.fieldProvenance`, `admin/audit-log`, `desk.file_revision.source` | no shared vocabulary; derived rows don't name transform version | L | L | **Add** deep record (PROV-minimal mapping) — code change rides on P04/P14 |
| P03 contracts | Partial-weak | Valibot `src/lib/schemas/*`, `REPORT_SCHEMA_VERSION`, `desk-settings.persistence.ts` `version: 2` | upgrade-vs-discard policy; no consumer (no prod users, MCP text-only by design, no compat by repo rule) | M | M | **Defer** with trigger; micro-fix: persisted format number named `version` violates `docs/naming.md:83` |
| P04 derivation | Partial | `desk/formula.ts` resolver + `#CIRC!`, `schema.ts` `topoSort`, ingest hash-skip, `--check` generators | key = content only, not inputs+transform version (gap #1) | M | M | **Add** `derivation-key` (reframed: freshness key, not a graph engine) + fix ingest |
| P05 reproducible | Partial, good exemplars | `scripts/wasm/build.sh` → `build-manifest.json` + `kernel-manifest.test.ts`; `patterns:check`, `mcp:excerpts:check`, `content:check`; perf snapshot `gitSha` | method not named; base images tag-pinned | L | L | **Add** deep record (regenerate-and-diff vs manifest decision rule) |
| P06 anchoring | Partial (page/section only) | `CitationChip` `anchor`, `CitationRecord.quote`, `chunkPlace()`, `RefKind 'anchor'`, `slugify` in `docs/doc-filter.ts` | anchors never resolved (gap #4); no quote/position selector | M | L | **Add narrow**: anchor-integrity gate + record; full W3C selectors **deferred** |
| P07 temporal | Partial (showcase-only bitemporal) | `db/schema/showcase/temporal-record.ts`, `/showcases/db/relational/mutability#temporal`, revision tables, CAS `version` | no record, no decision boundary | L | L | **Add** light record + decision-boundary doc section; no new tables |
| P08 digital twin | None | (3D customizer, wasm kernel, GeoMap — unitless) | everything; no consumer | H | H | **Reject** (domain-specific, no consumer) |
| P09 durable exec | Partial-strong ×3 | notifications outbox (SKIP LOCKED, fence, lease, reaper), `ai.agent_proposal(_step)` (state machine, exactly-once via conditional UPDATE in `markExecuting` — `agent_proposal_exec_unique_idx` is redundant with the PK, receipts in-txn, `markInterruptedIfStale`), `dbops.operation` (idempotencyKey, heartbeat, reaper) | contract written 3× with no name; ingest has no checkpoints | M | L | **Add** deep record over the 3 impls; **reject** workflow engine (`docs/stack/vendors.md:396`) |
| P10 evidence | Partial-strong, deliberately distinct | `PatternMaturity`, name-check `NameCoverageStatus`/`NameConflictSignal`, imagemeta `confidence` vs `fieldProvenance`, `TurnItemState`, `CatalogCitationStatus`, perf targets vs ratchets | no named rule set | L | L | **Add** deep record (guideline: keep dimensions apart, grades machine-checkable) — no shared type |
| P11 local-first | Partial | `spreadsheet-autosave.ts` (queue, stale-seq guard, conflict flag), `spreadsheet-drafts.ts` (per-writer slots), PUT `expectedVersion`→409, `optimistic.svelte.ts` | the session machinery has no record; no CRDT/offline outbox (no need) | L | L | **Add** deep record `versioned-document-session`; CRDT/offline sync **rejected for now** |
| P12 asset rights | Partial (software strong, assets weak) | `$lib/credits/registry.ts` (SPDX) + `registry.gate.test.ts`, `3d/models.ts` credit, `parts.ts` credit | gap #3; no license field on assets | M | L | **Extend** credits registry to assets + gate + record |
| P13 continuity | Partial | `AGENTS.md`, `CLAUDE.md`, `/llms.txt`, MCP, `agent-experience` | routing pointers unchecked (gap #4); no decision log | L | L | **Extend** `agent-experience` with routing-integrity gate; decision log/state snapshot **deferred** |
| P14 AI changesets | Full for single proposal | `deskbot-approval-gate`: reviewed baseline CAS, exactly-once, receipts, expiry, frozen scopes, lease | undo not executable (gap #2); revisions unlinked to proposals; desk-only | M-H | M | **Extend** `deskbot-approval-gate` with an executable revert changeset |
| P15 fitness | Partial, best tooling | `schema.ts` (`when_to_use`, `risk`, `maturity`), `recommend_emulation_plan` (`mcp/tools.ts:432`), `parity.test.ts` | no `avoid_when`, no alternatives, no infra prerequisites; recommender can't warn | M | M | **Extend** registry schema + both MCP runtimes + AI tool |

## B. Research & decision record (resy = standards, scout = practice; 2026-10-10)

- **Server stays authoritative everywhere** (sync engines, workflows, approvals all converged
  on it): version CAS + fencing token + idempotency key at every external boundary. This
  validates v10r's existing outbox / proposal / dbops designs — record them, don't replace.
- **Durable execution:** hand-rolled run + named-step table is enough for short, idempotent,
  few-step work (Absurd in production, 2026-04). Vercel Workflow is GA (2026-04) but cannot
  use our Neon DB on Vercel; DBOS on Hobby waits on a daily cron. Failure modes to check our
  three implementations against: zombie lease without fence, app-clock leases, call-order
  step keys, side effect before checkpoint without idempotency key, no retention.
- **AI changesets:** approval must bind the exact frozen args (OpenClaw CVE-2026-53822);
  Terraform-style stale-plan check = our reviewed baseline. Undo = inverse ops from
  before-images with CAS against the version written at apply time; partial batches need
  per-item status (we have receipts).
- **Local-first:** no CRDT outside rich-text co-editing; Zero 1.0 = 232 KB gz client;
  Replicache in maintenance. Server-authoritative CAS + drafts is the pragmatic default.
- **Derivation/builds:** undeclared inputs poison caches (Turborepo env case); interrupted
  writes look fresh → write temp then rename, manifest last; `git diff --exit-code` misses
  new untracked files → a `--check` must also catch missing/orphan outputs. SLSA v1.2
  provenance shape for an unsigned manifest; "functional reproducibility" is not a
  standard term — label nondeterministic outputs "input-addressed".
- **Provenance:** PROV-DM core (Entity/Activity/Agent; wasGeneratedBy/used/wasDerivedFrom/
  wasAttributedTo) maps to a revision-pinned derivation edge; OpenLineage is pipeline-level
  and overkill. Agent refs are personal data.
- **Anchoring:** W3C Web Annotation minimal subset = doc id + revision + quote(exact/prefix/
  suffix) + position; JS indices are UTF-16, the spec counts code points.
- **Temporal:** PG18 has `WITHOUT OVERLAPS`/`PERIOD` FKs but no system-versioning; Neon PG18 GA
  2026-05-01 (new projects only); Drizzle support unverified → `tstzrange` + exclusion
  constraint is the portable form. Bitemporal only for "what did we believe at T1 about T2".
- **Licensing:** SPDX 3.29 list, REUSE 3.3 (`REUSE.toml`/sidecars); automated compatibility
  checks are inherently uncertain → check metadata presence, never claim legal sufficiency.
- **Pattern fitness:** no standard for contraindication metadata (own design). No study shows
  it changes agent choices; always-loaded context beats on-demand MCP lookups (Vercel
  2026-01: 100% vs 79%; Context7 called in 6.7% of tasks) → `avoid_when` must also surface
  in the always-loaded generated index, and its benefit is recorded as **unproven**.
- **Context continuity:** ~23% of AI config files carry stale references; rule-file
  hidden-Unicode backdoors are real → a path-existence + hidden-Unicode gate on agent files.

### Primary sources consulted (resy/scout, accessed 2026-10-10)

PROV-DM (W3C Rec 2013-04-30) · OpenLineage object model · Web Annotation Data Model (W3C Rec
2017-02-23) · Media Fragments URI 1.0 · PostgreSQL 18 release notes + CREATE TABLE · Neon
changelog 2026-05-01 / 2026-06-05 · standardschema.dev · valibot.dev + `@valibot/to-json-schema`
README · Confluent schema evolution · docs.pact.io · UCUM v2.2 · reproducible-builds.org
definition · SLSA v1.2 build provenance · in-toto attestation v1.2 · SPDX License List 3.29.0 ·
SPDX 3.0.1 · REUSE 3.3 · MADR 4.0.0 · Thoughtworks Radar (fitness functions) · Vercel Workflow
pricing (2026-09-16) · useworkflow.dev Postgres World · DBOS Vercel guide · "Absurd in
Production" (lucumr, 2026-04-04) · OpenClaw CVE-2026-53822 advisory · Terraform stale-plan
(HashiCorp forum) · Claude Code checkpointing docs · Zero 1.0 (InfoQ 2026-06) · Electric /
PowerSync docs · Automerge 3 · Vercel "AGENTS.md outperforms skills" (2026-01-27) · Marginlab
MCP study (2026-04) · Gloaguen et al. arXiv 2602.11988 · Lulla et al. arXiv 2601.20404.
Unverified: PG19 GA, Drizzle `WITHOUT OVERLAPS` support, effect of contraindication metadata
on agent choices.

## C. Architecture, ownership, dependencies

- **One new registry group `integrity` ("Integrity")** with three categories, mirroring the
  Velocity family's shape (`docs/blueprint/velocity/`): `integrity-truth` (P01, P10, P12),
  `integrity-derivation` (P02, P04, P05), `integrity-execution` (P09, P11). P06 anchor →
  `docs-ax`; P07 → `databases`; P13/P15 extend existing `docs-ax` records; P14 extends
  `deskbot-approval-gate` in `ai`.
- **Docs family** `docs/blueprint/integrity/` — `README.md` hub + `truth.md`,
  `derivation.md`, `execution.md`. Like Velocity: **no `integrity/` code directory** —
  code stays in the module that owns each responsibility.
- **Only one new shared primitive**: `derivationKey()` beside `contentHash()` in
  `src/lib/server/db/content-hash.ts` (already the single hash SSOT; Vite-free so scripts
  can import it). Everything else is documentation over existing code, or an extension
  in its owning module. No new dependencies, services or infra.
- **Naming constraints found** (`docs/naming.md`): `lineage` is a rejected term (line 122);
  `provenance` is spoken for by `TurnProvenance` (line 102) — generalize that row, don't
  fork it; `version` = concurrency counter, `revision` = stored snapshot row (line 83);
  `run` is taken (`proposal run`), so P09 avoids it; `recovery` = how a step is undone
  (line 51) — P14 revert extends that term. Final ids checked against `naming.gate.test.ts`
  at implementation time.
- **Dependency graph (real prerequisites only):** Phase 1 (P15 fields) precedes every new
  record so they are authored with `avoid_when` from the start. P04 code precedes the P02
  record (which cites it). P14 revert precedes nothing. All other phases are independent.

## Rejected / deferred (with triggers)
- **P08 digital twin — rejected**: no engineering domain or consumer; a unit/range
  "typed parameter" is the only borrowable idea.
- **P03 versioned contracts — deferred**: trigger = first persisted/exported shape with a
  real external or stale-client consumer. Then: committed JSON Schema 2020-12 snapshots
  (`@valibot/to-json-schema` with `target: 'draft-2020-12'`, default is draft-07) +
  N-1 fixture replay. Conflicts today with the repo's no-backward-compat rule.
- **CRDT / offline sync (part of P11) — rejected for now**; **decision log / state
  snapshot (part of P13) — deferred**; **W3C quote/position selectors (part of P06) —
  deferred** until chunk-level citations are a feature; **workflow engine (P09) —
  rejected**.

## D. Phases — status and evidence

| # | Phase | Status | Evidence |
|---|---|---|---|
| 0 | Continuation record | done | this file |
| 1 | P15 fitness fields (registry 2.2.0) | **done 2026-10-10** | `validate`: check 0 errors (11132 files), biome ci clean, vitest 257/257 files, mcp bun 22 pass, patterns:validate 162 OK 0 warn, patterns:check + excerpts:check + i18n + content + opacity OK. Live: `recommend_emulation_plan` prints per-step Requires/Avoid when + `This plan requires: …` union. Files: `pattern-library/schema.ts` (`PATTERN_REQUIREMENTS`, `avoid_when`/`alternatives`/`requires`), both `tools.ts` (`fitnessLines`, `requiresLine`, pinned by `parity.test.ts`), `patterns/render.ts` (index headline + page sections), `search-pattern-library.ts`, new `patterns/registry.test.ts`, all 30 deep records backfilled |
| 2 | Integrity scaffold + P01/P10 records | **done 2026-10-10** | `validate` exit 0: check 0 errors, biome clean, vitest 257/257, mcp 22 pass, registry 164 (32 deep) 0 warn, surfaces/excerpts/i18n/content/opacity OK. New: group `integrity` + 3 categories, `docs/blueprint/integrity/{README,truth}.md`, blueprint hub row, records `source-of-truth-gate` + `evidence-status-dimensions` (proven via existing gates), DAG short labels. Note: every new deep id needs a `DAG_SHORT_LABELS` entry (`src/lib/showcases/mcp/registry-viz.ts`) |
| 3 | Derivation: `derivationKey` + ingest + P04/P05/P02 records | **done 2026-10-10** (ingest run deferred to Phase 8) | `validate` exit 0: vitest 258/258, registry 167 (35 deep), all legs OK. Code: `derivationKey()` + tests; `CHUNKER_VERSION`/`chunkingInput()` + output-fingerprint pin in `plan.test.ts`; `retrieval.document.derivation_key` (column applied on Neon via idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, verified text/nullable — no drizzle-kit prompt driven); `ingest-docs.ts` keyed skip, `--force`/`INGEST_FORCE` deleted, private sha256 replaced by `contentHash`; app ingest split `planIngest`/`runIngest` + `ingestIfChanged`; desk sync keeps unchanged embeddings + `markDocumentCurrent`. Docs `integrity/derivation.md`, naming rows (`provenance` generalized, `derivation key`). Records `derivation-key`, `reproducible-artifact-build`, `provenance-record` |
| 4 | Execution records P09/P11 (+ audit of 3 lease impls) | **done 2026-10-10** | `validate` exit 0 (svelte-check SIGSEGV once, gate retry passed — F2 class), vitest 258/258, registry 169 (37 deep). Audit → F6/F7/F8. Code: `lockExecuting` fence in each step txn + DB-clock heartbeat/lease in `db/ai/proposals.ts`, new pglite fence test. Docs `integrity/execution.md`. Records `durable-step-execution`, `versioned-document-session`; `deskbot-approval-gate` gains the fence invariant + depends_on |
| 5 | P14 executable revert | **done 2026-10-10** (browser E2E NOT run — see F11) | `validate`: check 0 errors, biome clean, vitest **259/259 files, 2977 tests** (first full run hit a vitest worker EPIPE — F2 class — re-run clean), mcp 22 pass, registry/surfaces/excerpts/i18n/content/opacity OK. Design change vs plan: revert receipts in a NEW table `ai.agent_proposal_revert_step` (FK onto the forward receipt) instead of a PK change → every DDL statement additive; applied on Neon verbatim from `drizzle-kit export` with existence guards, verified (9 columns, 3 constraints). Code: `StepRecoveryPoint` on `agent_proposal_step.recovery`; executor emits it; `restoreFile`, `getRevision`, `revisionId` returns; `revert-proposal.ts` (chained per-file CAS, fence `lockReverting`, DB-clock heartbeat, deterministic revert message); `undoEffects`/`revertEffects` shared by live + status read; route `api/ai/proposals/[id]/revert`; `DeskBotSession.revert()` + `#markUnknown`; PlanCard Undo (`Button` primitive) + per-step undo verdicts; 11 i18n keys en/de/ru (4 rewritten: "restore not available yet" was false). Tests: `revert-proposal.pglite.test.ts` (6), session undo (3), executor mocks updated. Docs: surfaces.md, harness-lens.md, desk-integration.md, naming rows (`recovery point`, `revert`, `revert receipt`); record `deskbot-approval-gate` rewritten (F9) |
| 6 | P12 asset rights | **done 2026-10-10** | `validate` exit 0: vitest 259/259 (2981 tests), registry 170 (38 deep), all legs OK. Browser: `/credits` renders the Models & Photos section (4 models + 9 photos, CC BY credits visible), no console errors. Code: `$lib/credits/asset-rights.ts`; `Model3D.rights` / `PartPhoto.rights` replace free-text `credit`/`sourceUrl` (sourceUrl was never rendered); `assetCredits` derived in the credits registry; lightbox renders `creditLine`; gate compares the files under `static/models` + `static/images/parts` to the records (+ SPDX shape, attribution fields, non-empty control). `static/models/ATTRIBUTION.md` + `static/images/parts/ATTRIBUTION.md` deleted (unstaged — see F12). 3 i18n keys ×3 locales. Docs truth.md section, 3d-integration.md. Record `asset-rights-manifest` (approute `/credits`) |
| 7 | P06 anchors + P13 routing gate + P07 record + format-version rename | **done 2026-10-10** (rename reverted — F14; chat-citation anchors deferred — F15) | `validate` exit 0: vitest **261/261 files, 2986 tests**, registry 172 (38 deep / 134 light), all legs OK. Code: `src/lib/docs/heading-anchors.ts` (renderer's own remark→rehype-slug chain; first placed in `server/docs/`, moved after `architecture.gate` flagged the patterns→docs cross-domain import); `patterns:validate` checks every `#fragment`; `render.ts` `anchorFor` now uses it (second slugger removed); `src/lib/agent-instructions.gate.test.ts` (paths exist, bare `name/` routing tokens, reasoned allowance that fails when stale, hidden bidi/zero-width scan). Fixed stale pointers: CLAUDE.md `llmwiki/`, cony.md claimed `src/lib/server/content/` absent. Docs: agent-experience.md section, relational.md "How much time to model" ladder (instances verified against schema; showcase checked in browser). Records: light `resource-anchor-integrity`, `temporal-data-modeling`; `agent-experience` +2 invariants |
| 8 | Refresh, review, completion report | **done 2026-10-10** (docs ingest PARTIAL — F5) | Review by 3 fresh agents (ary, clyn, tesy) → section H; fixes applied, final `validate` exit 0: check 0 errors (11154 files), biome clean, vitest **261/261 files, 2995 tests**, mcp 22 pass, registry 172 (38 deep / 134 light) 0 warn, surfaces/excerpts/i18n/content/opacity OK. `db:ingest-docs`: 74/287 docs keyed, then embed daily quota exhausted |

Phase details: plan of record, "Implementation phases".

## Findings logged during execution

- **F1 (fixed, Phase 1):** `jobs-scheduler` record contradicted the code — claimed "no schedule field" and "one vercel.json entry per job"; code has `cadence: daily|weekly`, `standalone`, and one `/api/cron/due` sweep (`jobsDueOn`). Record summary/invariants/notes rewritten, `cron/due/+server.ts` + `jobs/index.test.ts` refs added.
- **F2 (environment, not code):** first Phase-1 `validate` run: all 256 test files passed but a vitest fork exited unexpectedly ("Worker forks emitted error") → exit 1; immediate re-run 257/257 green. Same host flake as the 2026-09 crash-storm memory. Recorded, not suppressed.
- **F4 (fixed, Phase 3):** desk retrieval sync re-embedded on any `updatedAt` bump (rename-free edits, re-pins) and never re-derived on a chunker/model change; now keyed. Docs ingest had a private `sha256` beside the canonical `contentHash` (same output) — replaced.
- **F5 (pending, Phase 8):** first keyed `db:ingest-docs` run re-derives the whole docs corpus once (all stored keys are null) — embed quota may cut it short; the keyed design resumes on the next run.
- **F6 (open, needs Stas):** `ai.agent_proposal_exec_unique_idx` is a unique index on `id` (the PK) — it cannot collide, so the "exactly-once" comments that cited it were wrong; exactly-once is `markExecuting`'s conditional UPDATE. Comments corrected; dropping the index is a non-additive push → left for Stas.
- **F7 (fixed, Phase 4):** proposal execution had a lease + healer but no fence — a run healed to `failed('interrupted')` could keep committing steps (Vercel's maxDuration was the only backstop; none on persistent hosts). Now `lockExecuting(tx)` per step; heartbeat + lease comparison moved to DB `now()`.
- **F8 (recorded deviation):** `dbops` computes its lease in app time (`Date.now()`); outbox notifications are at-least-once on external channels (no provider idempotency key — Resend supports one; next work).
- **F9 (fixed, Phase 5):** `deskbot-approval-gate` invariant claimed a "post-approval resume turn filtered to read-only scopes" — no model turn follows approval (deterministic receipt message; `naming.md` retires the resume turn). Rewritten. Approve route header also cited the redundant unique index (F6) — corrected.
- **F10 (recorded):** in-loop creates (auto-approved, outside a proposal) still get no receipt and `desk.file.originToolCallId` is never written, so they are not undoable — next work.
- **F11 (open, environment):** browser E2E of Undo not run: the pane has no session (login has a captcha — not automatable by policy) and a deskbot plan needs a live AI call. The dev server also SIGSEGV'd twice on first request after restart (Bun, exit 139; kernel log shows a Brave segfault the same day) — same host-fault class as the 2026-09 crash storm; third start served normally. Stas: click-test approve → Undo on the desk.
- **F12 (process slip, corrected):** I deleted the two ATTRIBUTION.md files with `git rm`, which staged the deletions; immediately unstaged with `git restore --staged <those two paths>` — index is clean, files deleted in the working tree only.
- **F13 (environment):** `podman compose restart app` stops the container with SIGKILL (exit 137) and does not bring it back; use `podman compose up -d` afterwards.
- **F14 (open, needs Stas):** persisted *format* numbers are named `version` in `dock.persistence.ts`, `workspace.persistence.ts`, `desk-settings.persistence.ts` (`naming.md` reserves `version` for row concurrency counters). Rename attempted and REVERTED: `DockLayoutState` is also stored in the DB (named workspaces, validated by `server/desk/schemas.ts`), so the rename needs a data rewrite of existing rows — a non-additive change not cleared.
- **F15 (deferred):** `catalog-citations.ts` still strips `#fragment` before checking a chatbot-cited route; verifying anchors at runtime needs a per-page heading index on every turn. Recorded in agent-experience.md.
- **F5 update:** first keyed run re-derived 74/287 docs before the container went down; the resumed run hit the Gemini embed daily quota. Found + fixed an ordering bug in `scripts/db/ingest-docs.ts`: the prior copy was soft-deleted BEFORE the new one was embedded, so a quota-cut doc vanished from the corpus — now insert-then-retire, as desk sync does. The doc(s) cut mid-run before the fix are absent until the next run inserts them as `new`.
- **F3 (decision):** `requires` lists only hard needs — `resilience-policy` = [] (code degrades without Redis), `jobs-scheduler` omits `cron` (persistent hosts use an interval), `layered-rag` omits `neo4j` (graph tier dormant).

## H. Final architecture review (2026-10-10, ary + clyn + tesy, read-only)

Fixed in this pass:
- **Recovery vocabulary had two names** — card said `none` for creates, the executed point said `created`. `ProposalStepRecovery` gains `created`; `StepRecoveryPoint.kind` is typed as `Extract<ProposalStepRecovery, …>` so they cannot drift; `none` stays only as the nothing-to-undo fallback (new i18n copy).
- **Embedding input keyed two ways** (app: model id; script: model@dims) → one `EMBEDDING_INPUT` in `retrieval-shared/embed-config.ts`, re-exported by `retrieval/config.ts`.
- **`fitnessLines`/`requiresLine` duplicated across MCP runtimes** → one `pattern-library/fitness.ts` imported by both; parity test now asserts the import and forbids a local copy.
- **Read-side outcome lived in the forward executor** → `ai/proposals/proposal-outcome.ts` (`toStepReceipt`, `effectsOfReceipts`, revert effects, `proposalOutcome`).
- **`heading-anchors` client-reachable folder** → `src/lib/docs/heading-anchors.server.ts` (SvelteKit enforces server-only); comment now names its real readers and the directive gap.
- **Naming:** `UndoResult`/`undoStep`/`undoEffects` → `RevertStepResult`/`revertStep`/`revertStepEffects`.
- **Bugs (tesy):** (1) a dead revert held the desk bot busy forever — status route now heals stale `reverting`; client busy-ness comes only from its own in-flight undo; `attach()` re-checks open reverts. (2) an errored ingest's stored key skipped its own retry — only a `ready` copy's key counts. (3) `revertProposal` had no owner check — ownership is now in the claim's SQL. (4) a late status read erased a settled undo client-side — settled reverts are preserved. (5, clyn) desk docs never re-derived after a chunker/model bump — the daily sync now offers every pinned file and lets the key decide. (6, clyn) plans executed before recovery points existed would "undo" 0 of 0 steps — refused with 409 `revert_unavailable`. Unreachable guards turned into invariant throws; a failed-step receipt write can no longer wedge a revert.
- **Tests added:** owner-only undo, unrecorded-plan refusal, per-file chain (receipts written directly — a forward plan cannot touch one file twice), `lockReverting` + stale-revert heal, fence leaves the mutation rolled back, client stuck/late-read/refused cases, errored-row retry, empty `approach`, `requires` union de-dup, CC id near-misses, `$lib/` paths + Unicode tag chars in agent files, broader chunker fixture (re-pinned, version unchanged — fixture-only change).
- **Agent files:** the widened routing gate found 2 more stale examples (`ary.md`, `clyn.md`) — corrected.
- **Formatter hazard:** biome rewrote the hidden-character regex's `\u` escapes into literal invisible characters — the check is now numeric code-point ranges with a self-test.

Recorded, not changed (with reason):
- `agent_proposal.reverted_by` / `reverted_at`, `revert_step.reverted_at` are write-only audit columns, like `approved_by` — kept on purpose.
- `retrieval.document.content_hash` has no reader since the skip moved to `derivation_key`; kept as the provenance hash (dropping it + its index is a non-additive push).
- No route-level test for `/revert` (ownership is now proven at the domain claim); no unit test of `validate.ts`'s fragment check beyond the gate run over 31 real fragments; asset gate scans `static/models` + `static/images/parts` only; `heading-anchors` omits the content-syntax directives (documented).
- `ingest()` still resolves the chat model inside retrieval (known ai↔retrieval cycle; fix = inject the model) — `ingestIfChanged` carries it too.
- `render.ts` `slugifyBase` duplicates `doc-filter.ts` `slugify` (pre-existing).

## I. Completion report

**Already available (recorded as patterns, no new runtime):** P01 source-of-truth gates (≥10 instances), P05 reproducible builds (wasm manifest, `--check` generators, perf snapshot), P09 durable execution (outbox, proposals, dbops), P10 evidence dimensions, P11 versioned document session, P07 temporal (showcase) — now deep/light records with docs in `docs/blueprint/integrity/` and `relational.md`.

**Extended:** P15 registry fitness fields (`avoid_when`, `alternatives`, `requires`) across schema, both MCP runtimes, AI tool, generated index + pages; P14 `deskbot-approval-gate` with fence + executable revert (schema, domain, route, client, UI, i18n); P12 credits → asset rights; P13 `agent-experience` with routing/anchor gates.

**Newly implemented:** `derivationKey()` + keyed docs/desk ingest (P04/P02), `restoreFile`, revert receipts table, asset-rights module, `heading-anchors.server.ts`, `agent-instructions.gate.test.ts`, `pattern-library/fitness.ts`.

**Merged:** P02+P04+P05 share one docs file and vocabulary (derivation); P13 and P06 folded into `agent-experience` + one light record; P11 recorded as a document session, not local-first sync.

**Deferred:** P03 versioned contracts (no consumer; conflicts with no-back-compat; trigger + approach recorded); W3C quote/position selectors (P06) until chunk-level citations exist; runtime anchor checks in chat citations (F15); decision log / state snapshot (P13); CRDT/offline sync (P11); `formatVersion` rename (F14, DB data).

**Rejected:** P08 digital twin (no domain, no consumer); a workflow engine (P09).

**Verified:** all gate legs green (above); browser: `/docs/blueprint/integrity/truth`, `/credits` asset section, mutability `#temporal` showcase render; Neon DDL verified by catalog query. **Not verified in a browser:** approve → Undo on the desk (F11).

**Experimental / unmeasured:** the effect of `avoid_when` on agent choices (no study shows it; A/B of 10–20 architecture prompts is next research).

**Open for Stas:** F5 re-run ingest after quota reset · F6 drop redundant `agent_proposal_exec_unique_idx` · F11 click-test Undo · F14 format-version naming vs stored workspaces · F10 in-loop creates have no receipt/origin · digest-pinned base images · Resend idempotency key for email delivery (F8).

## Follow-on: `architecture-external-service` (2026-10-22, branch `claude/eager-davinci-huj9oh`)

Separate from P01–P15; same coordination rules (one writer on `registry.json`, gate per phase,
`patterns:build` + `mcp:excerpts:build` after the registry edit). Plan of record:
`docs/blueprint/architecture/external-service.md` (the doc is the decision record).

- Phases 2–4 (Rust service + container, typed adapter + contract chain, showcase) committed;
  evidence in the commit messages and the doc's Measurement section.
- Registry: new deep record `architecture-external-service` (proven — local container, real
  adapter, browser showcase; **remote Render verification pending**), new requirement
  `container-host`, `DAG_SHORT_LABELS` entry.
- Cloud-session notes: Docker Hub rate-limited (429) → the pinned builder digest was pulled
  from `mirror.gcr.io` (same digest); image builds needed the sandbox proxy CA added in a
  scratch copy of the Containerfile (not committed); `check.sh` ran in `--host` mode. Podman
  itself was not available — local Podman run is for Stas.
- Open: hosted verification on Render (owner-gated: create service, set secrets); Podman run
  of `smoke.sh` + compose profile on the host; `db:ingest-docs` for the new doc (needs DB).
- Phase 6 review (secy, tesy, ary — read-only, fresh context): verified and fixed an
  **unauthenticated panic** (byte-offset `truncate` inside a UTF-8 char in the access log;
  same in the 400 message), missing header-read timeout/connection cap (slowloris), token
  whitespace → permanent 401, honeypot bypass via missing `renderedAt` (`Number(null)` = 0),
  three misclassifications in `callService`, drill-only options in the client signature,
  `contractDrift` blind spots (`paths`, unmodelled keywords), manifest gaps (script not
  hashed, hashed after the run, runner misrecorded), naming collisions (`adapter`,
  `scenario`, bare `Step`/`Refusal`). Domain decisions taken: refund after a paid
  cancellation is allowed; paying a paid order is `exceeds_balance`.
- Perf ratchet: `total_client_js_kb` +7.5 KB from the new showcase route — re-accepted via
  `perf:snapshot` (deliberate; recorded in the PR).
