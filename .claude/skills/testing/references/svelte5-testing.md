# Svelte 5 Testing

Patterns for testing Svelte 5 rune-based state in Vitest.

## File Extension Convention

- **`.svelte.test.ts`** — For tests that use runes directly in test code
- **`.test.ts`** — For standard tests that import and call rune-based modules

The `.svelte.test.ts` extension enables the Svelte compiler's rune processing in the test file itself. Use it when your test code needs `$state`, `$derived`, or `$effect` directly.

## Testing State Factories

The project's `.svelte.ts` state modules export factory functions that return reactive objects. Test the object's interface:

```typescript
// dock.state.svelte.test.ts
import { describe, it, expect } from 'vitest';
import { createDockState } from './dock.state.svelte';

describe('createDockState', () => {
  it('initializes with defaults', () => {
    const state = createDockState();
    expect(state.isOpen).toBe(false);
    expect(state.items).toEqual([]);
  });

  it('adds items', () => {
    const state = createDockState();
    state.addItem({ id: '1', label: 'Test' });
    expect(state.items).toHaveLength(1);
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

This works in `environment: 'node'` because you're testing the object's API, not DOM rendering.

## Testing $derived Values

`$derived` values update synchronously when the source `$state` changes — but only within the reactive context. In tests:

```typescript
it('derived count updates when items change', () => {
  const state = createListState();
  expect(state.count).toBe(0);

  state.addItem('a');
  expect(state.count).toBe(1);

  state.addItem('b');
  expect(state.count).toBe(2);
});
```

**Gotcha**: If `$derived` returns stale values in your test, the state factory may need to be restructured so derived values are computed eagerly (getter property) rather than lazily (effect-based).

## Testing $effect

Effects run asynchronously. Wrap in `$effect.root` for manual lifecycle control:

```typescript
import { flushSync } from 'svelte';

it('effect fires on state change', () => {
  const log: string[] = [];

  const cleanup = $effect.root(() => {
    const state = createState();

    $effect(() => {
      log.push(`count: ${state.count}`);
    });

    // Initial effect run
    flushSync();
    expect(log).toEqual(['count: 0']);

    // Trigger update
    state.increment();
    flushSync();
    expect(log).toEqual(['count: 0', 'count: 1']);
  });

  cleanup(); // Dispose effects
});
```

### When flushSync Is Required

- **Always required** for `$effect` assertions — effects are batched and async
- **Always required** for external `.svelte.ts` state — reactivity doesn't auto-propagate in tests
- **Not required** for `$derived` that uses getters — getters compute synchronously on access
- **Not required** for direct `$state` reads — state updates are synchronous

## Testing Pipeline State (Real Example)

From the project's RAG pipeline state:

```typescript
// pipeline-state.svelte.test.ts
import { createPipelineState } from './pipeline-state.svelte';

describe('createPipelineState', () => {
  it('starts in idle state', () => {
    const state = createPipelineState();
    expect(state.status).toBe('idle');
    expect(state.steps).toEqual([]);
  });

  it('transitions through pipeline steps', () => {
    const state = createPipelineState();

    state.handleEvent({ type: 'pipeline:step', step: 'embed', status: 'active' });
    expect(state.currentStep).toBe('embed');

    state.handleEvent({ type: 'pipeline:step', step: 'embed', status: 'complete' });
    state.handleEvent({ type: 'pipeline:step', step: 'search', status: 'active' });
    expect(state.currentStep).toBe('search');
    expect(state.completedSteps).toContain('embed');
  });

  it('handles error events', () => {
    const state = createPipelineState();
    state.handleEvent({ type: 'pipeline:error', message: 'Search failed' });
    expect(state.status).toBe('error');
    expect(state.error).toBe('Search failed');
  });
});
```

## Component Testing (When Needed)

The project uses the Chrome extension for E2E visual testing. However, if you need to test component logic in isolation (rare):

### Current Setup: No DOM

The Vitest config uses `environment: 'node'`. This means `@testing-library/svelte` `render()` won't work. This is intentional — test state factories, not component rendering.

### If DOM Testing Becomes Necessary

Would require a separate Vitest project with `environment: 'jsdom'` or browser-mode via Playwright provider. This is not currently configured and should only be added if there's a concrete need.

## Patterns to Avoid

| Don't | Why | Do Instead |
|-------|-----|-----------|
| Test `$derived` in `$effect` callback | Unnecessarily complex | Access derived value directly after state change |
| Forget `$effect.root` cleanup | Memory leak, test pollution | Always call the cleanup function |
| Use `setTimeout` for async reactivity | Flaky, timing-dependent | Use `flushSync()` |
| Test internal `$state` variables | Implementation detail | Test via the public API of the state factory |
| Mix DOM and state tests | Different environments needed | State tests in node, DOM tests in browser-mode |
