# Model Selection and Cost Optimization

Model routing, pricing, prompt caching, and cost control patterns for production AI features.

## Claude Model Tiers (April 2026 Pricing)

| Model | Input | Output | Cache Write (5min) | Cache Read | Best For |
|-------|-------|--------|-------------------|------------|----------|
| Opus 4.6 | $5/MTok | $25/MTok | $6.25/MTok | $0.50/MTok | Complex reasoning, long-horizon agents |
| Sonnet 4.6 | $3/MTok | $15/MTok | $3.75/MTok | $0.30/MTok | Interactive chat, code, tool orchestration |
| Haiku 4.5 | $1/MTok | $5/MTok | $1.25/MTok | $0.10/MTok | Classification, routing, extraction |

**Batch API**: 50% discount on all models (non-interactive background processing).

### Tool Use Token Overhead

Each tool-enabled request adds automatic system tokens:
- 346 tokens for `auto`/`none` tool choice
- 313 tokens for `any`/`tool` tool choice
- Billed as input tokens on every request with tools defined

## Model Routing Strategy

### By Task Complexity

```
Simple classification/routing  → Haiku 4.5    (~60-70% of requests)
Interactive chat with tools    → Sonnet 4.6   (~25-30% of requests)
Complex multi-hop reasoning    → Opus 4.6     (~3-5% of requests)
```

Result: 50-60% lower average cost vs using Sonnet for everything.

### Implementation

```typescript
// src/lib/server/ai/router.ts
type TaskComplexity = 'simple' | 'moderate' | 'complex';

function classifyComplexity(query: string, hasTools: boolean): TaskComplexity {
  const wordCount = query.split(/\s+/).length;
  const hasCode = /```|function|class|import/.test(query);
  const isMultiHop = /compare|analyze|explain why|how does.*relate/.test(query);

  if (isMultiHop || (hasCode && wordCount > 200)) return 'complex';
  if (hasTools || hasCode || wordCount > 50) return 'moderate';
  return 'simple';
}

function selectModel(complexity: TaskComplexity): LanguageModel {
  switch (complexity) {
    case 'simple': return haiku;    // $1/$5
    case 'moderate': return sonnet; // $3/$15
    case 'complex': return opus;    // $5/$25
  }
}
```

### Per-Step Routing in Agents

```typescript
prepareStep: async ({ stepNumber }) => {
  // Early steps: expensive model for planning
  if (stepNumber <= 2) return { model: sonnet };
  // Later steps: cheap model for execution
  return { model: haiku };
},
```

## Adaptive Thinking (Claude 4.6)

### Effort Levels

| Effort | Use Case | Latency Impact | Cost Impact |
|--------|----------|---------------|-------------|
| `low` | High-volume classification, routing | Minimal | Minimal |
| `medium` | Most applications (recommended default) | Moderate | Moderate |
| `high` | Complex reasoning, agentic tasks | Significant | Significant |
| `max` | Hardest problems only | Very high | Very high |

```typescript
const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  messages,
  providerOptions: {
    anthropic: {
      thinking: { type: 'adaptive', effort: 'medium' },
    },
  },
  maxOutputTokens: 64_000, // Give room to think at medium/high effort
});
```

**Key**: `effort` replaces `budget_tokens` (deprecated for 4.6 models). Don't use `effort: "high"` as default — it adds latency with marginal quality gain for most tasks.

## Prompt Caching

### Anthropic Cache Control

```typescript
const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: SYSTEM_PROMPT, // Stable system prompt — prime caching target
  messages,
  providerOptions: {
    anthropic: {
      cacheControl: { type: 'ephemeral' }, // 5-minute cache (1.25x write, 0.1x read)
    },
  },
});
```

### Cache Tiers

| Cache Type | Write Cost | Read Cost | Duration | Break-Even |
|-----------|-----------|----------|----------|------------|
| 5-minute | 1.25× base | 0.1× base | 5 min | 1 cache read |
| 1-hour | 2× base | 0.1× base | 1 hour | 2 cache reads |

### When Caching Matters

- **Worth it**: System prompts > 1000 tokens reused across requests (multi-turn chat, agent loops)
- **Not worth it**: Short prompts, single-use queries, rapidly changing context
- **High ROI**: Large tool schemas that are identical across requests
- **Example**: 1000-token system prompt on Sonnet 4.6 with 1-hour cache:
  - Write: 1000 × $6/MTok = $0.006 (once)
  - Read: 1000 × $0.30/MTok = $0.0003 (per request)
  - After 20 turns: saves ~$0.048 vs uncached

### Cross-Provider Cache Support

| Provider | Caching | Control |
|----------|---------|---------|
| Anthropic | Explicit `cache_control` | Full control via `providerOptions` |
| OpenAI | Implicit prefix caching | No explicit control |
| Google | Context caching API | Different API surface |
| Groq | No caching | N/A |

## Token Budget Enforcement

### Per-Request Limits

```typescript
const result = streamText({
  model,
  messages,
  maxOutputTokens: 1000,                    // Hard output limit
  stopWhen: stepCountIs(5),                 // Agent loop bound
  abortSignal: AbortSignal.timeout(30_000), // Time bound (cost proxy)
});
```

### Per-User Rate Limiting

```typescript
// src/lib/server/api/rate-limit.ts — already in project
const ratelimit = createLimiter('ai', 20, '1h'); // 20 requests per hour per user

const { success, reset } = await ratelimit.limit(user.id);
if (!success) return rateLimitResponse(reset);
```

### Usage Tracking

```typescript
onFinish: async ({ totalUsage }) => {
  // totalUsage (NOT usage) = accumulated across all steps
  await db.insert(aiUsageLogs).values({
    userId,
    conversationId,
    promptTokens: totalUsage.promptTokens,
    completionTokens: totalUsage.completionTokens,
    totalTokens: totalUsage.totalTokens,
    model: activeProvider.model,
    timestamp: new Date(),
  });
},
```

## Cost Monitoring Alerts

```typescript
onFinish: async ({ totalUsage }) => {
  const estimatedCost = estimateCost(activeProvider.model, totalUsage);

  if (estimatedCost > 0.10) { // $0.10 per request threshold
    console.warn('[ai:cost] High-cost request:', {
      userId,
      model: activeProvider.model,
      tokens: totalUsage.totalTokens,
      estimatedCost,
    });
  }
},
```

## Semantic Caching

Cache based on query similarity for repeated questions. 30-40% cost savings for FAQ-style queries.

```typescript
// Threshold: 0.95+ similarity (lower = wrong answers returned)
// Cache RAG context (not LLM responses) — safer and more useful
// See references/caching.md for full implementation
```

**Caution**: Not widely adopted in production due to:
1. Requires Redis with vector search (Upstash recently added this)
2. 0.95+ threshold needed — cache hit rate is low at this threshold
3. Non-deterministic LLM output means "same query" doesn't guarantee "same good answer"

## Provider Fallback Chain

The project already implements fallback in `src/routes/(shell)/api/ai/chat/+server.ts`:

```typescript
// Primary provider fails → try fallbacks
if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
  for (const fallback of fallbackProviders) {
    const fallbackModel = fallback.getInstance();
    if (!fallbackModel) continue;
    try {
      const result = streamText({ model: fallbackModel, ... });
      return result.toUIMessageStreamResponse();
    } catch { continue; }
  }
}
```

Fallback order is determined by `PROVIDER_CONFIGS` array order in `src/lib/server/ai/providers.ts`, excluding the active provider.
