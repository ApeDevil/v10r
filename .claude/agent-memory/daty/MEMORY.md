# DATY Memory Index

## Project
- [FTS regconfig constraint](project_fts_regconfig_constraint.md) — Neon rejects multi-field to_tsvector in generated columns (42P17); all FTS hardcodes 'english', no de/ru config exists
- [Docs RAG ingestion](project_docs_rag_ingestion.md) — ingest docs/**/*.md as source='catalog' + sourceUri=SearchRecord id (soft-pointer, no new enum/columns); owner/collection scoping is the live constraint
- [Docs corpus ownership](project_docs_corpus_ownership.md) — docs RAG gated by ownership asymmetry: rawrag doc.userId nullable but llmwiki userId/collection NOT NULL + hard-filtered; needs seeded system user; ingest() not idempotent
- [AI telemetry asymmetry](project_ai_telemetry_asymmetry.md) — tool_call/conversation_step persisted ONLY in desk-tools branch, not llmwiki/retrieval; no provider/model/cost column anywhere; llmwiki tables have zero admin query coverage
