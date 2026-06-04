# apy Memory Index

## Project

- [Chat surface contract](project_chat_surface_contract.md) — 3 chat surfaces share POST /api/ai/chat; grounding via client-sent useLlmwiki/useRetrieval booleans, only rag-chat sets them
- [AI budget not wired](project_ai_budget_not_wired.md) — checkUserBudget exists but isn't called from the chat route; only rate limiter gates it
