# AI / LLM Integration

Mental models and framework choices for AI integration.

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

```typescript
// Pipeline: Input → LLM → Output
const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Summarize this document',
});
```

```typescript
// Pipeline with tools: Input → LLM → Tool → LLM → Output
const { text } = await generateText({
  model,
  tools: { search, database },
  maxSteps: 5,
  prompt: 'Find and analyze competitor data',
});
```

### LangChain (When Needed)

For autonomous agents where the LLM decides the execution path:

```typescript
// Graph: LLM navigates dynamically
//   Think → Act → Observe → Think → Act...
const agent = createReactAgent({ llm, tools });
const result = await agent.invoke({
  input: 'Research competitors and decide what to investigate further',
});
```

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

RAG is a pattern, not a library. AI SDK handles it fine:

```typescript
// 1. Retrieve (your code)
const context = await neo4j.run(`
  MATCH (user)-[:PURCHASED]->(product)
  RETURN product
`);

// 2. Augment + Generate (AI SDK)
const { text } = await generateText({
  model,
  prompt: `Based on: ${JSON.stringify(context)}\n\nRecommend products.`,
});
```

LangChain adds value only if you need the LLM to generate queries dynamically.

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

- [../blueprint/ai/README.md](../blueprint/ai/README.md) - Implementation details
- [../blueprint/ai/graph-rag.md](../blueprint/ai/graph-rag.md) - Neo4j RAG patterns
- [vendors.md](./vendors.md) - Provider comparison and free tiers
- [deployment.md](./deployment.md) - Deployment targets
