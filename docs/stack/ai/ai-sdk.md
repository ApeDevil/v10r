# AI SDK

Vercel AI SDK — the multi-provider LLM abstraction (streaming, tool calling, structured output). Powers the chatbot and the Graph RAG pipeline. See the `ai-tools` skill and `docs/blueprint/ai/`.

## Why was it chosen?

- One API across providers — chat routes Groq / OpenAI / Google Gemini behind it; connect or swap a provider under Admin → AI → Models without touching call sites (`src/lib/server/ai/connections.ts` builds the registry from the saved rows). Embeddings use Google Gemini (`gemini-embedding-001`, 1536-dim) over the same saved Google connection. There is no image-generation provider.
- Handles RAG natively (Retrieve → Augment → Generate) — no LangChain needed since queries aren't LLM-generated.

**Stack integration:** AI SDK is the LLM abstraction; Neo4j holds the knowledge graph (Graph RAG); PostgreSQL stores embeddings.

## Known limitations

- Pin exact versions — breaking changes land between major versions (the project pins AI SDK v6).
- AI SDK RSC is deprecated; use AI SDK UI.

## Related

- [../data/neo4j.md](../data/neo4j.md) - Graph database for RAG
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
- [../ops/logging.md](../ops/logging.md) - AI request logging
