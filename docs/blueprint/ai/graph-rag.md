# Graph RAG

Hybrid retrieval combining knowledge graphs (Neo4j) with vector embeddings for more accurate, explainable AI responses.

---

## Overview

Graph RAG extends traditional vector-based RAG by incorporating knowledge graphs. Instead of just finding semantically similar chunks, it traverses relationships between entities to provide more comprehensive and contextually accurate answers.

```
Traditional RAG:                       Graph RAG:
┌───────────────────┐                  ┌───────────────────┐
│  User Question    │                  │  User Question    │
│        ↓          │                  │        ↓          │
│  Embed Question   │                  │  Embed Question   │
│        ↓          │                  │        ↓          │
│  Vector Search    │                  │  Vector Search ───┼──┐
│        ↓          │                  │        ↓          │  │
│  Top-K Chunks     │                  │  Top-K Chunks     │  │ Graph
│        ↓          │                  │        ↓          │  │ Traversal
│  LLM Response     │                  │  Entity Linking ←─┼──┘
└───────────────────┘                  │        ↓          │
                                       │  Relationship     │
                                       │  Context          │
                                       │        ↓          │
                                       │  LLM Response     │
                                       └───────────────────┘
```

---

## Why Graph RAG?

| Aspect | Vector RAG | Graph RAG | Winner |
|--------|------------|-----------|--------|
| **Semantic similarity** | Excellent | Good | Vector |
| **Multi-hop reasoning** | Poor | Excellent | Graph |
| **Relationship queries** | Cannot | Native | Graph |
| **Explainability** | Low | High | Graph |
| **Setup complexity** | Simple | Complex | Vector |
| **Maintenance** | Low | Medium | Vector |

### When to Use Graph RAG

| Use Case | Why |
|----------|-----|
| "What features depend on Drizzle?" | Multi-hop traversal |
| "How are users related to this item?" | Relationship discovery |
| "Show me the prerequisite pages" | Path finding |
| "What concepts are connected to auth?" | Knowledge exploration |

### When Vector RAG is Better

| Use Case | Why |
|----------|-----|
| "Find docs about error handling" | Semantic similarity |
| "What does this error mean?" | Content retrieval |
| Vague, exploratory queries | Broad semantic match |
| Large unstructured document sets | Scale |

---

## Architecture

### Hybrid Approach (Recommended)

Combine vector similarity with graph traversal for best results:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Hybrid RAG Pipeline                             │
├─────────────────────────────────────────────────────────────────────┤
│  User Question                                                       │
│       ↓                                                              │
│  ┌─────────────┐     ┌─────────────┐                                │
│  │   Mistral   │     │   Groq      │                                │
│  │  Embedding  │     │   NER       │  (Entity extraction)           │
│  └──────┬──────┘     └──────┬──────┘                                │
│         ↓                   ↓                                        │
│  ┌─────────────┐     ┌─────────────┐                                │
│  │   Neon      │     │   Neo4j     │                                │
│  │  pgvector   │     │   Aura      │                                │
│  │ (semantic)  │     │ (relations) │                                │
│  └──────┬──────┘     └──────┬──────┘                                │
│         ↓                   ↓                                        │
│  ┌─────────────────────────────────┐                                │
│  │      Merge & Rank Results       │                                │
│  └─────────────┬───────────────────┘                                │
│                ↓                                                     │
│  ┌─────────────────────────────────┐                                │
│  │  ★ encode(context) → TOON ★    │  (30-60% token savings)        │
│  └─────────────┬───────────────────┘                                │
│                ↓                                                     │
│  ┌─────────────────────────────────┐                                │
│  │     Groq LLM Response           │                                │
│  └─────────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Search Methods

| Method | Best For | Description |
|--------|----------|-------------|
| **Local Search** | Entity-specific queries | Fan out from specific entities to neighbors |
| **Global Search** | Thematic questions | Use community summaries for broad understanding |
| **Hybrid Search** | Most queries | Combine vector + graph for comprehensive results |

---

## Implementation

### 1. Knowledge Graph Construction

First, extend the existing Neo4j model (from [graph.md](../db/graph.md)) with document entities:

```typescript
// src/lib/server/graph/types.ts
// Add to existing types

export interface DocumentNode {
  id: string;
  title: string;
  content: string;
  path: string;
  chunkIndex: number;
  embedding?: number[];  // Store in Neo4j or reference pgvector
}

export interface EntityNode {
  id: string;
  name: string;
  type: 'concept' | 'feature' | 'page' | 'person' | 'component';
  description?: string;
}

// Relationship types for RAG
export type RagRelationType =
  | 'MENTIONS'        // Document mentions entity
  | 'RELATES_TO'      // Entity relates to entity
  | 'PART_OF'         // Entity is part of entity
  | 'DEPENDS_ON'      // Technical dependency
  | 'IMPLEMENTS'      // Feature implements concept
  | 'AUTHORED_BY';    // Document authored by person
```

```cypher
// Additional schema for Graph RAG
(:Document {
  id: string,
  title: string,
  path: string,
  chunkIndex: number,
  content: string
})

(:Entity {
  id: string,
  name: string,
  type: string,
  description: string
})

(:Document)-[:MENTIONS]->(:Entity)
(:Entity)-[:RELATES_TO]->(:Entity)
(:Entity)-[:PART_OF]->(:Entity)
```

### 2. Entity Extraction with LLM

Use Groq to extract entities and relationships from documents:

```typescript
// src/lib/server/ai/entity-extraction.ts
import { generateObject } from 'ai';
import { providers } from './providers';
import * as v from 'valibot';

const EntitySchema = v.object({
  entities: v.array(v.object({
    name: v.string(),
    type: v.picklist(['concept', 'feature', 'page', 'person', 'component']),
    description: v.optional(v.string()),
  })),
  relationships: v.array(v.object({
    source: v.string(),
    target: v.string(),
    type: v.picklist(['RELATES_TO', 'PART_OF', 'DEPENDS_ON', 'IMPLEMENTS']),
  })),
});

export async function extractEntities(text: string, title: string) {
  const result = await generateObject({
    model: providers.chat('llama-3.3-70b-versatile'),
    schema: EntitySchema,
    prompt: `Extract entities and relationships from this document.

Document Title: ${title}

Content:
${text}

Extract:
1. Named entities (concepts, features, components, people)
2. Relationships between entities
3. Be specific and avoid generic terms`,
  });

  return result.object;
}
```

### 3. Document Ingestion Pipeline

```typescript
// src/lib/server/graph/ingestion.ts
import { embed } from 'ai';
import { providers } from '$lib/server/ai/providers';
import { extractEntities } from '$lib/server/ai/entity-extraction';
import { getSession } from './index';
import { nanoid } from 'nanoid';

interface Document {
  title: string;
  path: string;
  content: string;
}

export async function ingestDocument(doc: Document) {
  const session = await getSession();

  try {
    // 1. Chunk document
    const chunks = chunkDocument(doc.content);

    // 2. Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `doc_${nanoid(8)}`;

      // 3. Generate embedding (Mistral)
      const { embedding } = await embed({
        model: providers.embeddings.embedding('mistral-embed'),
        value: chunk,
      });

      // 4. Extract entities (Groq)
      const { entities, relationships } = await extractEntities(chunk, doc.title);

      // 5. Store document chunk
      await session.run(`
        CREATE (d:Document {
          id: $id,
          title: $title,
          path: $path,
          chunkIndex: $index,
          content: $content
        })
      `, {
        id: chunkId,
        title: doc.title,
        path: doc.path,
        index: i,
        content: chunk
      });

      // 6. Store embedding in pgvector (for semantic search)
      await storeEmbeddingInPostgres(chunkId, embedding);

      // 7. Create/merge entities and relationships
      for (const entity of entities) {
        await session.run(`
          MERGE (e:Entity {name: $name})
          ON CREATE SET e.id = $id, e.type = $type, e.description = $description
          WITH e
          MATCH (d:Document {id: $docId})
          MERGE (d)-[:MENTIONS]->(e)
        `, {
          id: `ent_${nanoid(8)}`,
          name: entity.name,
          type: entity.type,
          description: entity.description ?? '',
          docId: chunkId,
        });
      }

      for (const rel of relationships) {
        await session.run(`
          MATCH (s:Entity {name: $source})
          MATCH (t:Entity {name: $target})
          MERGE (s)-[:${rel.type}]->(t)
        `, {
          source: rel.source,
          target: rel.target,
        });
      }
    }

    console.log(`Ingested: ${doc.title} (${chunks.length} chunks)`);
  } finally {
    await session.close();
  }
}

function chunkDocument(content: string, maxChars = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
```

### 4. Hybrid Retrieval

```typescript
// src/lib/server/graph/retrieval.ts
import { embed } from 'ai';
import { providers } from '$lib/server/ai/providers';
import { getSession } from './index';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

interface RetrievalResult {
  documents: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    source: 'vector' | 'graph';
  }>;
  entities: Array<{
    name: string;
    type: string;
    relatedEntities: string[];
  }>;
}

export async function hybridRetrieve(
  query: string,
  options = { vectorLimit: 5, graphDepth: 2 }
): Promise<RetrievalResult> {
  // 1. Embed query with Mistral
  const { embedding } = await embed({
    model: providers.embeddings.embedding('mistral-embed'),
    value: query,
  });

  // 2. Vector search (pgvector)
  const vectorResults = await db.execute(sql`
    SELECT
      id,
      title,
      content,
      1 - (embedding <=> ${embedding}::vector) as score
    FROM document_embeddings
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${options.vectorLimit}
  `);

  // 3. Extract entities from query for graph lookup
  const queryEntities = await extractQueryEntities(query);

  // 4. Graph traversal (Neo4j)
  const session = await getSession();
  let graphResults: any[] = [];
  let relatedEntities: any[] = [];

  try {
    if (queryEntities.length > 0) {
      // Find documents mentioning related entities
      const graphQuery = await session.run(`
        UNWIND $entities AS entityName
        MATCH (e:Entity {name: entityName})
        OPTIONAL MATCH (e)-[:RELATES_TO|DEPENDS_ON|PART_OF*1..${options.graphDepth}]-(related:Entity)
        OPTIONAL MATCH (d:Document)-[:MENTIONS]->(e)
        OPTIONAL MATCH (d2:Document)-[:MENTIONS]->(related)
        RETURN DISTINCT
          d.id AS docId,
          d.title AS title,
          d.content AS content,
          collect(DISTINCT related.name) AS relatedEntities
      `, { entities: queryEntities });

      graphResults = graphQuery.records
        .filter(r => r.get('docId'))
        .map(r => ({
          id: r.get('docId'),
          title: r.get('title'),
          content: r.get('content'),
          relatedEntities: r.get('relatedEntities'),
        }));

      // Get entity context
      const entityQuery = await session.run(`
        UNWIND $entities AS entityName
        MATCH (e:Entity {name: entityName})
        OPTIONAL MATCH (e)-[r]-(related:Entity)
        RETURN e.name AS name, e.type AS type,
               collect(DISTINCT related.name) AS relatedEntities
      `, { entities: queryEntities });

      relatedEntities = entityQuery.records.map(r => ({
        name: r.get('name'),
        type: r.get('type'),
        relatedEntities: r.get('relatedEntities'),
      }));
    }
  } finally {
    await session.close();
  }

  // 5. Merge and deduplicate results
  const seenIds = new Set<string>();
  const documents: RetrievalResult['documents'] = [];

  // Add vector results first (higher confidence for semantic match)
  for (const row of vectorResults.rows) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id);
      documents.push({
        id: row.id,
        title: row.title,
        content: row.content,
        score: row.score,
        source: 'vector',
      });
    }
  }

  // Add graph results (relationship-based)
  for (const doc of graphResults) {
    if (!seenIds.has(doc.id)) {
      seenIds.add(doc.id);
      documents.push({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        score: 0.8, // Base score for graph-retrieved docs
        source: 'graph',
      });
    }
  }

  // Sort by score
  documents.sort((a, b) => b.score - a.score);

  return { documents, entities: relatedEntities };
}

async function extractQueryEntities(query: string): Promise<string[]> {
  // Simple NER - for production, use Groq with structured output
  const session = await getSession();
  try {
    // Match query words against known entities
    const result = await session.run(`
      WITH split(toLower($query), ' ') AS words
      MATCH (e:Entity)
      WHERE any(word IN words WHERE toLower(e.name) CONTAINS word)
      RETURN e.name AS name
      LIMIT 10
    `, { query });

    return result.records.map(r => r.get('name'));
  } finally {
    await session.close();
  }
}
```

### 5. RAG Endpoint with Graph Context

```typescript
// src/routes/api/ai/chat/+server.ts
import { json } from '@sveltejs/kit';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { encode } from '@toon-format/toon';
import { providers } from '$lib/server/ai/providers';
import { aiConfig } from '$lib/server/ai/config';
import { hybridRetrieve } from '$lib/server/graph/retrieval';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages }: { messages: UIMessage[] } = await request.json();
    const lastMessage = messages[messages.length - 1];

    // Get relevant context via hybrid retrieval
    const { documents, entities } = await hybridRetrieve(
      lastMessage.content,
      { vectorLimit: 5, graphDepth: 2 }
    );

    // Format context as TOON (30-60% token savings)
    const context = encode({
      documents: documents.map(d => ({
        title: d.title,
        content: d.content,
        relevance: d.score.toFixed(2),
        source: d.source,
      })),
      entities: entities.map(e => ({
        name: e.name,
        type: e.type,
        related: e.relatedEntities.join(', '),
      })),
    });

    const systemPrompt = `${aiConfig.systemPrompt}

Use this context to answer questions. The context includes:
- Documents (with relevance scores)
- Entities and their relationships

Context:
${context}

When answering:
1. Cite specific documents when relevant
2. Explain relationships between concepts
3. Be concise and accurate`;

    const result = streamText({
      model: providers.chat(aiConfig.models.chat),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return json({ error: 'Failed to process chat request' }, { status: 500 });
  }
};
```

---

## Entity Linking

Connect mentions in documents to canonical entities:

```typescript
// src/lib/server/graph/entity-linking.ts
import { generateObject } from 'ai';
import { providers } from '$lib/server/ai/providers';
import { getSession } from './index';
import * as v from 'valibot';

const LinkingSchema = v.object({
  matches: v.array(v.object({
    mention: v.string(),
    canonicalEntity: v.string(),
    confidence: v.number(),
  })),
});

export async function linkEntities(text: string): Promise<Map<string, string>> {
  const session = await getSession();

  try {
    // Get existing entities from graph
    const existingResult = await session.run(`
      MATCH (e:Entity)
      RETURN e.name AS name, e.type AS type
      LIMIT 100
    `);

    const existingEntities = existingResult.records.map(r => ({
      name: r.get('name'),
      type: r.get('type'),
    }));

    // Use LLM to link mentions to entities
    const result = await generateObject({
      model: providers.chat('llama-3.3-70b-versatile'),
      schema: LinkingSchema,
      prompt: `Match entity mentions in the text to canonical entities.

Text:
${text}

Known entities:
${existingEntities.map(e => `- ${e.name} (${e.type})`).join('\n')}

For each entity mentioned in the text, find the best matching canonical entity.
Consider variations like abbreviations, synonyms, and different phrasings.`,
    });

    const links = new Map<string, string>();
    for (const match of result.object.matches) {
      if (match.confidence > 0.7) {
        links.set(match.mention, match.canonicalEntity);
      }
    }

    return links;
  } finally {
    await session.close();
  }
}
```

---

## Community Detection

For global search, build community summaries:

```typescript
// src/lib/server/graph/communities.ts
import { generateText } from 'ai';
import { providers } from '$lib/server/ai/providers';
import { getSession } from './index';

export async function buildCommunitySummaries() {
  const session = await getSession();

  try {
    // Use Neo4j's community detection (requires GDS library)
    // For Aura, use simpler clustering based on relationships

    // Group entities by their connections
    const communities = await session.run(`
      MATCH (e:Entity)-[r]-(connected:Entity)
      WITH e, collect(DISTINCT connected.name) AS neighbors
      WHERE size(neighbors) > 2
      RETURN e.name AS entity, e.type AS type, neighbors
      ORDER BY size(neighbors) DESC
      LIMIT 20
    `);

    // Generate summary for each community
    for (const record of communities.records) {
      const entity = record.get('entity');
      const neighbors = record.get('neighbors');

      const summary = await generateText({
        model: providers.chat('llama-3.3-70b-versatile'),
        prompt: `Summarize this entity cluster in 2-3 sentences:

Central entity: ${entity}
Related entities: ${neighbors.join(', ')}

Focus on what connects these entities and their overall theme.`,
      });

      // Store summary
      await session.run(`
        MATCH (e:Entity {name: $name})
        SET e.communitySummary = $summary
      `, { name: entity, summary: summary.text });
    }
  } finally {
    await session.close();
  }
}
```

---

## Cypher Queries for RAG

### Find Related Documents

```cypher
// Documents related through shared entities
MATCH (d1:Document {path: $path})-[:MENTIONS]->(e:Entity)<-[:MENTIONS]-(d2:Document)
WHERE d1 <> d2
RETURN d2.title, d2.path, count(e) AS sharedEntities
ORDER BY sharedEntities DESC
LIMIT 5
```

### Entity Neighborhood

```cypher
// Get entity with 2-hop neighborhood
MATCH (e:Entity {name: $entityName})
OPTIONAL MATCH path = (e)-[*1..2]-(related:Entity)
RETURN e, collect(DISTINCT related) AS neighborhood
```

### Document-Entity Graph

```cypher
// Get subgraph for a query context
UNWIND $entities AS entityName
MATCH (e:Entity {name: entityName})
OPTIONAL MATCH (e)-[r]-(connected)
RETURN e, r, connected
```

### Path Finding

```cypher
// Find connection path between two concepts
MATCH path = shortestPath(
  (start:Entity {name: $from})-[*..5]-(end:Entity {name: $to})
)
RETURN path
```

---

## LangChain.js Integration

For more complex chains, use LangChain.js:

```typescript
// src/lib/server/graph/langchain.ts
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { GraphCypherQAChain } from 'langchain/chains/graph_qa/cypher';
import { ChatGroq } from '@langchain/groq';

let graph: Neo4jGraph | null = null;

export async function getGraphChain() {
  if (!graph) {
    graph = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI!,
      username: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    });
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
  });

  return GraphCypherQAChain.fromLLM({
    llm: model,
    graph,
    returnDirect: false,
    returnIntermediateSteps: true,
  });
}

// Usage
export async function graphQA(question: string) {
  const chain = await getGraphChain();
  const result = await chain.invoke({ query: question });
  return {
    answer: result.result,
    cypher: result.intermediateSteps?.[0]?.query,
  };
}
```

---

## Performance Considerations

| Concern | Solution |
|---------|----------|
| **Embedding latency** | Batch embeddings, cache results |
| **Graph query speed** | Indexes on frequently queried properties |
| **LLM extraction cost** | Run during ingestion, not query time |
| **Token usage** | Use TOON format (30-60% savings) |
| **Cold starts** | Connection pooling, keep-alive |

### Recommended Indexes

```cypher
// Create indexes for faster lookups
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type);
CREATE INDEX document_path IF NOT EXISTS FOR (d:Document) ON (d.path);
CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (e:Entity) ON EACH [e.name, e.description];
```

---

## Comparison: Vector RAG vs Graph RAG

| Query Type | Vector RAG | Graph RAG | Hybrid |
|------------|------------|-----------|--------|
| "Explain authentication" | Good | Good | Best |
| "What depends on Drizzle?" | Poor | Excellent | Excellent |
| "How are forms and validation related?" | Fair | Excellent | Excellent |
| "Find error handling docs" | Excellent | Fair | Excellent |
| "Prerequisites for this page" | Poor | Excellent | Excellent |

---

## Limitations

| Limitation | Mitigation |
|------------|------------|
| **Graph construction cost** | Batch processing, incremental updates |
| **Entity extraction errors** | Review and manual correction |
| **Relationship inference** | Use domain-specific ontologies |
| **LangChain.js maturity** | Fallback to raw Neo4j driver |
| **No TypeScript SDK** | Use neo4j-driver + custom wrappers |

---

## File Structure

```
src/lib/server/
├── graph/
│   ├── index.ts           # Driver connection (existing)
│   ├── types.ts           # Node/relationship types (extend)
│   ├── queries.ts         # Read operations (existing)
│   ├── mutations.ts       # Write operations (existing)
│   ├── ingestion.ts       # Document ingestion pipeline (new)
│   ├── retrieval.ts       # Hybrid retrieval (new)
│   ├── entity-linking.ts  # Entity linking (new)
│   ├── communities.ts     # Community detection (new)
│   └── langchain.ts       # LangChain.js integration (new)
└── ai/
    ├── providers.ts       # Multi-provider setup (existing)
    ├── config.ts          # Configuration (existing)
    └── entity-extraction.ts  # LLM entity extraction (new)
```

---

## Checklist

- [ ] Extend Neo4j schema with Document/Entity nodes
- [ ] Create entity extraction with Groq
- [ ] Build document ingestion pipeline
- [ ] Implement hybrid retrieval
- [ ] Add entity linking
- [ ] Create indexes for performance
- [ ] Integrate with chat endpoint
- [ ] Add community summaries (optional)
- [ ] Set up LangChain.js for complex queries (optional)

---

## Related

- [README.md](./README.md) - AI architecture overview
- [toon.md](./toon.md) - TOON format for token savings
- [../db/graph.md](../db/graph.md) - Neo4j setup and basic model
- [../db/relational.md](../db/relational.md) - pgvector for embeddings
- [../../stack/vendors.md](../../stack/vendors.md) - Provider details

---

## Sources

- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)
- [From Local to Global: Graph RAG](https://www.microsoft.com/en-us/research/publication/from-local-to-global-a-graph-rag-approach-to-query-focused-summarization/)
- [Neo4j RAG Tutorial](https://neo4j.com/blog/developer/rag-tutorial/)
- [LangChain.js Neo4j Integration](https://neo4j.com/labs/genai-ecosystem/langchain-js/)
- [HybridRAG: Integrating Knowledge Graphs and Vector Retrieval](https://arxiv.org/abs/2408.04948)
- [Knowledge Graph vs Vector RAG - Neo4j](https://neo4j.com/blog/developer/knowledge-graph-vs-vector-rag/)
- [Graph RAG vs Vector RAG - Meilisearch](https://www.meilisearch.com/blog/graph-rag-vs-vector-rag)
- [Nearform Graph RAG JS Research](https://github.com/nearform/graph-rag-js-research)
- [GraphRAG-Bench: When to Use Graphs in RAG](https://arxiv.org/abs/2506.05690)
- [DRIFT Search: Combining Global and Local Methods](https://www.microsoft.com/en-us/research/blog/introducing-drift-search-combining-global-and-local-search-methods-to-improve-quality-and-efficiency/)
