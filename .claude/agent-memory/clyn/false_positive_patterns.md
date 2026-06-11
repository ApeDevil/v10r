---
name: false-positive-patterns
description: Velociraptor-specific "looks dead but isn't" rules — entry points and conventions that make live code appear unused to a src/-only grep
metadata:
  type: project
---

Patterns that make live code look dead in v10r. Always check these before flagging a server export as unused.

**Why:** A `src/`-only import grep produces false positives because several real entry points and consumption paths live outside `src/` or use indirection.

**How to apply:** Before marking any `$lib/server` export dead, run the importer grep across BOTH `src/` AND `scripts/`, and account for the cases below.

- **`scripts/` are real entry points.** Many `db:*` npm scripts (`db:catalog-sync`, `db:seed`, `db:ingest-docs`, `db:search-backfill`, etc.) import directly from `src/lib/server/**` via relative paths like `../../src/lib/server/graph/catalog`. Example burned me: `seedCatalogResources` (graph/catalog.ts) and `deriveCatalogGraph` (search/catalog-projection.ts) looked dead in `src/` but are the payload of `scripts/db/catalog-sync.ts`. Grep `scripts/` too.

- **Cron jobs use a string-keyed registry.** `src/lib/server/jobs/index.ts` exports `jobs: Record<string, Job>` dispatched by `/api/cron/[job]/+server.ts` via `params.job`. A job function is live only if registered in that record — not by import alone. Conversely, a cleanup/expiry function NOT in the registry (e.g. `expireStaleProposals`) is genuinely dead even though sibling functions in the same file are heavily used.

- **Test-only exports.** Some functions are `export`ed solely so their `*.test.ts` can import them, while the production path calls them in-file (e.g. `createOnFinish`, `resetCooldowns`, `deduplicateAndCap`, `deriveCatalogGraph`, `updateConversationTitle`). These are NOT removable — the `export` keyword is load-bearing for the test. Classify as "test-only export," not dead code.

- **Over-broad `export` on internally-used symbols.** Many `*ErrorKind` union types and config interfaces (`Neo4jErrorKind`, `RetrievalErrorKind`, `ProviderLimit`, `UsageSource`) are `export`ed but only referenced inside their own file as a field/param type. The type is alive; only the `export` is unnecessary. Low value, not a removal target.

- **`(dev)` route group probes are intentional.** `src/routes/[[locale=locale]]/(dev)/llmwiki-probe/+server.ts` has zero inbound links and 404s in production by design — it is a dev-only end-to-end harness that exercises real modules. Do not flag dev-group routes as orphaned.

- **`(public)/showcases/**` are documentation.** Showcase pages are the project's living docs/tests. Never propose deleting them. They are also legitimate sole consumers of server queries (e.g. `getTopPaths`/`getEntryPages`/`getExitPages` are used only by `showcases/analytics/journeys`).

- **The `_redirects.ts` "legacy" set is live.** `search/adapters/_redirects.ts` `REDIRECT_HREFS` excludes hub pages from the search index. The "old nav/search-pages" comment reads like compat residue but the set is actively consumed by `pages.ts` and `showcases.ts` adapters.

- **"legacy {role, content}" message format is NOT dead compat.** `validation.ts`, `system-prompt.ts`, `chat-orchestrator.ts` accept both `{role, content}` and UIMessage `{id, role, parts}`. The `{role, content}` branch is still actively emitted by clients (`/api/ai/chat/stream/+server.ts`, `TraceDrawer.svelte`). Despite the "legacy" label, do not flag as a backward-compat shim.
