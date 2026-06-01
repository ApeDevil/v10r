---
name: catalog-chatbot-e2e-plan
description: Browser E2E test plan for Catalog-chatbot unification (search_catalog tool + CitationChip); useLlmwiki ONLY fires via rag-chat showcase at mode=llmwiki
metadata:
  type: project
---

The search_catalog tool and CitationChip only activate on the useLlmwiki branch of the orchestrator. The floating Chatbot widget (AppShell) does NOT send useLlmwiki:true. Therefore E2E tests for grounding MUST use the rag-chat showcase at /showcases/ai/retrieval/rag-chat?mode=llmwiki, not the floating chatbot button.

**Why:** The system prompt catalog rules and search_catalog tool registration are wired exclusively inside the `if (useLlmwiki && ...)` branch of orchestrateChatInner. The floating Chatbot will answer questions but will NOT call search_catalog.

**How to apply:** Always direct E2E testers to the rag-chat showcase page with ?mode=llmwiki for catalog grounding tests.
