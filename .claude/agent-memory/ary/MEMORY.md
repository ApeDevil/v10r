# ARY Memory — Static Architecture

## Project

- [Chat grounding wiring](project_chat_grounding_wiring.md) — why RAG/catalog grounding works only on rag-chat showcase; the transport-body DRY gap across 3 chat surfaces
- [Docs RAG ingestion gap](project_docs_rag_ingestion_gap.md) — docs/**/*.md not in corpus; reuse rawrag/ingest, llmwiki compile is a scaffold, manifest reader is Vite-only
- [Admin nav duplication](project_admin_nav_duplication.md) — sidebar structure dupes: inline grouped array in admin/+layout.svelte vs flat adminNavItem in $lib/nav/nav.ts
- [Transparency data surfaces](project_transparency_data_surfaces.md) — 3 overlapping "what data we hold" surfaces; where a real cross-domain user-data aggregator should live (adapter fan-out, not god-module)
- [Auth 2FA/passkey placement](project_auth_2fa_passkey_placement.md) — canonical homes for passkey+TOTP; corrects auth source-tree assumptions (domain-foldered schema, security mgmt already in app/account)
