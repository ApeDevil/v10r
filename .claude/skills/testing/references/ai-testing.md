# AI SDK Testing

Patterns for testing Vercel AI SDK integrations deterministically.

## Official Test Utilities

The AI SDK ships test utilities in `ai/test`. **Only import these in `.test.ts` files** — importing outside a test runner can crash at runtime (ai#8356).

### MockLanguageModelV3

Deterministic model that returns exactly what you configure:

```typescript
import { generateText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

const model = new MockLanguageModelV3({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    text: 'Deterministic response',
  }),
});

const result = await generateText({ model, prompt: 'test' });
expect(result.text).toBe('Deterministic response');
```

### simulateReadableStream

For testing streaming consumers:

```typescript
import { streamText, simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

const model = new MockLanguageModelV3({
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'text-delta', textDelta: ' World' },
        { type: 'finish', finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 2 } },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});
```

### MockEmbeddingModelV3

For testing RAG embedding logic:

```typescript
import { MockEmbeddingModelV3 } from 'ai/test';

const embeddingModel = new MockEmbeddingModelV3({
  doEmbed: async ({ values }) => ({
    embeddings: values.map(() => new Array(1536).fill(0.1)),
    usage: { tokens: values.length * 10 },
  }),
});
```

### mockValues

For multi-turn sequences where each call returns a different response:

```typescript
import { mockValues } from 'ai/test';

const model = new MockLanguageModelV3({
  doGenerate: mockValues(
    { text: 'First response', /* ... */ },
    { text: 'Second response', /* ... */ },
    { text: 'Third response', /* ... */ },
  ),
});
```

## Testing Tool Execute Functions

Tool `execute` functions are pure TypeScript — test them directly without mocking the AI SDK:

```typescript
import { searchDocuments } from '$lib/server/ai/tools/search';

describe('searchDocuments tool', () => {
  it('returns results for valid query', async () => {
    const result = await searchDocuments.execute({
      query: 'authentication',
      limit: 5,
    });

    expect(result).toHaveProperty('documents');
    expect(result.documents.length).toBeLessThanOrEqual(5);
  });

  it('returns error object on failure, never throws', async () => {
    const result = await searchDocuments.execute({
      query: '',
      limit: -1,
    });

    expect(result).toHaveProperty('error');
  });
});
```

**Key rule**: Tool execute functions must never throw. They return `{ error: "..." }` objects. Test this contract explicitly.

## Testing Tool Call Flows

Mock the model to return tool calls, verify your code handles the flow:

```typescript
const model = new MockLanguageModelV3({
  doGenerate: async ({ tools }) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'tool-calls',
    usage: { promptTokens: 50, completionTokens: 30 },
    text: '',
    toolCalls: [
      {
        toolCallType: 'function',
        toolCallId: 'call-1',
        toolName: 'searchDocuments',
        args: JSON.stringify({ query: 'test', limit: 5 }),
      },
    ],
  }),
});
```

## System Prompt Snapshots

Catch unintended prompt changes:

```typescript
import { buildSystemPrompt } from '$lib/server/ai/prompts';

describe('system prompts', () => {
  it('chat prompt matches snapshot', () => {
    expect(buildSystemPrompt({ role: 'chat' })).toMatchSnapshot();
  });

  it('retrieval prompt matches snapshot', () => {
    expect(buildSystemPrompt({ role: 'retrieval' })).toMatchSnapshot();
  });
});
```

Update with `bun run test -- -u` when prompt changes are intentional.

## Testing RAG Pipeline Components

Test each stage independently:

```typescript
// Chunking
import { chunkText } from '$lib/server/rawrag/chunk';

it('chunks text within token limits', () => {
  const chunks = chunkText(longDocument, { maxTokens: 500 });
  for (const chunk of chunks) {
    expect(chunk.tokens).toBeLessThanOrEqual(500);
  }
});

it('preserves all content across chunks', () => {
  const chunks = chunkText(document, { maxTokens: 100 });
  const reassembled = chunks.map(c => c.text).join('');
  expect(reassembled.length).toBeGreaterThanOrEqual(document.length * 0.95);
});
```

```typescript
// Ranking
import { rankByRelevance } from '$lib/server/rawrag/rank';

it('ranks exact matches higher than partial', () => {
  const results = rankByRelevance(
    'authentication',
    [
      { text: 'authentication module handles login', score: 0.8 },
      { text: 'the auth system uses tokens', score: 0.7 },
    ]
  );
  expect(results[0].text).toContain('authentication');
});
```

## What NOT to Test with Mocks

- **Prompt quality** — Mocks return exactly what you configure. They can't tell you if your prompt is good. Use eval frameworks (LLM-as-judge) for quality, not unit tests.
- **Model behavior** — MockLanguageModelV3 is not a simulation. It verifies your code handles model outputs correctly, not that the model produces correct outputs.
- **Real latency/cost** — Mocks are instant and free. Use observability and monitoring for production performance.

## AI SDK Version Pinning

The `ai/test` utilities have broken across minor versions (5.0.26 → 5.0.27 regression). Pin closely:

```json
{
  "dependencies": {
    "ai": "~4.0.0"
  }
}
```

If `ai/test` imports crash, check the AI SDK changelog for test utility changes.
