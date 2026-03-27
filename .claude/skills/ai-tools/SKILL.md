---
name: ai-tools
description: Vendor-agnostic AI integration patterns for SvelteKit + Bun. Use when implementing LLM features, streaming responses, tool calling, prompt engineering, or AI UX. Covers Vercel AI SDK, semantic caching, prompt injection defense, and observability. Essential for any AI-powered feature.
---

# AI Tools

Production patterns for integrating LLMs into SvelteKit applications. Vendor-agnostic, focused on what actually works in production.

## Contents

- [Critical Gotchas](#critical-gotchas) - Must-know issues
- [Vercel AI SDK](#vercel-ai-sdk) - Standard for SvelteKit
- [Streaming](#streaming) - SSE patterns
- [Structured Outputs](#structured-outputs) - Typed responses with Valibot
- [Tool Calling](#tool-calling) - Function execution
- [Error Handling](#error-handling) - Retries and resilience
- [Prompt Engineering](#prompt-engineering) - See references/prompts.md
- [Cost Optimization](#cost-optimization) - Caching, model routing
- [Security](#security) - See references/security.md
- [UX Patterns](#ux-patterns) - Loading states, streaming UI
- [Observability](#observability) - See references/observability.md
- [Testing](#testing) - See references/testing.md
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Detailed guides

| Task | Pattern |
|------|---------|
| Chat interface | `streamText` + `useChat` |
| Structured data | `generateText` + `output` schema |
| Background jobs | `generateText` (non-streaming) |
| Multi-step agents | `maxSteps` + tool definitions |

## Critical Gotchas

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| Vite env vars | `process.env.API_KEY` undefined | Import from `$env/static/private` |
| No retry logic | Random 5xx crashes app | Exponential backoff with jitter |
| Client-side API keys | Keys exposed in bundle | Only import in `.server.ts` files |
| Streaming without scroll | Messages appear off-screen | `afterUpdate` scroll-to-bottom |
| Overlapping requests | Messages out of order, doubled costs | Disable input when loading |
| No structured outputs | JSON parsing fails 5-10% | Use `output` with Valibot schema |
| Prompt injection in RAG | External docs contain instructions | Delimiters + output validation |
| No token budgeting | Unexpected $1000+ bills | Set `maxTokens`, rate limit |
| Semantic cache too loose | Wrong responses returned | Threshold 0.95+ |
| Logging PII | GDPR violations | Redact before logging |

## Vercel AI SDK

Standard for SvelteKit AI integration. Unified interface to 100+ models.

### Server Endpoint

```typescript
// src/routes/api/chat/+server.ts
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AI_API_KEY } from '$env/static/private';

const anthropic = createAnthropic({ apiKey: AI_API_KEY });

export async function POST({ request }) {
  const { messages } = await request.json();

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    maxTokens: 1000,
  });

  return result.toDataStreamResponse();
}
```

### Client Component

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/chat'
  });
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={$input} disabled={$isLoading} />
  <button disabled={$isLoading}>Send</button>
</form>

{#each $messages as message}
  <div class={message.role}>{message.content}</div>
{/each}
```

### Provider Setup

```typescript
// Anthropic
import { createAnthropic } from '@ai-sdk/anthropic';
const anthropic = createAnthropic({ apiKey: AI_API_KEY });
const model = anthropic('claude-3-5-sonnet-20241022');

// OpenAI
import { createOpenAI } from '@ai-sdk/openai';
const openai = createOpenAI({ apiKey: OPENAI_KEY });
const model = openai('gpt-4-turbo');
```

## Streaming

Use streaming for chat UIs. Provides immediate feedback.

```typescript
// Server
import { streamText } from 'ai';

export async function POST({ request }) {
  const { messages } = await request.json();

  const result = streamText({
    model,
    messages,
    onFinish: (result) => {
      // Log after completion
      console.log({ tokens: result.usage.totalTokens });
    },
  });

  return result.toDataStreamResponse();
}
```

```svelte
<!-- Client with auto-scroll -->
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';
  import { afterUpdate } from 'svelte';

  const { messages, input, handleSubmit, isLoading } = useChat();
  let container: HTMLElement;

  afterUpdate(() => {
    if (container) container.scrollTop = container.scrollHeight;
  });
</script>

<div bind:this={container} class="messages">
  {#each $messages as message}
    <div>{message.content}</div>
  {/each}
</div>
```

## Structured Outputs

Use `output` parameter with Valibot for type-safe responses.

```typescript
import { generateText } from 'ai';
import * as v from 'valibot';

const UserInfoSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.pipe(v.string(), v.email()),
});

const result = await generateText({
  model,
  prompt: 'Extract user info from: John Doe, 30, john@example.com',
  output: UserInfoSchema,
});

// result.object is typed as { name: string; age: number; email: string }
console.log(result.object.name); // "John Doe"
```

### With Tools

```typescript
const result = await generateText({
  model,
  prompt: 'What is the weather in Paris?',
  output: v.object({
    summary: v.string(),
    temperature: v.number(),
  }),
  tools: {
    getWeather: { /* ... */ },
  },
  maxSteps: 5, // Output generation counts as a step!
});
```

## Tool Calling

Define tools with strict Valibot schemas.

```typescript
import { generateText } from 'ai';
import * as v from 'valibot';

const WeatherParams = v.object({
  location: v.pipe(v.string(), v.maxLength(100)),
  unit: v.picklist(['celsius', 'fahrenheit']),
});

const result = await generateText({
  model,
  prompt: 'What is the weather in Tokyo?',
  tools: {
    getWeather: {
      description: 'Get current weather for a location',
      parameters: WeatherParams,
      strict: true, // Anthropic/OpenAI enforce schema
      execute: async (params) => {
        const response = await fetch(
          `https://api.weather.com?location=${encodeURIComponent(params.location)}`
        );
        return response.json();
      },
    },
  },
  maxSteps: 5,
});
```

## Error Handling

Implement exponential backoff with jitter.

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let delay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Retryable errors: 429, 5xx
      if (error.status === 401 || error.status === 400) throw error;

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * delay;
      await new Promise(r => setTimeout(r, delay + jitter));
      delay = Math.min(delay * 2, 32000);
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const result = await callWithRetry(() =>
  generateText({ model, prompt })
);
```

## Prompt Engineering

See **references/prompts.md** for detailed patterns.

**Key patterns:**
- System prompts: role, constraints, output format
- Few-shot examples: include input/output pairs before actual query
- Chain-of-thought: "Think step-by-step" prefix for complex reasoning

## Cost Optimization

### Model Routing

```typescript
async function routeQuery(query: string) {
  const wordCount = query.split(/\s+/).length;
  const hasCode = /```|function|class/.test(query);

  if (wordCount < 50 && !hasCode) {
    // Simple queries → cheap model
    return createAnthropic()('claude-3-haiku-20240307');
  } else {
    // Complex queries → capable model
    return createAnthropic()('claude-3-5-sonnet-20241022');
  }
}
```

### Semantic Caching

Cache based on query similarity, not exact match. 30-40% cost savings.

```typescript
import { embed } from 'ai';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function withCache<T>(
  query: string,
  generate: () => Promise<T>,
  threshold = 0.95
): Promise<{ result: T; cached: boolean }> {
  const { embedding } = await embed({
    model: createOpenAI()('text-embedding-3-small'),
    value: query,
  });

  // Search for similar cached queries (Redis Vector Search)
  const similar = await redis.call('FT.SEARCH', 'cache', /* ... */);

  if (similar?.score >= threshold) {
    return { result: JSON.parse(similar.response), cached: true };
  }

  const result = await generate();
  await redis.hset(`cache:${hash}`, { embedding, response: JSON.stringify(result) });

  return { result, cached: false };
}
```

### Token Budgeting

```typescript
const result = streamText({
  model,
  messages,
  maxTokens: 1000, // Hard limit
});

// Monitor in onFinish
onFinish: (result) => {
  if (result.usage.totalTokens > 5000) {
    console.warn('High token usage:', result.usage);
  }
}
```

## Security

See **references/security.md** for detailed patterns.

**Critical rules:**
- **API keys:** Only import from `$env/static/private` in `.server.ts` files
- **Prompt injection:** Use `###DELIMITERS###` for untrusted input, validate outputs with strict schemas
- **PII redaction:** Replace emails, SSNs, phone numbers before logging
- **Model access:** Never give model direct DB/API access

## UX Patterns

### Loading States

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  const { messages, input, handleSubmit, isLoading, error, reload } = useChat();
  let elapsed = $state(0);

  $effect(() => {
    if ($isLoading) {
      const interval = setInterval(() => elapsed++, 1000);
      return () => { clearInterval(interval); elapsed = 0; };
    }
  });
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={$input} disabled={$isLoading} />
  <button disabled={$isLoading}>
    {#if $isLoading}Generating...{:else}Send{/if}
  </button>
</form>

{#if $isLoading}
  <div class="typing-indicator">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
  {#if elapsed > 2}
    <p class="hint">This can take a few minutes...</p>
  {/if}
{/if}

{#if $error}
  <div class="error">
    <p>Failed: {$error.message}</p>
    <button onclick={() => reload()}>Retry</button>
  </div>
{/if}
```

### Confidence Indicators

```typescript
const result = await generateText({
  model,
  prompt: `Answer and rate confidence (0-100): ${question}`,
  output: v.object({
    answer: v.string(),
    confidence: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  }),
});
```

```svelte
{#if result.confidence < 50}
  <span class="badge warning">Low confidence</span>
{:else if result.confidence < 80}
  <span class="badge info">Moderate</span>
{:else}
  <span class="badge success">High confidence</span>
{/if}
```

## Observability

See **references/observability.md** for OpenTelemetry setup.

**Minimum logging (onFinish):** timestamp, model, userId, promptTokens, completionTokens, latency, cached.

**Tracing:** Use `@opentelemetry/api` tracer with span attributes for user.id and tokens.total.

## Testing

See **references/testing.md** for full patterns.

**Strategies:**
- Mock `generateText`/`streamText` with `vi.mock('ai')`
- Snapshot test system prompts to catch drift
- Use DeepEval for quality metrics (AnswerRelevancyMetric, ContextualPrecision)

## Anti-Patterns

**Don't expose API keys client-side:**
```typescript
// WRONG - bundled into client JS
const API_KEY = import.meta.env.VITE_API_KEY;

// RIGHT - server-side only
import { AI_API_KEY } from '$env/static/private';
```

**Don't skip retry logic:**
```typescript
// WRONG - crashes on transient errors
const result = await generateText({ model, prompt });

// RIGHT - resilient
const result = await callWithRetry(() => generateText({ model, prompt }));
```

**Don't parse JSON from prose:**
```typescript
// WRONG - fails 5-10% of time
const prompt = 'Return JSON with name and age';
const json = JSON.parse(result.text);

// RIGHT - validated
const result = await generateText({
  model,
  prompt,
  output: v.object({ name: v.string(), age: v.number() }),
});
```

**Don't allow overlapping requests:**
```svelte
<!-- WRONG - messages out of order -->
<button onclick={handleSubmit}>Send</button>

<!-- RIGHT - disable during loading -->
<button onclick={handleSubmit} disabled={$isLoading}>Send</button>
```

**Don't log full prompts with PII:**
```typescript
// WRONG - GDPR violation
console.log({ prompt: userMessage });

// RIGHT - redacted
console.log({ prompt: redactPII(userMessage) });
```

## References

- **references/streaming.md** - SSE patterns, chunked responses, abort handling
- **references/caching.md** - Semantic caching, Redis vector search, TTL strategies
- **references/security.md** - Prompt injection taxonomy, defense layers
- **references/observability.md** - OpenTelemetry setup, LangSmith integration
- **references/testing.md** - DeepEval metrics, mocking strategies, CI/CD
- **references/prompts.md** - System prompt patterns, few-shot, chain-of-thought
