# AI SDK

## What is it?

Open-source TypeScript toolkit for building AI-powered applications. Provides unified API across LLM providers (AI SDK Core) and framework-agnostic UI hooks (AI SDK UI). Apache 2.0 licensed, 20+ million monthly downloads.

## What is it for?

- Provider-agnostic LLM integration (OpenAI, Anthropic, Google, etc.)
- Real-time streaming responses
- Tool/function calling and agents
- Structured data extraction with Zod schemas
- Chat UIs across React, Svelte, Vue, Angular

## Why was it chosen?

| Aspect | AI SDK | Direct Provider SDK |
|--------|--------|---------------------|
| Provider switch | One line change | Full rewrite |
| Streaming | Built-in | Manual handling |
| Tool calling | Unified API | Provider-specific |
| Type safety | Full TypeScript | Varies |
| Framework support | All major | N/A |

**Key advantages:**
- Switch providers without code changes
- Handles stream parsing, tool streaming, error recovery
- Full SvelteKit feature parity (since AI SDK 5)
- Not tied to Vercel platform (works anywhere)

**Pipeline vs Graph:**
| Flow Type | Framework | Use Case |
|-----------|-----------|----------|
| Pipeline | AI SDK | Chat, streaming, RAG, tool calling |
| Graph | LangChain | Autonomous agents, multi-step reasoning |

**RAG without LangChain:** RAG is a pattern (Retrieve → Augment → Generate). AI SDK handles this natively. LangChain only needed if LLM generates queries dynamically.

**Stack integration:**
| Component | Role |
|-----------|------|
| AI SDK | LLM abstraction |
| Neo4j | Knowledge graph (Graph RAG) |
| PostgreSQL | Embeddings storage |

## Known limitations

**Bundle size:**
- AI SDK Core: ~186 KB (vs ~87 KB for standalone OpenAI client)
- Due to multi-provider support, streaming logic, Zod
- Use framework-specific packages (`@ai-sdk/svelte`) for smaller bundles

**AI SDK RSC deprecated:**
- React Server Components integration paused
- Issues: stream abort failures, component flickering, quadratic data transfer
- Use AI SDK UI instead for production

**Rapid development:**
- Pin to specific versions in production
- Breaking changes possible between major versions

**Platform independence:**
- SDK itself is platform-agnostic
- Vercel AI Gateway (optional) is Vercel-specific
- Works on Vercel, Koyeb, Railway, any Node.js/Bun runtime

## Related

- [../data/neo4j.md](../data/neo4j.md) - Graph database for RAG
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
- [../ops/logging.md](../ops/logging.md) - AI request logging
