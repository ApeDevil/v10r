# AI Caching Strategies

Reduce costs and latency through intelligent caching of LLM responses.

## Caching Strategies

| Strategy | Hit Rate | Quality Impact | Complexity |
|----------|----------|----------------|------------|
| Exact match | 5-10% | None | Low |
| Semantic caching | 30-40% | 2-5% drop | Medium |
| Prompt caching | Provider-dependent | None | Low |

## Exact Match Caching

Simple hash-based caching. Works for deterministic queries.

```typescript
import crypto from 'crypto';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function cachedGenerate(prompt: string, model: string) {
  const hash = crypto.createHash('sha256')
    .update(`${model}:${prompt}`)
    .digest('hex');

  const cached = await redis.get(`ai:${hash}`);
  if (cached) {
    return { result: JSON.parse(cached), cached: true };
  }

  const result = await generateText({ model, prompt });

  await redis.setex(`ai:${hash}`, 3600, JSON.stringify(result));

  return { result, cached: false };
}
```

**Limitations:** Only works for identical prompts. Typos = cache miss.

## Semantic Caching

Cache based on meaning, not exact text. Uses embeddings.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ User Query  │────▶│  Embedding   │────▶│ Vector DB   │
│             │     │  Model       │     │  Search     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌───────────────────────────┘
                    │
            ┌───────▼───────┐
            │ Similarity    │
            │ > threshold?  │
            └───────┬───────┘
                    │
          ┌─────────┴─────────┐
          │                   │
     ┌────▼────┐        ┌─────▼─────┐
     │ Return  │        │ Generate  │
     │ Cached  │        │ + Cache   │
     └─────────┘        └───────────┘
```

### Redis Vector Search Implementation

```typescript
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import Redis from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL);
const embedModel = createOpenAI()('text-embedding-3-small');

// Create index (run once)
async function createIndex() {
  await redis.call(
    'FT.CREATE', 'query_cache',
    'ON', 'HASH',
    'PREFIX', '1', 'cache:',
    'SCHEMA',
    'embedding', 'VECTOR', 'FLAT', '6',
      'TYPE', 'FLOAT32',
      'DIM', '1536',
      'DISTANCE_METRIC', 'COSINE',
    'response', 'TEXT',
    'created_at', 'NUMERIC'
  );
}

interface CacheResult<T> {
  result: T;
  cached: boolean;
  similarity?: number;
}

async function semanticCache<T>(
  query: string,
  generate: () => Promise<T>,
  options: { threshold?: number; ttl?: number } = {}
): Promise<CacheResult<T>> {
  const { threshold = 0.95, ttl = 3600 } = options;

  // Generate embedding
  const { embedding } = await embed({
    model: embedModel,
    value: query,
  });

  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  // Search for similar
  const results = await redis.call(
    'FT.SEARCH', 'query_cache',
    `*=>[KNN 1 @embedding $vec AS similarity]`,
    'PARAMS', '2', 'vec', embeddingBuffer,
    'RETURN', '2', 'response', 'similarity',
    'DIALECT', '2'
  ) as [number, ...any[]];

  if (results[0] > 0) {
    const similarity = parseFloat(results[2]?.similarity || '0');

    if (similarity >= threshold) {
      return {
        result: JSON.parse(results[2].response),
        cached: true,
        similarity,
      };
    }
  }

  // Generate and cache
  const result = await generate();
  const hash = crypto.createHash('sha256').update(query).digest('hex');

  await redis.hset(`cache:${hash}`, {
    query,
    embedding: embeddingBuffer,
    response: JSON.stringify(result),
    created_at: Date.now(),
  });
  await redis.expire(`cache:${hash}`, ttl);

  return { result, cached: false };
}
```

### Threshold Tuning

| Threshold | Description | Use Case |
|-----------|-------------|----------|
| 0.99 | Near-exact match | Financial, legal |
| 0.95 | High similarity (recommended) | General chat |
| 0.90 | Moderate similarity | FAQ bots |
| 0.85 | Loose matching | Search suggestions |

**Testing threshold:**
```typescript
// Log similarities to tune
const { result, cached, similarity } = await semanticCache(query, generate);
console.log({ query, cached, similarity });

// Analyze logs to find optimal threshold
```

## Provider Prompt Caching

Some providers cache prompt prefixes server-side.

### Anthropic Prompt Caching

```typescript
const result = await generateText({
  model: createAnthropic()('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'system',
      content: longSystemPrompt, // Cached after first call
      experimental_providerMetadata: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    },
    {
      role: 'user',
      content: userMessage, // Variable part
    },
  ],
});

// 90% discount on cached tokens
// TTL: 5 minutes (ephemeral)
```

### OpenAI Automatic Caching

OpenAI automatically caches common prompt prefixes. No configuration needed.

## Cache Invalidation

### Time-Based (TTL)

```typescript
await redis.setex(key, 3600, value); // 1 hour
```

### Event-Based

```typescript
// Invalidate when underlying data changes
async function updateProduct(id: string, data: Product) {
  await db.update(products).set(data).where(eq(products.id, id));

  // Invalidate related caches
  const pattern = `cache:*product*${id}*`;
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

### Version-Based

```typescript
const CACHE_VERSION = 'v2';

function cacheKey(query: string): string {
  return `${CACHE_VERSION}:${hash(query)}`;
}

// Increment version to invalidate all
```

## Monitoring

```typescript
// Track cache performance
let hits = 0;
let misses = 0;

async function cachedGenerate(query: string) {
  const { result, cached } = await semanticCache(query, generate);

  if (cached) hits++;
  else misses++;

  // Log periodically
  if ((hits + misses) % 100 === 0) {
    console.log({
      hitRate: hits / (hits + misses),
      hits,
      misses,
    });
  }

  return result;
}
```

## Cost-Benefit Analysis

| Factor | Consideration |
|--------|---------------|
| Embedding cost | ~$0.0001 per query |
| LLM cost | $0.01-$0.06 per 1K tokens |
| Cache hit savings | 100% of LLM cost |
| Quality trade-off | 2-5% relevance drop at 0.95 threshold |
| Break-even | ~100 cached responses per $1 embedding cost |

**Rule of thumb:** If queries have 20%+ semantic overlap, caching pays off immediately.
