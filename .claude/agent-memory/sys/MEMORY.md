# SYS Agent Memory (runtime systems)

## Project

- [Blog search_vector phantom](project_blog_search_vector_phantom.md) — `blog.revision.search_vector` is queried but never created; latent 42703 landmine for any quick-search wiring
- [RAG corpus is user-scoped](project_rag_corpus_user_scoped.md) — rawrag + llmwiki queries hard-filter user_id; no shared/global corpus path; compile pipeline is a scaffold; blocks docs-grounding
- [Chat surfaces grounding](project_chat_surfaces_grounding.md) — 3 chat surfaces share /api/ai/chat; only rag-chat sets useLlmwiki/useRetrieval; useLlmwiki branch drops deskTools (no compose)
- [Chat grounding rollout](project_chat_grounding_rollout.md) — plan to wire catalog-links (A, near flag-flip) + docs-nRAG (B, real pipeline); desk-tool composition landmine, ingest() not idempotent/not Bun-importable
