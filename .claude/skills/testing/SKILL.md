---
name: testing
description: Vitest testing patterns for SvelteKit 2 + Svelte 5 + Bun + Drizzle. Use when writing tests, reviewing test architecture, mocking SvelteKit modules, testing domain logic, database queries, AI integrations, or Svelte 5 rune-based state. Essential for any test file.
---

# Testing (Vitest)

Testing patterns for Velociraptor's stack. Vitest is the test runner — not bun:test — because SvelteKit's virtual modules (`$app/*`, `$env/*`) require Vite's transform pipeline.

## Contents

- [Critical Gotchas](#critical-gotchas) - Must-know issues
- [Architecture](#architecture) - What to test and where
- [Vitest Configuration](#vitest-configuration) - Current project setup
- [SvelteKit Module Mocking](#sveltekit-module-mocking) - $app/*, $env/* patterns
- [Domain Logic Testing](#domain-logic-testing) - Multi-client-core pattern
- [Database Testing](#database-testing) - PGlite and Neon patterns
- [AI SDK Testing](#ai-sdk-testing) - MockLanguageModelV3, streaming
- [Svelte 5 State Testing](#svelte-5-state-testing) - Runes, effects, flushSync
- [Validation Testing](#validation-testing) - Valibot schema verification
- [Snapshot Testing](#snapshot-testing) - Serialized data, prompts
- [Anti-Patterns](#anti-patterns) - What not to do
- [References](#references) - Detailed guides

| Task | Pattern |
|------|---------|
| Domain function | Direct import, assert inputs/outputs |
| DB query logic | PGlite in-process PostgreSQL |
| AI tool function | Direct call, assert return shape |
| AI streaming | `MockLanguageModelV3` + `simulateReadableStream` |
| Svelte 5 state | `.svelte.test.ts`, factory call, assert reactive object |
| Valibot schema | `parse()` valid, `safeParse()` invalid |
| System prompts | `toMatchSnapshot()` or `toMatchInlineSnapshot()` |
| Auth guards | Construct minimal `App.Locals`, assert allow/deny |

## Critical Gotchas

| Gotcha | What Goes Wrong | Fix |
|--------|-----------------|-----|
| `bun test` with SvelteKit | Can't resolve `$app/*`, `$env/*` — open issues since 2023 | Use Vitest with `sveltekit()` plugin |
| `importOriginal` on SvelteKit modules | Unpredictable failures | Full mock, never importOriginal |
| `environment: 'jsdom'` globally | Breaks server-side tests that assume Node builtins | Keep `environment: 'node'` (current) |
| `$derived` in node environment | Silently returns stale values | Only test `.svelte.ts` state via factory object interface |
| `happy-dom` in Bun | Hangs forever (bun#8669) | Don't use |
| Mocking the database | Mock/prod divergence masks real bugs | PGlite or Neon branches |
| `ai/test` import outside test runner | Crashes at runtime (ai#8356) | Only import in `.test.ts` files |
| Test execution order dependency | Passes in sequence, fails in parallel | Each test must be independently runnable |
| Mocking domain logic under test | Tests pass but prove nothing | Mock boundaries (external services), never the code being tested |

## Architecture

### The Testing Trophy for This Stack

```
         /  E2E  \          ← Chrome extension (not Vitest)
        /----------\
       / Integration \       ← Domain modules + real DB (PGlite)
      /----------------\
     /    Unit Tests     \   ← Pure functions, validators, state
    /----------------------\
   /    Static Analysis     \← TypeScript + Biome (already in place)
  /--------------------------\
```

**Integration tests are the highest-value layer.** They test domain modules in `$lib/server/[domain]/` against real (PGlite) or realistic data. This is where the multi-client-core pattern pays off — the same business logic serves form actions, API routes, and AI tools, so testing it once covers all surfaces.

### What to Test (and What Not To)

| Test This | Why | How |
|-----------|-----|-----|
| Domain functions (`$lib/server/[domain]/`) | Core business logic, highest ROI | Direct import, real types |
| Validation schemas | Contract enforcement | `parse()` / `safeParse()` |
| Auth guards | Security boundary | Construct `App.Locals`, assert |
| AI tool execute functions | Contract with LLM | Direct call with known inputs |
| State factories (`.svelte.ts`) | Reactive contract | Factory call, assert interface |
| Error sanitization | Security (no schema leaks) | Assert output never contains internals |
| DB query logic | Data integrity | PGlite with real schema |

| Don't Test This | Why |
|-----------------|-----|
| SvelteKit load functions | No official unit test API; test the domain function they call |
| SvelteKit form actions | Same — test the domain function |
| Component rendering | Chrome extension handles E2E visual testing |
| Drizzle SQL generation | Framework internal — trust it |
| SvelteKit routing | Framework internal |

### File Organization

Co-locate tests next to source (current project pattern):

```
src/lib/server/notifications/
├── service.ts
├── service.test.ts        ← unit/integration test
├── router.ts
├── router.test.ts
└── outbox.ts
    outbox.test.ts
```

For Svelte 5 state:

```
src/lib/components/composites/dock/
├── dock.state.svelte.ts
├── dock.state.svelte.test.ts  ← .svelte.test.ts extension
└── dock.operations.ts
    dock.operations.test.ts
```

## Vitest Configuration

Current project setup (`vitest.config.ts`):

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['src/lib/server/test/vitest.setup.ts'],
    passWithNoTests: true,
  },
});
```

Key choices:
- **`environment: 'node'`** — Correct for server-side domain logic tests
- **`sveltekit()` plugin** — Resolves `$lib`, `$app`, `$env` aliases
- **`globals: true`** — `describe`, `it`, `expect` available without import
- **`setupFiles`** — Global mocks for SvelteKit virtual modules

## SvelteKit Module Mocking

The setup file (`src/lib/server/test/vitest.setup.ts`) handles global mocks:

```typescript
// Prevent schedulers from starting during tests
globalThis.__v10r_scheduler = 'test' as never;
globalThis.__v10r_delivery_scheduler = 'test' as never;

// Mock $env/dynamic/private — redirects to process.env
vi.mock('$env/dynamic/private', () => ({
  env: new Proxy({}, {
    get: (_target, prop: string) => process.env[prop],
  }),
}));

// Mock $env/static/private — same redirect
vi.mock('$env/static/private', () =>
  new Proxy({}, {
    get: (_target, prop: string) => process.env[prop],
  })
);

// Mock $app/environment
vi.mock('$app/environment', () => ({
  building: false,
  browser: false,
  dev: true,
  version: 'test',
}));
```

### Rules for SvelteKit Mocks

1. **Always full mock** — Never use `vi.mock('$app/state', async (importOriginal) => ...)`. SvelteKit virtual modules don't have real implementations to import.

2. **Mock $app/state when needed** (not in global setup — mock per-test):
```typescript
vi.mock('$app/state', () => ({
  page: {
    data: { user: { name: 'Test User' } },
    url: new URL('http://localhost'),
  },
}));
```

3. **Set env vars via `process.env`** — The proxy in setup redirects to `process.env`, so:
```typescript
beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
});
```

## Domain Logic Testing

The multi-client-core architecture makes this straightforward — domain functions are pure TypeScript with no framework imports:

```typescript
// src/lib/server/notifications/router.test.ts
import { describe, it, expect } from 'vitest';
import { routeNotification } from './router';

describe('routeNotification', () => {
  it('routes to email channel when user prefers email', () => {
    const result = routeNotification({
      type: 'mention',
      userId: 'user-1',
      preferences: { mention: 'email' },
    });

    expect(result.channel).toBe('email');
  });

  it('returns no-op when notification type is disabled', () => {
    const result = routeNotification({
      type: 'mention',
      userId: 'user-1',
      preferences: { mention: 'none' },
    });

    expect(result.channel).toBe('none');
  });
});
```

### Testing Auth Guards

```typescript
// src/lib/server/auth/guards.test.ts pattern
import { requireAuth, requireAdmin } from './guards';

function mockLocals(overrides: Partial<App.Locals> = {}): App.Locals {
  return {
    user: null,
    session: null,
    ...overrides,
  } as App.Locals;
}

describe('requireAuth', () => {
  it('returns user when authenticated', () => {
    const locals = mockLocals({ user: { id: '1', role: 'user' } });
    expect(() => requireAuth(locals)).not.toThrow();
  });

  it('throws 401 when not authenticated', () => {
    const locals = mockLocals();
    expect(() => requireAuth(locals)).toThrow();
  });
});
```

## Database Testing

### PGlite (In-Process PostgreSQL)

Already in devDependencies (`@electric-sql/pglite`). Runs full PostgreSQL in-process via WASM — no network, millisecond setup:

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '$lib/server/db/schema';

let client: PGlite;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  // Apply schema — use raw SQL or drizzle-kit push
  await client.exec(schemaSQL);
});

afterEach(async () => {
  await client.close();
});

it('inserts and retrieves a record', async () => {
  await db.insert(schema.users).values({ id: '1', name: 'Test' });
  const result = await db.select().from(schema.users);
  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('Test');
});
```

### When PGlite Is Not Enough

PGlite limitations: no Neon serverless driver semantics, no connection pooling, some extension gaps. For integration tests that need real Neon behavior, use Neon branching:

- Create a branch per test run via Neon API
- Run migrations against the branch
- Execute tests
- Delete the branch

See `references/db-testing.md` for the full Neon branching pattern.

### Error Sanitization

```typescript
import { safeDbMessage } from '$lib/server/db/errors';

it('never exposes table names', () => {
  const raw = 'insert into auth.users violated unique constraint "users_email_unique"';
  const safe = safeDbMessage(raw);
  expect(safe).not.toMatch(/auth\.users|users_email_unique/);
});
```

## AI SDK Testing

### MockLanguageModelV3 (Official)

```typescript
import { generateText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

it('handles text generation', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'Expected response',
    }),
  });

  const result = await generateText({ model, prompt: 'test' });
  expect(result.text).toBe('Expected response');
});
```

### Streaming with simulateReadableStream

```typescript
import { streamText, simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

it('handles streaming responses', async () => {
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

  const result = streamText({ model, prompt: 'test' });
  const chunks: string[] = [];
  for await (const chunk of result.textStream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(['Hello', ' World']);
});
```

### Tool Execute Functions

Test tool functions directly — they're pure TypeScript:

```typescript
import { searchItems } from '$lib/server/ai/tools/search';

it('returns matching items for valid query', async () => {
  const result = await searchItems({
    query: 'test',
    status: 'active',
    limit: 10,
  });

  expect(result).toHaveProperty('items');
  expect(result).not.toHaveProperty('error');
});

it('returns error object on failure, never throws', async () => {
  const result = await searchItems({
    query: '',
    status: null,
    limit: -1,
  });

  expect(result).toHaveProperty('error');
});
```

### System Prompt Snapshots

Catch unintended prompt changes:

```typescript
import { buildSystemPrompt } from '$lib/server/ai/prompts';

it('system prompt matches snapshot', () => {
  const prompt = buildSystemPrompt({ userId: 'test', role: 'assistant' });
  expect(prompt).toMatchSnapshot();
});
```

Update with `bun run test -- -u` when changes are intentional.

## Svelte 5 State Testing

Test `.svelte.ts` state factories directly. Use `.svelte.test.ts` extension:

```typescript
// dock.state.svelte.test.ts
import { describe, it, expect } from 'vitest';
import { createDockState } from './dock.state.svelte';

describe('createDockState', () => {
  it('initializes with default values', () => {
    const state = createDockState();
    expect(state.isOpen).toBe(false);
    expect(state.items).toEqual([]);
  });

  it('toggles open state', () => {
    const state = createDockState();
    state.toggle();
    expect(state.isOpen).toBe(true);
    state.toggle();
    expect(state.isOpen).toBe(false);
  });
});
```

### When You Need Effects

Wrap in `$effect.root` for cleanup:

```typescript
import { flushSync } from 'svelte';

it('derived value updates after state change', () => {
  const cleanup = $effect.root(() => {
    const state = createCounterState();
    state.increment();
    flushSync(); // Required for external state
    expect(state.doubled).toBe(2);
  });
  cleanup();
});
```

## Validation Testing

```typescript
import { parse, safeParse } from 'valibot';
import { CreateItemSchema } from '$lib/schemas/items';

describe('CreateItemSchema', () => {
  it('accepts valid input', () => {
    const result = parse(CreateItemSchema, {
      name: 'Test Item',
      type: 'document',
    });
    expect(result.name).toBe('Test Item');
  });

  it('rejects missing required fields', () => {
    const result = safeParse(CreateItemSchema, {});
    expect(result.success).toBe(false);
  });

  it('rejects invalid enum values', () => {
    const result = safeParse(CreateItemSchema, {
      name: 'Test',
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });
});
```

## Snapshot Testing

Use for complex serialized data, NOT for visual output:

```typescript
// Good: snapshot of a data structure
it('retrieval pipeline returns expected shape', async () => {
  const result = await retrieveChunks('test query', { maxChunks: 3 });
  expect(result.map(c => ({ id: c.id, score: c.score }))).toMatchSnapshot();
});

// Good: inline snapshot for small values
it('error message format', () => {
  const msg = formatError('not_found', 'user');
  expect(msg).toMatchInlineSnapshot(`"User not found"`);
});
```

## Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|-----------|
| `bun test` for SvelteKit code | Can't resolve `$app/*`, `$env/*` | `vitest` with `sveltekit()` plugin |
| `importOriginal` on `$app/*` | Unpredictable failures | Full mock |
| Mock the database | Mock/prod divergence | PGlite or Neon branches |
| Mock the code under test | Tests prove nothing | Mock only external boundaries |
| Test SvelteKit load functions | No official API, requires internals | Test the domain function they call |
| Test component rendering in Vitest | jsdom + Svelte 5 runes = pain | Chrome extension for E2E |
| `test.skip` without reason | Dead tests accumulate | Explain why or delete |
| Assert on implementation details | Breaks on every refactor | Assert on contract (inputs/outputs) |
| Shared mutable state between tests | Order-dependent failures | Fresh state in `beforeEach` |
| `vi.mock('ai')` for everything | Fragile, couples to import structure | `MockLanguageModelV3` from `ai/test` |

## References

- **references/db-testing.md** - PGlite setup, Neon branching, transaction isolation
- **references/ai-testing.md** - MockLanguageModelV3, streaming, tool testing, eval strategies
- **references/svelte5-testing.md** - Runes in tests, effect cleanup, state factory patterns
