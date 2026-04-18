/**
 * llmwiki lint pipeline — nightly health check.
 *
 * Status: scaffold. This is load-bearing per AIY ("do not put wiki-first
 * retrieval in front of users until lint runs nightly") — wire before
 * promoting llmwiki to the default chat retrieval surface.
 *
 * Planned entry point:
 *   lintCollection(collectionId: string | null, userId: string): Promise<LlmwikiLintIssue[]>
 *
 * Codes (see llmwiki-lint-issue.ts):
 *   WIKI_CONTRADICTION · WIKI_ORPHAN_PAGE · WIKI_STALE_TLDR ·
 *   WIKI_COMPILE_DRIFT · WIKI_BROKEN_WIKILINK · INJECTION_SUSPECTED
 */

export const LINT_SCAFFOLD = true as const;
