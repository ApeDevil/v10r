# aiy memory

## Project
- [Chat grounding branches](project_chat_grounding_branches.md) — three chat surfaces share /api/ai/chat; llmwiki branch returns early WITHOUT desk tools, so useLlmwiki + desk:* scopes contend in one turn
- [Chat corpus ownership](project_chat_corpus_ownership.md) — all RAG retrieval is hard-scoped to one userId; project-docs needs a system-owned corpus + can't import Vite-only docs/manifest.ts
