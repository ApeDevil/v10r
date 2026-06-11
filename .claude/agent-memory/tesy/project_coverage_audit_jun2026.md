---
name: project-coverage-audit-jun2026
description: Coverage gaps audit of recently-landed areas (search engine, telemetry, quota, circuit breaker, docs tool) as of 2026-06-11
metadata:
  type: project
---

Coverage-gap audit run 2026-06-11 over the recently-landed areas. Suite ~762 tests as of Jun 4.

**Confirmed ZERO-test files (highest-value gaps):**
- `src/lib/search/match.ts` — the core lexical scorer (tokenize/scoreRecords/extractSnippet) used by BOTH the in-browser instant lane AND the docs server lane. Pure, client-safe, no I/O → trivial to test, high blast radius.
- `src/lib/server/search/regconfig.ts` — `localeRegconfig` (en/de/ru→config, else simple). One-liner contract, write/query symmetry is load-bearing.
- `src/lib/server/search/query.ts` — `searchContent` lane isolation (a failing blog lane must not kill docs lane) + `buildSearchIndex` locale-pinning. Only ever MOCKED in search-catalog.test.
- `src/lib/server/ai/tools/search-docs.ts` — `search_project_docs` tool (Jun 4). Untested. Needs PGlite (joins rag.document on source='docs') + mocked `retrieve`.
- `src/lib/server/db/ai/admin-queries.ts` — `getModelUsage` (NULL model→'unknown' COALESCE) + `getProviderUsageToday` (UTC boundary, lower-bound semantics). Zero query-layer tests. PGlite.
- `src/lib/server/ai/quota.ts` — `buildProviderQuota` reconciliation + `nextMidnightInTz` (DST/tz math). Zero tests.
- `src/lib/server/ai/provider-usage.ts` — Redis counters; only referenced via orchestrator mock.
- `src/lib/server/blog/queries.ts` `searchPublishedRevisions` — the live FTS query (regconfig symmetry, ts_headline sentinel parse pairs with blog adapter). PGlite with tsvector.

**Circuit breaker (providers.ts) — PARTIAL:** providers.test.ts covers cooldown but ONLY via the in-memory fallback (`vi.mock('$lib/server/cache', redis: null)`). The Redis path (markCooldown/cooldownResumeMs/isCooledDown with a real redis client) — the whole reason it was promoted from Map to Redis — is UNTESTED. The `px`/TTL expiry and error-swallow branches never execute under test.

**Already WELL-tested (do NOT re-audit as gaps):** search-catalog tool, catalog-citations (surface verifier = verifyCatalogCitations/normalizeCatalogPath), catalog-map, catalog-projection, tool-leak-guard (both stripTextualToolCall + stream transform), saveConversationStep mutation (attribution + null-default rows), orchestrator pure helpers (getMessageText/windowMessages/escapeXmlAttr/buildSystemPrompt/createOnFinish).

PGlite is well-established in this suite (11 test files use it) — DB-dependent gaps are LOW friction, not high.
