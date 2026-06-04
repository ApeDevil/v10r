---
name: project-sidebar-chatbot-grounding-testplan
description: Test plan + verified failure modes for sidebar-chatbot grounding (branch meaning) — P0 catalog + P1 docs nRAG via search_project_docs
metadata:
  type: project
---

Sidebar (floating) Chatbot grounding feature on branch `meaning`. Test plan delivered 2026-06-04 (browser plan + non-browser checks + missing-unit-test list). No test files written yet — they are RECOMMENDED, not done. See [[project-sidebar-chatbot-grounding]] (parent /memory snapshot) and [[project-catalog-chatbot-unification]].

**Why:** just-shipped, validate-green but unproven by tests; user runs browser portion with Chrome extension.

**How to apply:** if asked to actually WRITE the tests, start with the three highest-ROI co-located files below. If asked about behavior, these load-bearing facts hold as of this branch.

Load-bearing facts (verified against code 2026-06-04):
- Floating `Chatbot.svelte:136` always sends `useLlmwiki:true`. That is THE grounding switch — absent ⇒ feature is dark.
- Orchestrator (`chat-orchestrator.ts`) `useLlmwiki` / `useRetrieval` branches are mutually exclusive (early-return). Floating widget uses `useLlmwiki` ONLY. Docs reachable ONLY via model-invoked `search_project_docs` tool, never pre-retrieval.
- `buildRetrievalTools` (`ai/tools/index.ts`) wires search_catalog + search_project_docs to the SAME catalogSink. Docs rows keyed by chunk id; catalog rows too.
- Chip filter bug-shape: `chat-orchestrator.ts:740` `cited = surfaced.filter(r => text.includes(r.path))` — SUBSTRING match → prefix-collision false-positive (surfaced `/docs/foo` chips when model wrote `/docs/foobar`). Definitive disambiguator: click chip, confirm 200 + matches prose.
- Docs sink rows (`search-docs.ts`) carry NO `icon` → CitationChip falls back to `i-lucide-link`. Don't use icon as doc-chip oracle; use `surface:'doc'` in message-metadata.
- `loadConversation` rehydrates as plain text parts, NO metadata.catalogSources → reloaded conversations show prose but no chips. Only judge grounding on FRESH sends.
- Provider confound: `useLlmwiki` needs tool-capable provider (`resolvedToolModel`, not cooled down). Groq-only route → tool silently doesn't fire → chip-less answer indistinguishable from "model declined tool". Rule out via Gemini-vs-Groq A/B before filing tool-selection bug.
- Budget gate: `routes/api/ai/chat/+server.ts:35-36` 429s BEFORE orchestration when over AI_DAILY_TOKEN_CAP.
- SYSTEM_DOCS_USER_ID = 'system-docs' (config.ts:75). retrieve() hard-filters userId — tenant isolation.

Oracle rule (dominant trap): correct answer != grounded. Grounding signal = presence of `catalogSources`/`catalogCitations` message-metadata frame, NOT prose correctness. This is the headline P1 failure: confident chip-less answer from parametric knowledge.

Corpus state 2026-06-04: PARTIAL 65/92 docs (~980 chunks), Gemini daily quota hit. Confirmed-ingested: multi-client-core, state, system-abstraction, app-shell/*, quick-search/*. DB spot-check is a PREREQUISITE for P1 cases: `SELECT source_uri FROM rag.document WHERE source='docs' AND user_id='system-docs' AND deleted_at IS NULL`.

Missing tests (flagged as risky-to-ship gaps; co-locate beside source):
- `src/lib/server/ai/tools/search-docs.test.ts` — mock retrieve+db: empty query, 0-chunks (results:[] no error, sink NOT called), unresolvable parent doc (path:null, excluded from sink), throw→error envelope, limit clamp, retrieve called with SYSTEM_DOCS_USER_ID.
- `src/lib/server/rawrag/markdown-split.test.ts` — pure: fence-atomicity (both fence chars, fence containing #), heading boundaries, overflow heading re-prefix, empty→[trim], no-heading degradation.
- `catalog-citations.test.ts` — ADD substring-collision case (/docs/foobar vs surfaced /docs/foo). File already exists with other cases.
- Reachability guard: assert buildRetrievalTools(...) returns tools.search_project_docs when useLlmwiki — nothing currently pins registration.
