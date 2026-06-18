# SYS Agent Memory (runtime systems)

## Project

- [Blog search_vector phantom](project_blog_search_vector_phantom.md) — `blog.revision.search_vector` is queried but never created; latent 42703 landmine for any quick-search wiring
- [RAG corpus is user-scoped](project_rag_corpus_user_scoped.md) — rawrag + llmwiki queries hard-filter user_id; no shared/global corpus path; compile pipeline is a scaffold; blocks docs-grounding
- [Chat surfaces grounding](project_chat_surfaces_grounding.md) — 3 chat surfaces share /api/ai/chat; only rag-chat sets useLlmwiki/useRetrieval; useLlmwiki branch drops deskTools (no compose)
- [Chat grounding rollout](project_chat_grounding_rollout.md) — plan to wire catalog-links (A, near flag-flip) + docs-nRAG (B, real pipeline); desk-tool composition landmine, ingest() not idempotent/not Bun-importable
- [Provider quota runtime](project_provider_quota_runtime.md) — quota/rate-limit design: move cooldown breaker to Redis (race-free SET), hybrid A(Redis counter)+B(conversation_step COUNT), increment at provider resolution, gauge rides health poll
- [Signup flow has no server hook](project_signup_flow_no_server_hook.md) — auth completion = client goto (OTP) / BA server callback (OAuth); no databaseHooks, no first-signup signal; anonymous visitorId trail has no userId FK to link
- [2FA passwordless enforcement gap](project_2fa_passwordless_enforcement_gap.md) — BA twoFactor plugin gates ONLY credential sign-in; this stack is 100% passwordless so 2FA has ZERO sign-in enforcement OOTB; enforce via app gate + watch cookieCache staleness
- [Vision provider router gap](project_vision_provider_router_gap.md) — providers.ts routes by supportsTools only, NO supportsVision flag; Groq(default, idx 0) has no vision; any image flow MUST add resolveVisionProvider (openai>google, never groq)
