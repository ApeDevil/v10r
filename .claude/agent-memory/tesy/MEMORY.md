# TESY Agent Memory

- [Universal search test plan scope (June 2026)](project_universal_search_test_plan.md) — search feature on branch `meaning`; test plan delivered, no test files written yet
- [Catalog-chatbot E2E test plan (June 2026)](project_catalog_chatbot_e2e_plan.md) — browser test plan for search_catalog tool + citation chips (NOTE: its "useLlmwiki NOT on floating widget" claim is now STALE — see entry below)
- [Sidebar chatbot grounding test plan (June 2026)](project_sidebar_chatbot_grounding_testplan.md) — branch `meaning`: floating Chatbot now ALWAYS sends useLlmwiki:true; P0 catalog + P1 docs nRAG via model-invoked search_project_docs; verified failure modes + missing unit tests
- [Coverage-gap audit (2026-06-11)](project_coverage_audit_jun2026.md) — zero-test files (match.ts, regconfig, searchContent, search-docs tool, admin-queries telemetry, quota); circuit breaker Redis path untested; what's already covered
