# AI SDK

Mental models and framework choices for AI integration. Vercel AI SDK for pipeline flows, LangChain for graph flows.

## Pipeline Flow vs Graph Flow

The core decision framework for choosing AI tooling:

```
Pipeline Flow                    Graph Flow
─────────────                    ──────────
[A] → [B] → [C]                 [A] ⇄ [B]
                                  ↘   ↙
Sequential                         [C]
Deterministic                       ↓
You define the path             [D] ⇄ [E]

                                Cycles, branches
                                LLM navigates the graph
```

| Aspect | Pipeline Flow | Graph Flow |
|--------|---------------|------------|
| Structure | Linear, sequential | Non-linear, branching |
| Control | You define the path | LLM discovers the path |
| Predictability | Deterministic steps | Emergent behavior |
| Complexity | Simple | Complex |
| Data analogy | PostgreSQL (tables, rows) | Neo4j (nodes, relationships) |

## Framework Choice

| Flow Type | Framework | Use Case |
|-----------|-----------|----------|
| **Pipeline** | Vercel AI SDK | Chat, streaming, tool calling, RAG |
| **Graph** | LangChain | Autonomous agents, multi-step reasoning |

### Vercel AI SDK (Default)

For most AI features. Handles:
- Streaming responses
- Tool/function calling
- Multi-provider abstraction
- Simple multi-step with `maxSteps`

Pattern: `generateText({ model, prompt })` for simple, `generateText({ model, tools, maxSteps })` for tool-calling pipelines.

### LangChain (When Needed)

For autonomous agents where the LLM decides the execution path. Pattern: `createReactAgent({ llm, tools })` where the agent dynamically decides: Think → Act → Observe → Think → Act...

See [blueprint/ai/](../../blueprint/ai/) for implementation details.

## Decision Matrix

| Scenario | Flow | Framework |
|----------|------|-----------|
| Chat interface | Pipeline | AI SDK |
| RAG (retrieve + generate) | Pipeline | AI SDK |
| Background job: summarize data | Pipeline | AI SDK |
| Tool calling (you define tools) | Pipeline | AI SDK |
| Multi-step with `maxSteps` | Pipeline | AI SDK |
| Agent decides what to query | Graph | LangChain |
| Agent spawns sub-agents | Graph | LangChain |
| Complex state machines | Graph | LangChain |
| Custom memory across sessions | Graph | LangChain |

## RAG Without LangChain

RAG is a pattern, not a library. The pattern is: Retrieve (query your database) → Augment (inject context into prompt) → Generate (call LLM). AI SDK handles this natively without LangChain.

LangChain adds value only if you need the LLM to generate queries dynamically.

See [blueprint/ai/graph-rag.md](../../blueprint/ai/graph-rag.md) for implementation details.

## Stack Integration

| Component | Role |
|-----------|------|
| **Vercel AI SDK** | LLM abstraction layer |
| **Neo4j** | Knowledge graph for Graph RAG |
| **PostgreSQL** | Structured data, embeddings storage |
| **Groq** | Fast chat (300+ tokens/sec) |
| **Mistral** | Embeddings (EU-based) |
| **Together AI** | Image generation |

## Deployment Note

Vercel AI SDK is **not** tied to Vercel infrastructure. Works with:
- Vercel (Node.js or Bun)
- Koyeb (Bun containers)
- Any Node.js/Bun runtime

See [deployment.md](./deployment.md) for platform details.

## Related

- [../../blueprint/ai/README.md](../../blueprint/ai/README.md) - Implementation details
- [../../blueprint/ai/graph-rag.md](../../blueprint/ai/graph-rag.md) - Neo4j RAG patterns
- [../vendors.md](../vendors.md) - Provider comparison and free tiers
- [../ops/deployment.md](../ops/deployment.md) - Deployment targets
- [../data/neo4j.md](../data/neo4j.md) - Graph database for RAG
