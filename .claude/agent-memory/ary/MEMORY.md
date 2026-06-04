# ARY Memory — Static Architecture

## Project

- [Chat grounding wiring](project_chat_grounding_wiring.md) — why RAG/catalog grounding works only on rag-chat showcase; the transport-body DRY gap across 3 chat surfaces
- [Docs RAG ingestion gap](project_docs_rag_ingestion_gap.md) — docs/**/*.md not in corpus; reuse rawrag/ingest, llmwiki compile is a scaffold, manifest reader is Vite-only
- [Admin nav duplication](project_admin_nav_duplication.md) — sidebar structure dupes: inline grouped array in admin/+layout.svelte vs flat adminNavItem in $lib/nav/nav.ts
