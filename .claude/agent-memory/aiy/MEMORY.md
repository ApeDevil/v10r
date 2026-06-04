# aiy memory

## Project
- [Chat grounding branches](project_chat_grounding_branches.md) — three chat surfaces share /api/ai/chat; llmwiki branch returns early WITHOUT desk tools, so useLlmwiki + desk:* scopes contend in one turn
- [Chat corpus ownership](project_chat_corpus_ownership.md) — all RAG retrieval is hard-scoped to one userId; project-docs needs a system-owned corpus + can't import Vite-only docs/manifest.ts
- [AI telemetry gap](project_ai_telemetry_gap.md) — live chat path persists only assistant text + Redis token budget; conversation_step/tool_call/audit_log schema is unwritten, no model/cost dimension exists
- [Provider quota capture](project_provider_quota_capture.md) — step=RPD-unit but lower-bound (3 leaks); don't scrape headers (streaming drops them) → 429 Redis counter; pre-empt ONLY free Gemini; display = 2 axes never conflated
