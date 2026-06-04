---
name: project-docs-corpus-grounding
description: where the sidebar-chatbot docs-RAG grounding feature is documented (search_project_docs, docs corpus, db:ingest-docs) and the budget-gate location
metadata:
  type: project
---

Sidebar chatbot grounding (branch `meaning`, landed 2026-06-04) is documented in `docs/blueprint/ai/layered-rag.md` — the **primary RAG doc**, sibling to the existing "Catalog Grounding" section. New "Docs Corpus (`search_project_docs`)" section covers: the tool, system-scoped ownership (`SYSTEM_DOCS_USER_ID`/`PROJECT_DOCS_COLLECTION_ID`), and `db:ingest-docs`.

**Why:** `search_catalog` answers WHERE a surface lives; `search_project_docs` answers HOW/WHY from doc bodies. Both feed the same CatalogSink → render as CitationChips. Both ride the orchestrator's `useLlmwiki` branch (always-on for the floating Chatbot).

**How to apply:** Future updates to docs-corpus / `search_project_docs` / ingestion go to `layered-rag.md`. Cross-refs also in: AI `README.md` topic table + architecture diagram, `system-abstraction.md` ("AI tools" list + "Docs corpus" entry), `codebase-organization.md` (ai/tools submodule list).

Key facts (verify against code before relying):
- `db:ingest-docs` is MANUAL — NOT chained into `db:setup` (package.json line 41 chains `db:catalog-sync`, not ingest-docs). Runs in container: `podman exec v10r bun run db:ingest-docs`.
- Budget gate `checkUserBudget` moved from orchestrator → the chat ROUTE (`src/routes/api/ai/chat/+server.ts`, after validation). `chargeTokens` stays in the orchestrator's `onFinish`. Fixed the stale "Where Enforced" claim in `docs/blueprint/abuse/ai-budget.md` that said both were in the orchestrator.
- `useLlmwiki` / `useRetrieval` orchestrator branches are mutually exclusive (type doc, line ~74 of chat-orchestrator.ts).
- Free-tier ceilings worth noting in ops/runbook prose: Gemini embeddings ~1000/day; chat generation on gemini-2.5-flash ~20/day.

**Stale doc found, left unchanged (out of scope):** `docs/blueprint/app-shell/ai-assistant.md` is heavily aspirational — wrong trigger (`⌘J` vs real `⌘?`/sidebar), fictional `RateLimiter`/`sanitizeInput`/`aiAuditLog` code that doesn't match the real `checkUserBudget` path, claude-3-haiku model. Needs a separate rewrite pass; not part of the grounding feature.
