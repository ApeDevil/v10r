# apy Memory Index

## Project

- [Chat surface contract](project_chat_surface_contract.md) — 3 chat surfaces share POST /api/ai/chat; grounding via client-sent useLlmwiki/useRetrieval booleans, only rag-chat sets them
- [AI budget not wired](project_ai_budget_not_wired.md) — checkUserBudget exists but isn't called from the chat route; only rate limiter gates it
- [Admin JSON endpoint conventions](project_admin_json_endpoint_conventions.md) — canonical /api/admin/* contract: apiOk/apiError envelope, guardApiAdmin, createLimiter, no-store; reusable AI domain fns listed
- [Provider quota contract](project_provider_quota_contract.md) — new GET /api/admin/ai/quota (not /health ext); QuotaMetric honesty flags (exact/estimated/unknown), absolute-ISO countdowns, one buildProviderQuota() serializer
- [GDPR data surface](project_gdpr_data_surface.md) — existing account exportData/deleteAccount form actions incomplete (3 of ~12 domains); /api/me/data should unify via one collectUserData(userId) domain fn powering mirror page + REST + future AI tool
