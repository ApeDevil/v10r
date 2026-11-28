# Slice 2 — Entity kinds, record reconciliation and identifiers

Implemented 2026-11-28 on `claude/cloud/pattern-ontology-engineering`, continuing from `742cf8b` under ApeDevil's
Slice 1 review and Slice 2 authorization of the same day. **Stopped at the Slice 2 review checkpoint: review the
reconciliation manifest.** Slice 3 does not start, nothing merges into `main` and nothing deploys without
ApeDevil's word.

## 1. Slice 1 review items

### 1.1 S3 — hosted MCP (golden correction approved)

Four concerns are kept apart, in the registry and the benchmark alike:

| Concern | Where it lives | Infrastructure |
|---|---|---|
| Hosted MCP as a pattern (one SDK server, stateless Streamable HTTP, two eras) | `hosted-mcp` | none of its own |
| The production rate-limiting contract | `rate-limiting`, which `hosted-mcp` now builds on | `key-value-store` required (inherited, `via rate-limiting`) |
| Account-based MCP authorization | `mcp-authorization` (separate record, not a prerequisite of hosted MCP) | its own |
| DB-backed telemetry (`mcp.call_log`) and demo state | `hosted-mcp` need `relational-db` at **implementation** level, with the why | not inherited, never required of an adopter |

The registry itself is static JSON and bearer tokens come from the environment, so no database is needed to adopt
the pattern. S3 golden `needs.required` was `[relational-db, key-value-store]`; it is now `[key-value-store]`, with
the change recorded in `composition-scenarios.json` `changes` (justification, before value).

### 1.2 S8 — name check: the aggregation mechanism vs the protected endpoint

The public name-check endpoint runs `createLimiter()` before any upstream call and the limiter fails closed. That
contract is not weakened. The record was two concepts adopted under different conditions, so it is split
(manifest entry `name-check`, action `split`), and the boundary is documented in
[`docs/blueprint/name-check.md` § Pattern boundaries](../../name-check.md#pattern-boundaries):

| | `multi-source-aggregation` (new, deep) | `name-check` (feature + public endpoint) |
|---|---|---|
| What it is | Fan out to N sources under deadlines, breaker, bulkhead, per-source quota and cache; coverage rows; sealed stored credentials | Similarity, conflict signal, report contract, and the public endpoint that protects it |
| Builds on | `resilience-policy`, `deadline-propagation`, `hierarchical-cache` | `multi-source-aggregation`, `rate-limiting` |
| `external-api` | required | required (inherited) |
| `key-value-store` | conditional: distributed quotas and a shared cache | **required**: the fail-closed limiter, and `rdap.ts` imports the cache adapter directly |
| `relational-db` | conditional: stored encrypted per-user credentials | conditional (inherited) |

New invariant on `name-check`: the limiter runs before any upstream call and fails closed. The two adoption
scenarios are distinct in the benchmark: **S8** ("aggregate several external sources", revised golden =
`multi-source-aggregation` + its prerequisites, kv and relational-db conditional) and **S9** (new, "name check",
golden = `name-check` + `multi-source-aggregation` + `rate-limiting` + resilience, deadline and cache; kv
required). The original S8 golden is preserved as the `before` of its change entries.

### 1.3 Need-merging regression fixtures

`pattern-library/infrastructure-needs.fixtures.ts` holds the smallest deterministic model of need resolution:
records with needs and prerequisites, and the expected `{level, conditions, pins, origins, conflict}` per need.
`infrastructure-needs.test.ts` runs every case under **every permutation** of the root's prerequisites (result must
not depend on traversal order). No constraint engine.

| Case | Today |
|---|---|
| an unrestricted requirement does not override a pinned one | known gap (`it.fails`) |
| two different conditions are both kept | known gap |
| incompatible pins are reported as a conflict | known gap |
| a requirement dominates a condition without losing the conditional origin | known gap |
| a need shared by two prerequisites appears once with both origins (dedup without loss) | known gap |
| the record's own declaration and an inherited one both count as origins | known gap |
| optional and implementation needs never become requirements of a dependent | passes |
| a diamond reaches the shared need once | passes |

Result: 3 passing tests, 11 expected failures (the six gap cases under their permutations). The expected failures
are marked "known gap until Slice 3"; `it.fails` turns red the moment a case starts passing, so Slice 3 must flip
them to plain `it` without changing a single expectation.

### 1.4 Benchmark

`scripts/patterns/composition-bench.ts` now parses needs by level (pins included) and reports:

- `needRecall` (kept for history), `levelAccuracy`, `conditionalPromoted` (conditional shown as required),
  `requiredDowngraded` (required shown weaker or missing while its step is present or absent),
  `pinPreservation`, `optionalCoverage` (denominator: **every** expected optional constituent), spurious needs,
  and selection-independent `factNeedRecall` / `factLevelAccuracy`;
- `--expectations original` reconstructs the original golden answers by reverting every `changes` entry;
- `--rescore` replays stored plans under the current expectations; `composition-replay.ts` regenerates plans from
  an earlier worktree, so the baseline and Slice 1 are rescored under the same revised expectations as now.

Preserved: `composition-baseline.json` (the original baseline of `45d883b`, unchanged) and the original golden
answers (as `before` values). Added: `composition-baseline-plans.json` (the baseline's plans),
`composition-baseline-rescored.json`, `composition-results-original.json`. Every golden change carries a
justification that is independent of the score: S3 (§1.1), S8 (§1.2), S9 and S10 added (S10: database branch
refresh, a workflow whose `relational-db` is pinned to Postgres and which reaches Neon's API, so `external-api` is
required, a correction of the record from conditional).

Wording: the Slice 1 "100% fact recall" is stated precisely as **complete capability coverage against the current
benchmark**: given the golden steps, the registry names every need the golden scenarios expect. It says nothing
about scenarios the benchmark does not contain.

## 2. Entity kinds

`kind` is required on every record (`REGISTRY_FORMAT = 4`). The adoption semantics live once, in
`pattern-library/schema.ts` `ADOPTION_SEMANTICS`, and every reader prints them from there (card, rows, plan steps,
docs pages, README badge, Agent Skills):

| Kind | Adopting it means | Gate |
|---|---|---|
| `pattern` (163) | build it in the target project | — |
| `principle` (3) | apply it to the work; it builds nothing and is never a step to build first | no `needs`, no `depends_on` |
| `workflow` (4) | perform it as a procedure against an existing project; nothing builds on it | nothing may `depends_on` a workflow |

Principles: `design-philosophy`, `explosive-discovery`, `agent-harness-lens`. Workflows:
`dev-to-prod-schema-workflow`, `database-branch-refresh`, `database-bootstrap-seed`, `pim-sheet-transform`.

Deviation from the review proposal: `source-of-truth-gate` stays a **pattern**, because adopting it means building
a gate (a test that fails on drift), not applying a judgement. Incoming edges to a principle are still allowed
(`latent-cards → explosive-discovery`); Slice 3 types them (`informed_by`), so they are not forced into
`builds_on` now.

## 3. Reconciliation

Applied from the reviewed proposal ([reconciliation.md](./reconciliation.md)), with these principles:

- **Retire** implementation inventories, documentation views and showcases: their refs, capabilities, keywords,
  invariants, needs (as `implementation` needs with the why) and description move to the pattern they implement,
  document or demonstrate. A retired record's summary and when-to-use survive on the note of its first transferred
  ref.
- **Merge** genuine duplicates (four), with a rewritten merged summary; the old text is listed as `dropped` with
  the reason.
- **Keep distinct concepts** even where they share files (e.g. `notification-outbox` and `notification-stream`,
  `hierarchical-cache` and `rate-limiting`).
- **Rename** ids coupled to taxonomy or misleading (D-10): "an identifier names the concept, not its
  organizational location". 105 renames plus 7 renames that also reclassify.
- **Deferred on purpose:** Desk records (`desk-*`, `deskbot-approval-gate`, `ai-deskbot`) wait for the Desk
  refactor (D-14). Ids whose prefix is part of the concept name stay: `ai-tool-harness`, `ai-surfaces`,
  `ai-cost-monitoring`, `ai-token-budget`, `ai-eval-regression-suite`, `app-shell-layout`, `pwa-update-flow`,
  `architecture-engineering`, `analytics-rollups`, `admin-area`.
- **Categories:** `toolkits` removed (emptied); `resource-anchor-integrity` moved to `integrity-truth`. An empty
  category is now a gate error.
- No aliases, compat layers or shims: every consumer is updated directly.

### Preservation gate

`pattern-library/reconciliation/preservation.gate.test.ts` reads `manifest.json` (each entry carries the full
previous record) and checks, per entry, that every item — doc/code/test/showcase refs, capabilities, keywords,
**invariants, contraindications (`avoid_when`), alternatives, emulation notes, needs**, prerequisites, summary and
when-to-use — exists on the target(s), or is listed in `dropped` with a reason. Evidence travels with the refs:
test refs are evidence, and maturity is recomputed from them. A second test scans every tracked file for a
retired or renamed id and fails on any outside the history files (`reconciliation/`, this review package, the
original baselines) and two named homonyms (i18n showcase section anchors `i18n-messages`, `i18n-formatting`, a
different concept with the same spelling).

## 4. Before / after inventory

| | Slice 1 (`742cf8b`) | Slice 2 |
|---|---:|---:|
| Records | 199 | 170 |
| Deep / light | 63 / 136 | 64 / 106 |
| Kinds | — (every record a "pattern") | 163 pattern, 4 workflow, 3 principle |
| Categories | 30 | 29 |
| depends_on edges | 87 | 90 |
| Ids starting with a taxonomy prefix | 149 | 11 |
| Refs (docs, code, tests, showcases) | 1180 | 1146 |
| Capabilities | 648 | 649 |
| Invariants | 307 | 308 |
| Maturity | 26 implemented, 173 proven | 24 implemented, 146 proven |
| Need declarations by level | 36 implementation, 106 required, 30 conditional, 1 optional | 36 implementation, 96 required, 26 conditional, 1 optional |

Fewer refs are deduplicated paths: the same file referenced by a retired record and its target is one ref now.
Capabilities rose by one (`source-of-truth-gate`, §6).

## 5. Reconciliation manifest

The authority is [`pattern-library/reconciliation/manifest.json`](../../../../pattern-library/reconciliation/manifest.json)
(143 entries: 1 split, 4 merge, 26 retire, 7 rename+reclassify, 105 rename). Each entry has the previous id, the
target, action, kind, reason, what was transferred, what was dropped (with reason), relationships affected,
consumers updated, and the full previous record. The table below is generated from it.

| Previous id | → | Action | Kind | Reason | Transferred | Dropped (with reason) | Relationships |
|---|---|---|---|---|---|---|---|
| `name-check` | `name-check + multi-source-aggregation` | split | pattern | Slice 1 review (ApeDevil, 2026-11-28): the reusable multi-source aggregation mechanism and the protected public name-check endpoint are adopted under different conditions and need different infrastructure. The mechanism (deadlines, breaker, bulkhead, quota and cache per source, coverage rows, sealed credentials) becomes multi-source-aggregation, where the key-value store and relational database are conditional; name-check keeps the feature (similarity, conflict signal, report contract) and the public endpoint, which builds on rate limiting, so the key-value store is required there. | multi-source-aggregation: code: check.ts, name-source.ts, connections.ts; tests: check.test.ts, connections.test.ts; invariants: coverage rows, manual links, sealed credentials, per-source quota/breaker/deadline; avoid_when: one reliable upstream; alternatives: both; emulation_notes: NameSource, error-class mapping, credentials closure, onSourceSettled; needs: external-api required; key-value-store and relational-db conditional | capabilities: moved to multi-source-aggregation, the record that now owns the mechanism; invariants: split in two: the per-source quota, breaker and deadline half is an invariant of multi-source-aggregation; the limiter half is an invariant of name-check, sharpened to state that the limiter fails closed; summary: split: the mechanism half is the summary of multi-source-aggregation, the similarity and conflict-signal half is the summary of name-check (which adds the protected endpoint) | name-check now builds on multi-source-aggregation and rate-limiting instead of resilience-policy, deadline-propagation and hierarchical-cache (multi-source-aggregation builds on those) |
| `analytics-my-data-transparency` | `gdpr-data-rights` | merge | pattern | The same collectUserData report as the GDPR data-rights record, shown to the visitor; one concept. | code 1; showcases 1; capabilities 2; keywords 4; needs 1 | summary: rewritten into gdpr-data-rights's merged summary | — |
| `jobs-platform-scheduling` | `job-scheduling` | merge | pattern | The same scheduler: "the platform owns only the clock" is already job scheduling's first invariant. | docs 1; code 1; capabilities 2; keywords 3 | — | — |
| `forms-advanced-patterns` | `schema-validated-forms` | merge | pattern | Three variations of the same submit flow (confirm before submit, reset after submit, edit existing data) with no invariants of their own; they are tactics of schema-validated forms. | showcases 3; capabilities 3; keywords 7 | — | — |
| `app-shell-style-randomizer` | `visitor-style-resolution` | merge | pattern | Same code (src/lib/server/style), same showcase (/showcases/shell/style) and the same concept as admin-privacy-style-picking: the randomizer is one input of visitor style resolution. | docs 1; code 1; capabilities 2; keywords 3 | — | — |
| `ai-chat-assistant` | `ai-surfaces` | retire | pattern | The chatbot half of AI surfaces, already covered there (chat-orchestrator.ts, the chatbot composite, the showcase). | docs 1; capabilities 1; keywords 3 | — | — |
| `ui-composites` | `component-system` | retire | pattern | The composites layer of the component system; the system is the pattern. | showcases 1; capabilities 2; keywords 1 | — | — |
| `ui-layout-primitives` | `component-system` | retire | pattern | The layout layer of the component system; the system is the pattern. | descriptionOn 1; capabilities 2; keywords 4 | — | — |
| `ui-menus` | `component-system` | retire | pattern | One component family of the component system. | code 3; showcases 1; capabilities 2; keywords 5 | — | — |
| `ui-primitives` | `component-system` | retire | pattern | The primitives layer of the component system (an inventory with a volatile count); the system is the pattern. | docs 1; showcases 1; capabilities 2; keywords 2 | — | latent-cards now builds on component-system instead of ui-primitives |
| `ui-split-panes` | `component-system` | retire | pattern | One component family of the component system. | code 2; showcases 1; capabilities 2; keywords 3 | — | — |
| `ui-tables` | `component-system` | retire | pattern | One component family of the component system. | code 1; showcases 1; capabilities 1; keywords 3 | — | — |
| `viz-diagrams` | `data-visualization` | retire | pattern | A component family (flow and state diagrams) of the data-visualization pattern. | code 1; showcases 1; capabilities 3; keywords 5 | — | — |
| `viz-maps` | `data-visualization` | retire | pattern | A component family (MapLibre maps) of the data-visualization pattern. | code 1; showcases 1; capabilities 3; keywords 5; needs 1 | — | — |
| `viz-plots` | `data-visualization` | retire | pattern | A component family (scatter, heatmap) of the data-visualization pattern. | code 1; showcases 1; capabilities 2; keywords 4 | — | — |
| `viz-timelines` | `data-visualization` | retire | pattern | A component family (timelines) of the data-visualization pattern. | code 1; capabilities 1; keywords 4 | — | — |
| `ui-typography` | `design-tokens` | retire | pattern | Typography components that apply the token type scale; an inventory of the design tokens. | code 1; showcases 1; capabilities 1; keywords 4 | — | — |
| `identity-user-management` | `gdpr-data-rights` | retire | pattern | The account routes of v10r (profile, settings, security, data export); its data-access layer and pages back the data-rights surfaces. | code 1; showcases 1; capabilities 1; keywords 4 | — | — |
| `databases-cache` | `hierarchical-cache` | retire | pattern | The Redis client: the technology binding of the hierarchical cache's shared tier, not a separate pattern. | docs 2; code 1; showcases 3; capabilities 1; keywords 5 | — | — |
| `admin-privacy-feedback` | `honeypot` | retire | pattern | A feedback form whose only reusable part is the honeypot that protects it; it becomes the honeypot's implementation evidence. | code 1; showcases 1; capabilities 2; keywords 3; needs 1 | — | — |
| `toolkits-image-kit` | `image-metadata-reader` | retire | pattern | A showcase page chaining the metadata reader, a frame cropper and an embedder; it becomes evidence of the image metadata reader. Its category (toolkits) is removed. | docs 1; code 1; showcases 1; capabilities 3; keywords 6 | — | — |
| `jobs-registered-catalog` | `job-scheduling` | retire | pattern | The list of v10r's concrete jobs; instances of the job-scheduling pattern. | code 1; showcases 1; capabilities 2; keywords 7; needs 1 | — | — |
| `architecture-codebase-map` | `multi-client-core` | retire | pattern | A where-does-X-live table: nothing to emulate. Its doc moves to the architectural style whose placement rules it maps. | code 1; capabilities 1; keywords 5 | — | — |
| `architecture-request-cycle-visualizer` | `multi-client-core` | retire | pattern | A didactic showcase of the form, API and AI request cycles — the three clients of the multi-client core — not a pattern; it becomes that pattern's showcase evidence. | code 2; showcases 3; capabilities 2; keywords 6; needs 2 | — | — |
| `architecture-runtime-layers` | `multi-client-core` | retire | pattern | Describes v10r's layer hierarchy (a documentation view), not a reusable solution; its doc and anchor move to the architectural style it documents. | code 1; capabilities 2; keywords 5 | — | — |
| `notifications-schema-delivery-log` | `notification-outbox` | retire | pattern | The schema of the notification outbox (connections, tokens, subscriptions, delivery log); part of that composite, not a separate concept. | docs 1; code 1; tests 2; capabilities 2; keywords 4 | — | — |
| `analytics-live-feed` | `notification-stream` | retire | pattern | A showcase demo over synthetic events, not production analytics; it demonstrates the SSE stream pattern. | docs 1; code 2; showcases 1; capabilities 2; keywords 4 | — | — |
| `forms-basic-forms` | `schema-validated-forms` | retire | pattern | Reference contact and settings forms: evidence of the schema-validated form stack, not a separate concept. | showcases 2; capabilities 1; keywords 5 | — | — |
| `3d-static-animated-scenes` | `threlte-integration` | retire | pattern | The shared scene component of the Threlte integration (static or animated GLTF). | docs 1; code 1; showcases 2; capabilities 3; keywords 3 | — | — |
| `app-shell-settings` | `visitor-style-resolution` | retire | pattern | A settings page of v10r (theme cookie, language, privacy, accessibility), not a recurring solution; its theme and preference refs move to visitor style resolution. | docs 1; code 1; showcases 1; capabilities 3; keywords 6 | — | — |
| `ui-decorative` | `visitor-style-resolution` | retire | pattern | Decorative components that exist to give the style randomizer something to vary; an inventory of the style-resolution pattern. | code 1; showcases 1; capabilities 1; keywords 5 | — | — |
| `ai-harness-lens` | `agent-harness-lens` | rename+reclassify | principle | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). Kind: principle. "A conceptual audit lens (not a module)", its own summary: applied when reviewing an agent harness. | — | — | — |
| `db-ops-bootstrap-seed` | `database-bootstrap-seed` | rename+reclassify | workflow | Taxonomy prefix removed; "DB" abbreviation spelled out. Title: "DB bootstrap & seed" → "Database bootstrap and seed". Kind: workflow. A procedure performed to bring a database to a known state. | — | — | — |
| `db-ops-branch-refresh` | `database-branch-refresh` | rename+reclassify | workflow | Taxonomy prefix removed; the title named the vendor (Neon) instead of the procedure, which is a database branch refresh pinned to Postgres. Title: "Neon branch refresh from prod" → "Database branch refresh from production". Kind: workflow. A procedure performed against an existing database host; nothing builds on it. | — | — | — |
| `ui-design-philosophy` | `design-philosophy` | rename+reclassify | principle | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). Kind: principle. A set of design rules applied to every UI decision; it builds nothing by itself. | — | — | — |
| `db-ops-dev-prod-schema-workflow` | `dev-to-prod-schema-workflow` | rename+reclassify | workflow | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). Kind: workflow. A procedure performed on every schema change against an existing database. | — | — | — |
| `ui-explosive-discovery` | `explosive-discovery` | rename+reclassify | principle | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). Kind: principle. A review heuristic ("a review heuristic, not a rule", its own docs) applied to dense pages and menus. | — | — | — |
| `pim-sheet-transform-recipe` | `pim-sheet-transform` | rename+reclassify | workflow | "recipe" is the artifact the workflow produces, not the workflow. Kind: workflow. An agent procedure performed per supplier file (propose, run, check, revise); its engine is the procedure's tooling. | — | — | — |
| `admin-privacy-admin-area` | `admin-area` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-agent-user-interaction` | `ag-ui-endpoint` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-agent-actions` | `agent-actions` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-agent-observability` | `agent-observability` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-agent-skills` | `agent-skills` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-agent-to-agent` | `agent-to-agent` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-agentic-architecture` | `agentic-architecture` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `anti-abuse-ai-budget` | `ai-token-budget` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `analytics-rollup-cleanup` | `analytics-rollups` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `velocity-asset-delivery` | `asset-delivery-pipeline` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `admin-privacy-audit-log` | `audit-log` | rename | pattern | Taxonomy prefix removed; announcements live in the same admin module but are a feature, not part of the audit-log pattern. Title: "Audit log and announcements" → "Audit log". | — | capabilities: announcements is a feature that shares the admin module, not a capability of the audit-log pattern; kept as a keyword and in the summary so it stays findable; summary: rewritten: the summary now describes the audit trail and names the announcements feature as a neighbour in the same module rather than part of the pattern | — |
| `forms-auth-forms` | `auth-forms` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `content-blog-engine` | `blog-engine` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `anti-abuse-bot-decision-audit` | `bot-decision-audit` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-chatbot-session` | `chatbot-session` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-site-awareness` | `chatbot-site-awareness` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-quick-search` | `command-palette` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `content-comments` | `comments` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ui-component-system` | `component-system` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `velocity-compute-locality` | `compute-locality` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `admin-privacy-consent-cookies` | `consent-cookies` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `analytics-consent-sessions` | `consent-gated-sessions` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `admin-privacy-data-retention` | `data-retention` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `viz-charts` | `data-visualization` | rename | pattern | Taxonomy prefix removed; becomes the one data-visualization pattern the five component inventories fold into. Title: "Charts" → "Data visualization". Its summary and when-to-use were rewritten to cover the records merged into it. | — | summary: rewritten into the summary of data-visualization, which now also covers the records merged or retired into it; every fact of the old text is kept there; when_to_use: rewritten into the when_to_use of data-visualization, which now also covers the records merged or retired into it; every fact of the old text is kept there | — |
| `admin-privacy-pairing` | `debug-pairing` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-deployment` | `deployment-target` | rename | pattern | Taxonomy prefix removed; "deployment" alone named an activity, the record is the deployment target and adapter choice. Title: "Deployment" → "Deployment target". | — | — | — |
| `ui-design-tokens` | `design-tokens` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-empty-states` | `empty-states` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-error-handling` | `error-handling` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-external-service` | `external-service-runtime` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | alternatives: kept with the id it cites updated to the canonical id (no aliases) | — |
| `forms-file-uploads` | `file-uploads` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ui-fluid-styling` | `fluid-styling` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `analytics-funnels` | `funnels` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `admin-privacy-gdpr` | `gdpr-data-rights` | rename | pattern | Taxonomy prefix removed; the record is the data-subject rights (view, export, erase), now including the visitor "my data" page it duplicated. Title: "GDPR data transparency" → "GDPR data rights". Its summary and when-to-use were rewritten to cover the records merged into it. | — | summary: rewritten into the summary of gdpr-data-rights, which now also covers the records merged or retired into it; every fact of the old text is kept there; when_to_use: rewritten into the when_to_use of gdpr-data-rights, which now also covers the records merged or retired into it; every fact of the old text is kept there | — |
| `ai-generative-ui` | `generative-ui` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `identity-capability-grants` | `grant-requests` | rename | pattern | Taxonomy prefix removed; "capability" is already four concepts in this codebase (naming.md); the code calls these grants and grant requests (auth.grant, grant-requests.ts). Title: "Capability grants" → "Grant requests". | — | — | — |
| `databases-graph-modeling` | `graph-modeling` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-graph-rag` | `graph-rag` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `databases-graph-traversal` | `graph-traversal` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `anti-abuse-honeypot` | `honeypot` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-hosted-mcp` | `hosted-mcp` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `velocity-idle-work` | `idle-work` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-image-metadata` | `image-metadata-reader` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `jobs-scheduler` | `job-scheduling` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-keyboard-shortcuts` | `keyboard-shortcuts` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ui-latent-cards` | `latent-cards` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-loading-states` | `loading-states` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `i18n-formatting` | `locale-formatting` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `i18n-locale-routing` | `locale-routing` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `content-markdown-editor` | `markdown-editor` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `content-markdown-pipeline` | `markdown-pipeline` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-mcp-app-provider` | `mcp-app-provider` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-mcp-authorization` | `mcp-authorization` | rename | pattern | Taxonomy prefix removed; the title returns to the concept name the id and its document (mcp-authorization.md) use. Title: "Authenticated MCP services" → "MCP authorization". | — | — | — |
| `ai-mcp-client` | `mcp-client` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-mcp-evolution` | `mcp-protocol-evolution` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-middleware` | `middleware-hook-chain` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-modals` | `modal-layer-stack` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `3d-model-viewer-customizer` | `model-viewer-customizer` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `forms-multi-step-dynamic` | `multi-step-forms` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-navigation` | `navigation-structure` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `databases-neo4j-connection` | `neo4j-connection` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `viz-graphs` | `node-graph-layout` | rename | pattern | Taxonomy prefix removed; "graphs" collided with the graph database, the record is node-graph layout (D3 computes positions, Svelte renders). | — | — | — |
| `notifications-channels` | `notification-channels` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `notifications-router-outbox` | `notification-outbox` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `notifications-settings-matrix` | `notification-settings-matrix` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `notifications-sse-stream` | `notification-stream` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `identity-oauth` | `oauth-sign-in` | rename | pattern | Taxonomy prefix removed; "oauth" alone collides with the OAuth 2.1 authorization server of MCP authorization, the record is social sign-in. Title: "OAuth" → "OAuth sign-in". | — | — | — |
| `databases-object-storage` | `object-storage-adapter` | rename | pattern | Taxonomy prefix removed; "object-storage" alone is the infrastructure need of the same name, the record is the adapter over it (one name, one concept). Title: "Object storage" → "Object storage adapter". | — | — | — |
| `app-shell-page-header` | `page-header` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `analytics-pageview-hook` | `pageview-collector` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `identity-passkeys` | `passkeys` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `identity-passwordless-auth` | `passwordless-auth` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-pattern-mcp` | `pattern-mcp` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `databases-polyglot-freshness` | `polyglot-freshness` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `databases-postgres-connection` | `postgres-connection` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `content-docs-site` | `prerendered-docs-site` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `anti-abuse-captcha` | `proof-of-work-captcha` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-provider-routing` | `provider-routing` | rename | pattern | Taxonomy prefix removed; "provider" already means the AI model vendor in naming.md. | — | — | — |
| `databases-queries-mutations-split` | `queries-mutations-split` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `anti-abuse-rate-limiting` | `rate-limiting` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-sidebar` | `responsive-sidebar` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-rest-api` | `rest-api-conventions` | rename | pattern | Taxonomy prefix removed; "patterns" in a pattern title said nothing, the record is the API conventions (envelope, pagination, errors). Title: "REST API patterns" → "REST API conventions". | — | — | — |
| `identity-route-guards` | `route-guards` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `databases-schema-type-inference` | `schema-type-inference` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `forms-superforms-valibot` | `schema-validated-forms` | rename | pattern | Taxonomy prefix and library names removed: the concept is schema-validated, progressively enhanced forms; Superforms and Valibot are v10r's implementation. Title: "Superforms + Valibot foundation" → "Schema-validated forms". Its summary and when-to-use were rewritten to cover the records merged into it. | — | summary: rewritten into the summary of schema-validated-forms, which now also covers the records merged or retired into it; every fact of the old text is kept there; when_to_use: rewritten into the when_to_use of schema-validated-forms, which now also covers the records merged or retired into it; every fact of the old text is kept there | — |
| `velocity-screen-read-model` | `screen-read-model` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `pwa-service-worker` | `service-worker-caching` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-session-lifecycle` | `session-lifecycle-ui` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-state-management` | `state-management` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `architecture-testing-infra` | `testing-infrastructure` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `3d-threlte-integration` | `threlte-integration` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `app-shell-toasts` | `toasts` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ui-tonal-elevation` | `tonal-elevation` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-toon-format` | `toon-context-format` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `i18n-db-content` | `translated-database-content` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `i18n-messages` | `translated-messages` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-turn-trace` | `turn-trace` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-untrusted-content-boundary` | `untrusted-content-boundary` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `analytics-journeys` | `user-journeys` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `forms-validation-timing` | `validation-timing` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `admin-privacy-style-picking` | `visitor-style-resolution` | rename | pattern | Taxonomy prefix removed (it was misfiled under admin-privacy); merged with app-shell-style-randomizer, which is the same style-resolution system and showcase. Title: "Style picking + custom palettes" → "Visitor style resolution". Its summary and when-to-use were rewritten to cover the records merged into it. | — | summary: rewritten into the summary of visitor-style-resolution, which now also covers the records merged or retired into it; every fact of the old text is kept there; when_to_use: rewritten into the when_to_use of visitor-style-resolution, which now also covers the records merged or retired into it; every fact of the old text is kept there | — |
| `architecture-wasm-kernel` | `wasm-compute-kernel` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `pwa-manifest` | `web-app-manifest` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `pwa-web-push` | `web-push` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |
| `ai-webmcp` | `webmcp` | rename | pattern | The id carried its taxonomy location (the category prefix) or a product name instead of naming the concept; an identifier names the concept, not where it is filed (D-10). | — | — | — |

### Consumers updated

Every file that named an old id, updated directly (ids per file):

- `README.md` (142 ids)
- `docs/blueprint/3d/asset-production.md` (4 ids)
- `docs/blueprint/ai/agent-skills.md` (1 ids)
- `docs/blueprint/architecture-engineering/research.md` (1 ids)
- `docs/blueprint/architecture/agentic-architecture/matrix.md` (8 ids)
- `docs/blueprint/architecture/agentic-architecture/verification.md` (1 ids)
- `docs/blueprint/architecture/external-service.md` (2 ids)
- `docs/blueprint/architecture/mcp-evolution/README.md` (1 ids)
- `docs/blueprint/architecture/mcp-evolution/roadmap.md` (1 ids)
- `docs/blueprint/architecture/pattern-mcp.md` (2 ids)
- `docs/blueprint/name-check.md (Pattern boundaries)` (1 ids)
- `docs/blueprint/velocity/coverage.md` (5 ids)
- `docs/naming.md` (3 ids)
- `docs/pattern-library/ (generated pages)` (142 ids)
- `mcp/server.bundle.js, mcp/public-excerpts.snapshot.json (generated)` (142 ids)
- `mcp/server.test.ts` (2 ids)
- `pattern-library/architecture-engineering/checks.ts` (10 ids)
- `pattern-library/architecture-engineering/decisions.json` (24 ids)
- `pattern-library/architecture-engineering/evidence-labs.ts` (3 ids)
- `pattern-library/architecture-engineering/vocabulary.ts` (14 ids)
- `pattern-library/architecture-engineering/vocabulary.ts (external-service node kind)` (1 ids)
- `pattern-library/bench/composition-scenarios.json` (25 ids)
- `pattern-library/bench/composition-scenarios.json (S8 corrected, S9 added)` (1 ids)
- `pattern-library/bench/dev-queries.json` (55 ids)
- `pattern-library/bench/holdout-queries.json` (39 ids)
- `pattern-library/bench/holdout2-queries.json` (40 ids)
- `pattern-library/bench/results.json` (17 ids)
- `pattern-library/bench/workflows.json` (2 ids)
- `pattern-library/infrastructure-evidence.ts` (4 ids)
- `pattern-library/infrastructure-needs.ts` (1 ids)
- `pattern-library/registry.json` (143 ids)
- `skills/ (generated Agent Skills)` (142 ids)
- `src/lib/server/ai/tools/search-pattern-library.test.ts` (2 ids)
- `src/lib/server/mcp/patterns/parity.test.ts` (1 ids)
- `src/lib/server/mcp/patterns/tools.test.ts` (7 ids)
- `src/lib/server/patterns/render.test.ts` (1 ids)
- `src/lib/server/patterns/search.test.ts` (1 ids)
- `src/lib/showcases/interop/cross-protocol-scenario.test.ts` (1 ids)
- `src/lib/showcases/mcp/registry-viz.ts` (17 ids)
## 6. Benchmark comparison

All three columns are scored under the **same revised expectations** (20 scenarios: S1–S10, H1–H10): the baseline
and Slice 1 by replaying their own plans (`composition-replay.ts` on worktrees of `45d883b` and `742cf8b`, then
`--rescore`), Slice 2 by a fresh run. Files: `composition-baseline-rescored.json`, `composition-results.json`;
the Slice 1 replay is reproducible with the same two commands.

**All 20 scenarios**

| Metric | Baseline `45d883b` | Slice 1 `742cf8b` | Slice 2 |
|---|---:|---:|---:|
| Step precision % | 45.6 | 48.4 | 54.8 |
| Step recall % | 70.5 | 70.5 | 77.3 |
| Unnecessary steps | 35 | 31 | 26 |
| Missing steps | 13 | 13 | 10 |
| Optional made mandatory | 2 | 2 | 2 |
| Optional coverage % (all expected optional) | 0 | 0 | 0 |
| Need recall % (historical) | 54.3 | 74.3 | 77.1 |
| Level accuracy % | 40 | 68.6 | 71.4 |
| Conditional promoted to required | 5 | 0 | 0 |
| Required downgraded | 0 | 4 | 4 |
| Pin preservation % | 0 | 0 | 0 |
| Spurious required needs | 7 | 8 | 6 |
| Capability coverage of the golden steps % (fact need recall) | 40 | 94.3 | 100 |
| Fact level accuracy % | 28.6 | 85.7 | 100 |
| Plan tokens (estimated) | 10219 | 10690 | 10584 |

**Design (10)**

| Metric | Baseline `45d883b` | Slice 1 `742cf8b` | Slice 2 |
|---|---:|---:|---:|
| Step precision % | 42.1 | 45.3 | 52.9 |
| Step recall % | 80 | 80 | 90 |
| Unnecessary steps | 31 | 27 | 22 |
| Missing steps | 6 | 6 | 3 |
| Optional made mandatory | 2 | 2 | 2 |
| Optional coverage % (all expected optional) | 0 | 0 | 0 |
| Need recall % (historical) | 60.9 | 87 | 91.3 |
| Level accuracy % | 43.5 | 78.3 | 82.6 |
| Conditional promoted to required | 4 | 0 | 0 |
| Required downgraded | 0 | 3 | 3 |
| Pin preservation % | 0 | 0 | 0 |
| Spurious required needs | 7 | 8 | 6 |
| Capability coverage of the golden steps % (fact need recall) | 47.8 | 91.3 | 100 |
| Fact level accuracy % | 34.8 | 82.6 | 100 |
| Plan tokens (estimated) | 7788 | 8027 | 7852 |

**Holdout (10)**

| Metric | Baseline `45d883b` | Slice 1 `742cf8b` | Slice 2 |
|---|---:|---:|---:|
| Step precision % | 63.6 | 63.6 | 63.6 |
| Step recall % | 50 | 50 | 50 |
| Unnecessary steps | 4 | 4 | 4 |
| Missing steps | 7 | 7 | 7 |
| Optional made mandatory | 0 | 0 | 0 |
| Optional coverage % (all expected optional) | n/a | n/a | n/a |
| Need recall % (historical) | 41.7 | 50 | 50 |
| Level accuracy % | 33.3 | 50 | 50 |
| Conditional promoted to required | 1 | 0 | 0 |
| Required downgraded | 0 | 1 | 1 |
| Pin preservation % | n/a | n/a | n/a |
| Spurious required needs | 0 | 0 | 0 |
| Capability coverage of the golden steps % (fact need recall) | 25 | 100 | 100 |
| Fact level accuracy % | 16.7 | 91.7 | 100 |
| Plan tokens (estimated) | 2432 | 2663 | 2732 |

**Under the original expectations** (18 scenarios, original golden answers, ids translated through the manifest),
against the original committed baseline `composition-baseline.json`:

| Metric | Baseline `45d883b` (original) | Slice 2 |
|---|---:|---:|
| Step precision % | 50.0 | 51.9 |
| Step recall % | 75.7 | 73.0 |
| Need recall % | 51.6 | 80.6 |
| Spurious required needs | 5 | 5 |
| Plan tokens (estimated) | 8,453 | 8,949 |

Step recall falls 2.7 points under the original expectations only because the original S8 golden answer wanted
`name-check` for a generic aggregation request; after the split the planner correctly answers with
`multi-source-aggregation`. That is the corrected expectation (§1.2), not a regression.

### Expected limitations vs regressions

- **Expected limitations (selection is Slice 4):** the 4 `requiredDowngraded` (S2 `key-value-store`,
  S6 `graph-db`, S10 and H9 `relational-db`) are all needs of golden steps the planner did not select, and
  pin preservation is 0% because the one pinned scenario (S10) does not select `database-branch-refresh` (a
  light workflow the planner cannot reach yet). Optional coverage is 0% because optional composition does not
  exist until Slice 3. Spurious needs (6) all come from unnecessary steps (S1, S3, S5).
- **Regressions:** none found. Every metric is equal or better than Slice 1 under the same expectations;
  plan tokens fell 1% from Slice 1 (+3.6% over the rescored baseline).
- **Capability coverage:** fact need recall and fact level accuracy 100% — complete capability coverage against
  the current benchmark.

### Retrieval benchmark (`mcp:bench`)

| Set | Slice 1 Acc@1 | Slice 2 Acc@1 |
|---|---:|---:|
| dev | 100 | 100 |
| holdout | 80 | 88 |
| holdout2 | 82.4 | 82.4 |

Two fixture changes, both stated: dev query p05 ("name check") now expects the split's records
(`name-check`, `multi-source-aggregation`, `rate-limiting`, the resilience, deadline and cache prerequisites);
and dev query d43 regressed after the merges through an IDF shift and was fixed with a truthful capability on
`source-of-truth-gate` ("copy drift detection", which its code does). That is dev-set tuning, disclosed as such;
holdout and holdout2 were not tuned. Part of the holdout gain comes from merges (fewer near-duplicate
competitors), not from better ranking.

## 7. Remaining semantic issues

1. **Need merging has six known gaps** (11 expected-fail fixture tests): pins overridden by unrestricted
   requirements, conditions collapsed, pin conflicts dropped silently, origins lost on dedup. Fixed in Slice 3.
2. **Principles still receive edges** (`latent-cards → explosive-discovery`) until Slice 3 types them.
3. **Desk records are untouched** (D-14): `desk-*`, `deskbot-approval-gate`, `ai-deskbot` keep their ids and
   shape until the Desk refactor.
4. **`multi-client-core` carries implementation needs from the retired request-cycle visualizer**; they are
   implementation-level with a why, so they are never inherited, but the record is broader than its title.
5. **`source-of-truth-gate` stays a pattern**, against the review's proposal (§2).
6. **A pin is invisible when its step is not selected** (S10); selection is Slice 4.
7. **13 maturity warnings** remain (records marked proven whose evidence is thin); evidence status dimensions are
   Slice 5.
8. **Old ids may persist in database rows** (e.g. stored pattern references in telemetry or analytics). No
   database was reachable from the cloud session, so this was not checked; the tree holds none.
9. **Light-record reachability** (H2, H3, H4, H8, H9) is unchanged: Slice 4.

## 8. Validation

Run on this tree in the cloud session (no container, no secrets, no database):

| Check | Result |
|---|---|
| `bun run validate` (typecheck, biome, 410 test files, MCP, bundle/apps/excerpt checks, registry, skills, i18n, content, opacity) | **passed** — 4,895 tests passed, 11 expected fail (the known need-merging gaps) |
| Preservation gate (143 entries) and no-alias scan | passed (part of the test run) |
| `bun run validate:build` (production build + perf ratchet) | **passed** — production build (adapter-vercel), 5 perf ratchets within ceilings (route JS 526.4 / 530 KB, total client JS 2,557 / 2,600 KB) |
| Composition benchmark (`patterns:bench`), revised and original expectations, rescored baseline and Slice 1 | run; §6 |
| Retrieval benchmark (`mcp:bench`) | run; §6 |
| Generated surfaces: `patterns:build`, `skills:build`, `mcp:bundle:build`, `mcp:apps:build`, `mcp:excerpts:build`, `interop:scenario` | rebuilt |

**Not run** (unavailable in the cloud session): `db:ingest-docs` (RAG ingest; needs the database), `content:check:db`,
any database query for persisted old ids, Neo4j projection checks, provider-backed (LLM) evaluations, browser
end-to-end tests of the docs pages and the MCP explorer view, and the external MCP compat kit. None of them is
claimed.
