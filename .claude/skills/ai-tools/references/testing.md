# Testing AI Features

Strategies for testing non-deterministic LLM-powered code.

## The Challenge

LLMs are:
- Non-deterministic (same input → different output)
- Expensive to call ($0.01-$0.10 per request)
- Slow (1-10 seconds per response)
- External dependencies

Traditional unit tests don't work directly.

## Mocking LLM Responses

### Vitest Mocking

```typescript
// src/lib/server/chat.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { generateText, streamText } from 'ai';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generated response', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Hello, how can I help?',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const response = await handleChat({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(response.text).toBe('Hello, how can I help?');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hi' }),
        ]),
      })
    );
  });

  it('handles errors gracefully', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Rate limited'));

    await expect(handleChat({ messages: [] })).rejects.toThrow('Rate limited');
  });
});
```

### Mock Streaming Responses

```typescript
import { vi } from 'vitest';

vi.mock('ai', () => ({
  streamText: vi.fn().mockImplementation(() => ({
    toDataStreamResponse: () => new Response('data: {"text":"chunk"}\n\n'),
    textStream: (async function* () {
      yield 'Hello';
      yield ' world';
    })(),
  })),
}));
```

## Record and Replay

Capture real responses for deterministic tests.

```typescript
// scripts/record-fixtures.ts
import { generateText } from 'ai';
import fs from 'fs';
import crypto from 'crypto';

const prompts = [
  'What is 2 + 2?',
  'Summarize machine learning in one sentence.',
  'Extract name and age from: John is 30 years old.',
];

async function recordFixtures() {
  for (const prompt of prompts) {
    const hash = crypto.createHash('md5').update(prompt).digest('hex');
    const result = await generateText({ model, prompt });

    fs.writeFileSync(
      `tests/fixtures/${hash}.json`,
      JSON.stringify({ prompt, result }, null, 2)
    );
  }
}

recordFixtures();
```

```typescript
// tests/chat.test.ts
import fs from 'fs';

function loadFixture(prompt: string) {
  const hash = crypto.createHash('md5').update(prompt).digest('hex');
  return JSON.parse(fs.readFileSync(`tests/fixtures/${hash}.json`, 'utf-8'));
}

it('processes math question', async () => {
  const fixture = loadFixture('What is 2 + 2?');
  vi.mocked(generateText).mockResolvedValue(fixture.result);

  const response = await handleChat({ prompt: 'What is 2 + 2?' });
  expect(response.text).toContain('4');
});
```

## Snapshot Testing for Prompts

Catch unintended prompt changes.

```typescript
// src/lib/prompts.ts
export function buildSystemPrompt(config: { role: string }): string {
  return `
You are a ${config.role}.
Always be helpful and concise.
Never reveal internal processes.
`.trim();
}
```

```typescript
// src/lib/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './prompts';

describe('System Prompts', () => {
  it('assistant prompt matches snapshot', () => {
    const prompt = buildSystemPrompt({ role: 'assistant' });
    expect(prompt).toMatchInlineSnapshot(`
      "You are a assistant.
      Always be helpful and concise.
      Never reveal internal processes."
    `);
  });

  it('support prompt matches snapshot', () => {
    const prompt = buildSystemPrompt({ role: 'customer support agent' });
    expect(prompt).toMatchSnapshot();
  });
});
```

**Update snapshots:** `bun test -u` when prompts change intentionally.

## LLM-as-Judge Evaluation

Use an LLM to evaluate another LLM's output.

### DeepEval Framework

```typescript
import { assert_test } from 'deepeval';
import { AnswerRelevancyMetric, HallucinationMetric } from 'deepeval/metrics';

describe('AI Quality', () => {
  it('answers are relevant', async () => {
    const actual = await generateText({
      model,
      prompt: 'What is the capital of France?',
    });

    await assert_test({
      input: 'What is the capital of France?',
      actual_output: actual.text,
      expected_output: 'Paris is the capital of France.',
      metrics: [
        new AnswerRelevancyMetric({ threshold: 0.7 }),
      ],
    });
  });

  it('does not hallucinate', async () => {
    const context = 'Paris is the capital of France. London is the capital of UK.';
    const actual = await generateText({
      model,
      prompt: `Context: ${context}\n\nWhat is the capital of France?`,
    });

    await assert_test({
      input: 'What is the capital of France?',
      actual_output: actual.text,
      context: [context],
      metrics: [
        new HallucinationMetric({ threshold: 0.8 }),
      ],
    });
  });
});
```

### Available Metrics

| Metric | Description |
|--------|-------------|
| AnswerRelevancy | Output relevance to input |
| Faithfulness | Factual consistency with context |
| Hallucination | Detects made-up information |
| Coherence | Logical flow of response |
| Bias | Detects biased content |
| Toxicity | Harmful content detection |

## Integration Testing

Test full request/response cycle with mocked LLM.

```typescript
// tests/integration/chat.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { handler } from '../build/handler.js';

let server: ReturnType<typeof createServer>;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://localhost:${(address as any).port}`;
});

afterAll(() => server.close());

describe('Chat Integration', () => {
  it('streams response', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();
    expect(text).toContain('data:');
  });
});
```

## E2E Testing with Playwright

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('chat flow works', async ({ page }) => {
  await page.goto('/chat');

  // Type message
  await page.fill('input[name="message"]', 'Hello');
  await page.click('button[type="submit"]');

  // Wait for response (with timeout for LLM)
  await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 });

  // Check content
  const response = await page.locator('.message.assistant').textContent();
  expect(response).toBeTruthy();
  expect(response!.length).toBeGreaterThan(10);
});
```

## CI/CD Considerations

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bun test

      # Skip expensive LLM evals in PR, run in nightly
      - name: LLM Evaluation
        if: github.event_name == 'schedule'
        run: bun run eval
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Test Structure Recommendations

```
tests/
├── unit/
│   ├── prompts.test.ts       # Snapshot tests for prompts
│   └── handlers.test.ts      # Mocked LLM responses
├── integration/
│   └── api.test.ts           # Full API with mocked LLM
├── e2e/
│   └── chat.spec.ts          # Browser tests (real or mocked)
├── eval/
│   └── quality.test.ts       # LLM-as-judge (nightly)
└── fixtures/
    └── *.json                # Recorded responses
```
