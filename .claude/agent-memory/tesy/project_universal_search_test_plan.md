---
name: project_universal_search_test_plan
description: Universal quick-search feature on branch `meaning` — test plan scope, key risks found during design, no test files written yet
metadata:
  type: project
---

Test plan designed and delivered 2026-06-01 for the two-lane search feature (⌘K palette + /search page). Branch: `meaning`, uncommitted.

**Why:** feature touches FTS, prerender, rate-limiting, locale pinning, dedup, and XSS-safe snippet rendering simultaneously — high defect surface.

**Critical risks identified:**
1. `overwriteGetLocale` is module-global mutable state — concurrent prerender requests for different locales can race and stamp wrong locale labels into shards.
2. `parseHeadline` in blog.ts iterates headline with `for...of` (correct Unicode) but reads `HL_START`/`HL_STOP` as single chars: if `ts_headline` returns HTML-escaped content the sentinels may be surrounded by entity text and the parser would silently skip them, producing a snippet with no highlights.
3. Dedup key is `surface:path:anchor` but the `id` field on `SearchRecord` embeds locale (`page:en:/docs/...`). When de/ru users get locale-fallback doc records, the static shard has `locale=de` but the server lane returns `locale=en` with same path — dedup key matches (correct), but `.id` diverges. If any consumer de-dupes by `.id` rather than the key, duplicates appear.
4. `createSearchEngine.setLocale()` always fetches the shard but never clears old `records` during the fetch — if locale changes mid-load the instant lane briefly shows wrong-locale results.
5. `corpusCache` in docs adapter is a module-level singleton — if two test workers import docs adapter they share stale corpus across test runs.
6. Blog FTS NULL search_vector: pre-backfill rows return rank=0 but `@@ tsquery` filter uses search_vector column — NULL @@ anything = NULL (falsy), so pre-backfill rows are silently absent. Expected behavior documented, but test must confirm the blog lane returns `[]` not an error.

**How to apply:** When asked to write tests for this feature, start with #1 (locale race in buildSearchIndex) and #6 (NULL search_vector graceful empty), then cover the dedup and abort-race scenarios.
