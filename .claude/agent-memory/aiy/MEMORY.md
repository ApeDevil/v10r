# aiy memory

## Project
- [Chat grounding branches](project_chat_grounding_branches.md) — three chat surfaces share /api/ai/chat; llmwiki branch returns early WITHOUT desk tools, so useLlmwiki + desk:* scopes contend in one turn
- [Chat corpus ownership](project_chat_corpus_ownership.md) — all RAG retrieval is hard-scoped to one userId; project-docs needs a system-owned corpus + can't import Vite-only docs/manifest.ts
- [AI telemetry gap](project_ai_telemetry_gap.md) — RESOLVED: conversation_step now writes provider/model/tokens; remaining gaps = no cost dimension, embeddings never produce a step row, fallback turns skip step capture
- [AI provider architecture](project_ai_provider_architecture.md) — default CHAT = Groq llama-3.3-70b (NOT Gemini); Gemini only as tool-provider fallback + shared embedding key (no embed fallback)
- [Provider quota capture](project_provider_quota_capture.md) — step=RPD-unit but lower-bound (3 leaks); don't scrape headers (streaming drops them) → 429 Redis counter; pre-empt ONLY free Gemini; display = 2 axes never conflated
