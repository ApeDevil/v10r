# State Management Architecture

Svelte 5 runes for explicit, portable reactivity.

---

## Strategy

**Runes-based state** with context API for SSR safety.

| Scenario | Pattern |
|----------|---------|
| Component state | `$state` |
| Computed values | `$derived` |
| Side effects | `$effect` (sparingly) |
| Shared state (no SSR) | `.svelte.ts` modules |
| Shared state (SSR) | Context API |
| Collections | `svelte/reactivity` |

### Rule of Thumb

Use `$derived` 90% of the time. Use `$effect` only for true side effects.

---

## Core Runes

### $state

Declares reactive state. Arrays and objects become deeply reactive proxies.

```svelte
<script>
  let count = $state(0);
  let user = $state({ name: 'Alice', age: 30 });
  let items = $state(['a', 'b', 'c']);

  function increment() {
    count += 1; // triggers update
  }

  function updateUser() {
    user.name = 'Bob'; // granular update, doesn't re-render age
  }

  function addItem() {
    items.push('d'); // proxy intercepts, triggers update
  }
</script>
```

**Key behaviors:**
- Primitive values: reassignment triggers update
- Objects/arrays: mutations trigger granular updates via Proxy
- Nested objects: wrapped lazily on access (no upfront traversal)
- Classes: NOT proxied (use getters/setters instead)

### $state.raw

Opt out of deep reactivity. Only reassignment triggers updates.

```svelte
<script>
  // Large dataset - don't want proxy overhead
  let data = $state.raw(fetchLargeDataset());

  function refresh() {
    data = fetchLargeDataset(); // only way to trigger update
  }

  // data.items.push(...) won't trigger updates!
</script>
```

Use for:
- Large datasets where proxy overhead matters
- Data passed to external libraries that don't expect proxies
- Immutable data patterns

### $state.snapshot

Get a plain object from a reactive proxy.

```svelte
<script>
  let form = $state({ name: '', email: '' });

  function submit() {
    const data = $state.snapshot(form);
    // data is a plain object, safe for:
    // - structuredClone()
    // - JSON.stringify()
    // - External APIs
    fetch('/api', { body: JSON.stringify(data) });
  }
</script>
```

**Performance guidance:**

- Each `$state.snapshot()` creates a deep clone — expensive for large objects
- Snapshot **lazily** (on submit/save), not reactively
- For large datasets, consider `$state.raw` instead

```svelte
<script>
  let largeState = $state({ users: [], posts: [], comments: [] });

  // ❌ BAD - Snapshots on every change (expensive)
  let snapshot = $derived($state.snapshot(largeState));

  // ✅ GOOD - Snapshot only when needed
  function save() {
    const data = $state.snapshot(largeState.users); // Only what you need
    fetch('/api/users', { body: JSON.stringify(data) });
  }
</script>
```

---

## Derived Values

### $derived

Computed values that auto-update. Memoized and lazy.

```svelte
<script>
  let items = $state([
    { name: 'Apple', price: 1 },
    { name: 'Banana', price: 2 },
  ]);

  // Simple expression
  let total = $derived(items.reduce((sum, i) => sum + i.price, 0));
  let count = $derived(items.length);
  let isEmpty = $derived(items.length === 0);
</script>

<p>Total: ${total}</p>
```

### $derived.by

For complex computations that need multiple statements.

```svelte
<script>
  let items = $state([]);
  let filter = $state('all');

  let filtered = $derived.by(() => {
    if (filter === 'all') return items;

    return items.filter(item => {
      if (filter === 'completed') return item.done;
      if (filter === 'active') return !item.done;
      return true;
    });
  });

  let stats = $derived.by(() => {
    const completed = items.filter(i => i.done).length;
    const active = items.length - completed;
    return { completed, active, total: items.length };
  });
</script>
```

**Rules:**
- Must be pure (no side effects)
- Cannot modify state inside
- Only recalculates when read AND dependencies changed

---

## Effects

### $effect

Runs after DOM updates when dependencies change. For side effects only.

```svelte
<script>
  let query = $state('');

  // Sync to URL
  $effect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    history.replaceState({}, '', url);
  });

  // Canvas drawing
  let canvas;
  let width = $state(100);

  $effect(() => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, width);
    ctx.fillRect(0, 0, width, width);
  });
</script>
```

**Does NOT run during SSR.**

### Cleanup Pattern

Return a function to clean up before re-run or unmount.

```svelte
<script>
  let active = $state(true);

  $effect(() => {
    if (!active) return;

    const controller = new AbortController();

    fetch('/api/stream', { signal: controller.signal })
      .then(/* ... */);

    return () => {
      controller.abort(); // cleanup on re-run or unmount
    };
  });
</script>
```

**Cleanup Checklist — return a cleanup function when using:**

| Resource | Cleanup Required | Why |
|----------|------------------|-----|
| `addEventListener` | ✅ Yes | Memory leak, stale handlers |
| `setTimeout` | ✅ Yes | Callback may fire after unmount |
| `setInterval` | ✅ Yes | Interval continues indefinitely |
| `fetch` | ✅ Yes | Race conditions, stale responses |
| `WebSocket` | ✅ Yes | Connection stays open |
| `MutationObserver` | ✅ Yes | Observer continues watching |
| `requestAnimationFrame` | ✅ Yes | Frame callback may fire after unmount |
| DOM mutations | ❌ No | Svelte handles this |
| Logging/analytics | ❌ No | Fire-and-forget |

### Async Effects and Cancellation

**`$effect` cannot be async.** Use these patterns for async operations:

```svelte
<script>
  let query = $state('');
  let results = $state([]);

  // ✅ Pattern 1: AbortController for fetch cancellation
  $effect(() => {
    const q = query; // Capture dependency BEFORE async
    if (!q) return;

    const controller = new AbortController();

    fetch(`/api/search?q=${q}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { results = data; })
      .catch(e => {
        if (e.name !== 'AbortError') throw e;
      });

    return () => controller.abort();
  });
</script>
```

**Critical: Dependency tracking stops at `await`.**

```svelte
<script>
  let id = $state(1);
  let settings = $state({ theme: 'dark' });

  // ❌ BAD - settings.theme NOT tracked (read after await)
  $effect(async () => {
    const data = await fetch(`/api/${id}`);
    if (settings.theme === 'dark') { /* ... */ } // Won't re-run when theme changes!
  });

  // ✅ GOOD - capture dependencies before async
  $effect(() => {
    const currentId = id;           // Tracked!
    const currentTheme = settings.theme; // Tracked!

    fetch(`/api/${currentId}`)
      .then(r => r.json())
      .then(data => {
        if (currentTheme === 'dark') { /* ... */ }
      });
  });
</script>
```

**Rule:** Always read reactive values **synchronously** at the top of `$effect`, before any `await`, `setTimeout`, or `.then()`.

### $effect.pre

Runs BEFORE DOM updates. Replaces `beforeUpdate`.

```svelte
<script>
  let messages = $state([]);
  let container;

  // Capture scroll position before DOM changes
  $effect.pre(() => {
    if (container) {
      const isAtBottom = container.scrollTop + container.clientHeight
        >= container.scrollHeight - 10;

      if (isAtBottom) {
        // Will scroll to bottom after update
        $effect(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  });
</script>
```

### $effect.root

Advanced: create effects outside component lifecycle. Manual cleanup required.

```typescript
// For libraries/classes that need reactive effects
class DataStore {
  #cleanup: () => void;
  data = $state<Item[]>([]);

  constructor() {
    this.#cleanup = $effect.root(() => {
      $effect(() => {
        console.log('Data changed:', this.data.length);
      });
    });
  }

  destroy() {
    this.#cleanup();
  }
}
```

---

## Component Props

### $props

Receive props from parent components.

```svelte
<!-- Button.svelte -->
<script lang="ts">
  interface Props {
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    onclick?: () => void;
  }

  let { variant = 'primary', disabled = false, onclick }: Props = $props();
</script>

<button class={variant} {disabled} {onclick}>
  <slot />
</button>
```

### $bindable

Enable two-way binding for specific props.

```svelte
<!-- Input.svelte -->
<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
  }

  let { value = $bindable(''), placeholder = '' }: Props = $props();
</script>

<input bind:value {placeholder} />
```

```svelte
<!-- Parent.svelte -->
<script>
  import Input from './Input.svelte';
  let name = $state('');
</script>

<!-- Two-way binding -->
<Input bind:value={name} />

<!-- One-way (no bind:) also works -->
<Input value="readonly" />
```

**Use sparingly.** Prefer callbacks for most parent-child communication.

---

## Shared State

> ⚠️ **CRITICAL SSR WARNING**
>
> Module-level `$state` in `.svelte.ts` files is **shared across ALL SSR requests** in the Node.js process. User A's data can leak to User B.
>
> **NEVER** import module-level stores in `+page.server.ts`, `+layout.server.ts`, or `hooks.server.ts`.
>
> Use the **Context API + Factory Pattern** for SSR-safe shared state.
>
> See: [Svelte Issue #13594](https://github.com/sveltejs/svelte/issues/13594) (most upvoted issue)

### Layout Scope Guidance

Choose the correct layout for each store based on where it's needed:

| Store Type | Scope | Layout | Why |
|------------|-------|--------|-----|
| Theme, locale | App-wide | Root `+layout.svelte` | Affects all pages including public |
| Sidebar, user menu | Authenticated zone | `(app)/+layout.svelte` | Only needed in app shell |
| Shopping cart | E-commerce section | `(shop)/+layout.svelte` | Scoped to shop routes |
| Feature flags | Per-feature | Route group layout | Feature isolation |
| Form drafts | Single page | `+page.svelte` | Page lifecycle only |

```
src/routes/
├── +layout.svelte           → Theme, locale (app-wide)
├── (marketing)/
│   └── +layout.svelte       → (inherits from root)
└── (app)/
    └── +layout.svelte       → Sidebar, user session, toast
```

### Module State (No SSR)

For client-only apps, export state from `.svelte.ts` files.

```typescript
// src/lib/stores/counter.svelte.ts

let count = $state(0);

export const counter = {
  get value() {
    return count;
  },
  increment() {
    count += 1;
  },
  decrement() {
    count -= 1;
  },
  reset() {
    count = 0;
  },
};
```

```svelte
<!-- Any component -->
<script>
  import { counter } from '$lib/stores/counter.svelte';
</script>

<p>{counter.value}</p>
<button onclick={counter.increment}>+</button>
```

**Warning:** Module state is shared across ALL users on the server. Only use for client-only apps.

### Factory Pattern

Create isolated instances.

```typescript
// src/lib/stores/todos.svelte.ts

export function createTodoStore(initial: Todo[] = []) {
  let todos = $state(initial);

  return {
    get items() {
      return todos;
    },
    get completed() {
      return todos.filter(t => t.done);
    },
    get active() {
      return todos.filter(t => !t.done);
    },
    add(text: string) {
      todos.push({ id: crypto.randomUUID(), text, done: false });
    },
    toggle(id: string) {
      const todo = todos.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },
    remove(id: string) {
      const index = todos.findIndex(t => t.id === id);
      if (index !== -1) todos.splice(index, 1);
    },
  };
}
```

### Context API (SSR-Safe)

For SSR apps, use context to isolate state per request.

```svelte
<!-- +layout.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createTodoStore } from '$lib/stores/todos.svelte';

  // Each request gets its own store instance
  const todos = createTodoStore();
  setContext('todos', todos);
</script>

<slot />
```

```svelte
<!-- Child.svelte -->
<script>
  import { getContext } from 'svelte';

  const todos = getContext('todos');
</script>

<ul>
  {#each todos.items as todo}
    <li>{todo.text}</li>
  {/each}
</ul>
```

### Type-Safe Context Helper

```typescript
// src/lib/stores/context.ts
import { setContext, getContext } from 'svelte';

export function createContext<T>(key: string) {
  return {
    set: (value: T) => setContext(key, value),
    get: () => getContext<T>(key),
  };
}

// Usage
export const todoContext = createContext<ReturnType<typeof createTodoStore>>('todos');
```

```svelte
<!-- +layout.svelte -->
<script>
  import { todoContext, createTodoStore } from '$lib/stores/todos.svelte';

  todoContext.set(createTodoStore());
</script>
```

```svelte
<!-- Child.svelte -->
<script>
  import { todoContext } from '$lib/stores/todos.svelte';

  const todos = todoContext.get();
</script>
```

---

## Reactive Built-ins

Import from `svelte/reactivity` for reactive versions of JS built-ins.

```svelte
<script>
  import { SvelteMap, SvelteSet, SvelteDate, SvelteURL } from 'svelte/reactivity';

  // Reactive Map
  const cache = new SvelteMap<string, Data>();

  // Reactive Set
  const selected = new SvelteSet<string>();

  // Reactive Date
  const now = new SvelteDate();
  setInterval(() => now.setTime(Date.now()), 1000);

  // Reactive URL
  const url = new SvelteURL('https://example.com');
</script>

<p>Selected: {selected.size} items</p>
<p>Time: {now.toLocaleTimeString()}</p>
<p>Host: {url.hostname}</p>
```

**Note:** Values inside `SvelteMap` and `SvelteSet` are NOT deeply reactive.

```svelte
<script>
  const map = new SvelteMap();

  map.set('user', { name: 'Alice' });

  // This WON'T trigger updates:
  map.get('user').name = 'Bob';

  // This WILL:
  map.set('user', { ...map.get('user'), name: 'Bob' });
</script>
```

### When to Use SvelteMap vs $state

| Use Case | Choice | Why |
|----------|--------|-----|
| Fixed set of keys | `$state({ ... })` | Deep reactivity, simpler syntax |
| String keys, nested mutations | `$state<Record<string, T>>({})` | Deep reactivity on nested objects |
| Non-string keys (objects, numbers) | `SvelteMap` | Maps support any key type |
| Frequent add/delete of keys | `SvelteMap` | More efficient for dynamic keys |
| Need `.has()`, `.keys()`, `.entries()` | `SvelteMap` | Map-specific methods |
| Order matters | `SvelteMap` | Maps preserve insertion order |
| Unique value collection | `SvelteSet` | Automatic deduplication |

```svelte
<script>
  // ❌ Don't wrap SvelteMap in $state (redundant)
  let map = $state(new SvelteMap());

  // ✅ Use SvelteMap directly
  let map = new SvelteMap();

  // ✅ For nested data with string keys, prefer $state
  let users = $state<Record<string, User>>({});
  users['123'].name = 'Bob'; // Triggers update (deep reactive)
</script>
```

---

## SvelteKit Integration

### Load Function Data

Data from `load` functions is already reactive in components.

```typescript
// +page.server.ts
export async function load() {
  const items = await db.items.findMany();
  return { items };
}
```

```svelte
<!-- +page.svelte -->
<script>
  let { data } = $props();

  // data.items is reactive - updates on navigation
</script>
```

### Server State to Client

Pass initial state from server, hydrate on client.

```typescript
// +page.server.ts
export async function load() {
  return {
    initialItems: await db.items.findMany(),
  };
}
```

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createItemStore } from '$lib/stores/items.svelte';

  let { data } = $props();

  // Initialize store with server data
  const store = createItemStore(data.initialItems);
  setContext('items', store);
</script>
```

### Form State with Superforms

```svelte
<script>
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();

  const { form, errors, enhance, submitting } = superForm(data.form);
  // $form, $errors are already reactive
</script>

<form method="POST" use:enhance>
  <input name="email" bind:value={$form.email} />
  {#if $errors.email}<span>{$errors.email}</span>{/if}
</form>
```

### Better Auth Session State

Better Auth uses [nano-stores](https://github.com/nanostores/nanostores) internally for `useSession()`. **Correct usage requires understanding SSR safety.**

#### SSR Safety Warning

Module-level state in SvelteKit is **shared across all SSR requests**. This is a [well-documented security issue](https://github.com/sveltejs/svelte/issues/13594) — the most upvoted issue in SvelteKit.

```typescript
// ❌ UNSAFE - Module-level singleton shared across SSR requests
const session = useSession(); // Persists in Node.js process!
export const auth = { get user() { return session.value?.data?.user; } };
```

#### Recommended Pattern: Server-First

The safest approach uses `event.locals` (request-scoped) for SSR, with optional client-side reactivity.

**1. Server: Populate `event.locals` in hooks (SSR-safe)**

```typescript
// src/hooks.server.ts
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  // Request-scoped — safe for SSR
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  return svelteKitHandler({ event, resolve, auth });
}
```

**2. Load functions: Access `event.locals`**

```typescript
// src/routes/app/+layout.server.ts
export async function load({ locals }) {
  return {
    user: locals.user,
    session: locals.session,
  };
}
```

**3. Components: Use page data**

```svelte
<!-- src/routes/app/+layout.svelte -->
<script>
  import { page } from '$app/state';

  // Reactive via page store — SSR-safe
  const user = $derived(page.data.user);
</script>

{#if user}
  <p>Welcome, {user.name}!</p>
{:else}
  <a href="/auth/login">Sign in</a>
{/if}
```

#### Client-Side Reactivity (Post-Hydration)

For reactive updates after sign-in/sign-out (client-side only), use `useSession()` **within components**, not at module level.

**Hydration-safe pattern:** Use server data for initial render, client session for updates:

```svelte
<script>
  import { page } from '$app/state';
  import { useSession } from '$lib/auth-client';
  import { browser } from '$app/environment';

  // Server data (from load function) - SSR safe
  const serverUser = $derived(page.data.user);

  // Client session - only initialize after hydration
  let clientSession = $state(null);

  $effect(() => {
    // Deferred to client, won't cause hydration mismatch
    clientSession = useSession();
  });

  // Use server data initially, client session for live updates
  const user = $derived(
    browser && clientSession?.data?.user
      ? clientSession.data.user
      : serverUser
  );
</script>

<!-- Same content renders on server and client initially -->
{#if user}
  <p>Welcome, {user.name}!</p>
{:else}
  <a href="/auth/login">Sign in</a>
{/if}
```

> **Why this pattern?** The `{#if browser}` conditional causes hydration mismatch because server renders nothing while client renders content. By using `$effect` to defer client session initialization, both server and client initially render the same content from `page.data.user`.

#### Pattern Comparison

| Pattern | SSR Safe | Use Case |
|---------|----------|----------|
| `event.locals` → page data | ✅ Yes | Primary pattern for all auth state |
| `useSession()` in component | ✅ Yes | Client-side reactivity after auth events |
| Module-level `useSession()` | ❌ No | Avoid — leaks state between users |

#### Why Not Module-Level Stores?

During SSR, module-level state persists across requests in the Node.js process. User A's session could briefly leak to User B. The `event.locals` pattern ensures request isolation.

See: [SvelteKit State Management](https://svelte.dev/docs/kit/state-management), [Svelte Issue #13594](https://github.com/sveltejs/svelte/issues/13594)

---

## Patterns

### Derived from Multiple Sources

```svelte
<script>
  let search = $state('');
  let category = $state('all');
  let items = $state([]);

  let filtered = $derived.by(() => {
    let result = items;

    if (category !== 'all') {
      result = result.filter(i => i.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }

    return result;
  });
</script>
```

### Debounced Effect

```svelte
<script>
  let query = $state('');

  $effect(() => {
    const q = query; // capture current value
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${q}`);
    }, 300);

    return () => clearTimeout(timeout);
  });
</script>
```

### LocalStorage Sync

```svelte
<script>
  import { browser } from '$app/environment';

  let theme = $state(browser ? localStorage.getItem('theme') ?? 'light' : 'light');

  $effect(() => {
    if (browser) {
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  });
</script>
```

### URL State Synchronization

Sync state to URL query parameters for shareable/bookmarkable state. Use SvelteKit's navigation functions, not `history.pushState` directly.

```svelte
<script>
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';

  // Initialize from URL
  let search = $state(page.url.searchParams.get('q') ?? '');
  let sort = $state(page.url.searchParams.get('sort') ?? 'newest');

  // Sync to URL on change (debounced)
  $effect(() => {
    const url = new URL(page.url);

    if (search) {
      url.searchParams.set('q', search);
    } else {
      url.searchParams.delete('q');
    }

    url.searchParams.set('sort', sort);

    // Use SvelteKit's navigation to avoid conflicts
    replaceState(url, {});
  });
</script>

<input bind:value={search} placeholder="Search..." />
<select bind:value={sort}>
  <option value="newest">Newest</option>
  <option value="oldest">Oldest</option>
</select>
```

**Important:** Always use `replaceState`/`pushState` from `$app/navigation`, not `history.pushState` directly. Direct history manipulation conflicts with SvelteKit's router.

### Navigation Lifecycle

SvelteKit provides lifecycle functions for navigation-aware state:

```svelte
<script>
  import { beforeNavigate, afterNavigate, onNavigate } from '$app/navigation';

  let isNavigating = $state(false);
  let previousPath = $state('');

  // Fires BEFORE navigation starts (before data loading)
  beforeNavigate(({ from, to, cancel }) => {
    isNavigating = true;

    // Can cancel navigation (e.g., unsaved changes)
    if (hasUnsavedChanges && !confirm('Discard changes?')) {
      cancel();
    }
  });

  // Fires immediately before new page renders (after data loaded)
  // Used for view transitions
  onNavigate((navigation) => {
    // Start view transition if supported
    if (document.startViewTransition) {
      return new Promise((resolve) => {
        document.startViewTransition(async () => {
          resolve();
          await navigation.complete;
        });
      });
    }
  });

  // Fires AFTER page updated
  afterNavigate(({ from, to }) => {
    isNavigating = false;
    previousPath = from?.url.pathname ?? '';

    // Scroll to top, reset focus, etc.
  });
</script>

{#if isNavigating}
  <div class="loading-bar" />
{/if}
```

**State behavior during navigation:**

| State Type | Persists? | Notes |
|------------|-----------|-------|
| Context API stores | ✅ Yes | Same layout = same context |
| Module-level state | ✅ Yes | Never resets (be careful!) |
| Component `$state` | ❌ No | Resets when component unmounts |
| `$page.data` | Updates | Automatically from new load function |

---

## Hydration Mismatch Prevention

State that affects SSR rendering **must use cookies**, not localStorage. Otherwise, server renders one thing, client reads localStorage and renders another — causing hydration errors.

### The Problem

```typescript
// ❌ CAUSES HYDRATION MISMATCH
let theme = $state(browser ? localStorage.getItem('theme') ?? 'light' : 'light');
// Server renders 'light', client may read 'dark' from localStorage → mismatch
```

### Common Hydration Mismatch Sources

**1. Timestamps and Dates**

```svelte
<script>
  import { browser } from '$app/environment';

  // ❌ BAD - Server and client generate different timestamps
  let timestamp = $state(new Date().toISOString());

  // ❌ BAD - Timezone differences
  let formatted = $state(new Date().toLocaleTimeString());

  // ✅ GOOD - Pass from server via load function
  let { data } = $props();
  let timestamp = data.timestamp; // Generated server-side

  // ✅ GOOD - Defer to client with $effect
  let clientTime = $state('');
  $effect(() => {
    clientTime = new Date().toLocaleTimeString();
  });
</script>

<!-- Only show after hydration -->
{#if clientTime}
  <span>Local time: {clientTime}</span>
{/if}
```

**2. Random IDs and UUIDs**

```svelte
<script>
  // ❌ BAD - Server generates one ID, client generates another
  let id = $state(crypto.randomUUID());

  // ✅ GOOD - Generate server-side, pass as prop
  let { data } = $props();
  let id = data.generatedId; // From load function

  // ✅ GOOD - Generate once with stable key
  import { browser } from '$app/environment';
  let id = $state('');
  $effect(() => {
    if (!id) id = crypto.randomUUID();
  });
</script>
```

**3. Media Queries and Window Size**

```svelte
<script>
  import { browser } from '$app/environment';

  // ❌ BAD - Server can't access matchMedia
  let isMobile = $state(window.matchMedia('(max-width: 768px)').matches);

  // ✅ GOOD - Default to safe value, update on client
  let isMobile = $state(false); // Server-safe default

  $effect(() => {
    const mq = matchMedia('(max-width: 768px)');
    isMobile = mq.matches;

    const handler = (e) => { isMobile = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });
</script>

<!-- Content is the same on server/client initially -->
<div class={isMobile ? 'mobile-layout' : 'desktop-layout'}>
  <!-- ... -->
</div>
```

**4. Browser-Only APIs**

```svelte
<script>
  import { browser } from '$app/environment';

  // ❌ BAD - navigator doesn't exist on server
  let isOnline = $state(navigator.onLine);

  // ✅ GOOD - Safe default + client update
  let isOnline = $state(true);

  $effect(() => {
    isOnline = navigator.onLine;
    const handleOnline = () => { isOnline = true; };
    const handleOffline = () => { isOnline = false; };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });
</script>
```

### The Solution: Cookie-Based SSR Sync

**1. Server reads from cookie in layout load:**

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  return {
    // Server and client will agree on initial value
    theme: (cookies.get('theme') as 'light' | 'dark' | 'system') ?? 'system',
    sidebarPinned: cookies.get('sidebar-pinned') === 'true',
  };
};
```

**2. Store syncs to cookie on change:**

```typescript
// src/lib/stores/ui.svelte.ts
import { browser } from '$app/environment';

export function createThemeStore(initial: Theme) {
  let theme = $state<Theme>(initial);

  $effect(() => {
    if (browser) {
      // Sync to cookie (server can read on next request)
      document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      // Apply to DOM
      document.documentElement.classList.toggle('dark',
        theme === 'dark' ||
        (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
  });

  return {
    get current() { return theme; },
    set(value: Theme) { theme = value; },
    toggle() { theme = theme === 'dark' ? 'light' : 'dark'; },
  };
}
```

**3. Initialize from page data in layout:**

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createThemeStore, createSidebarStore } from '$lib/stores/ui.svelte';

  let { data, children } = $props();

  // Initialize with server-provided values (no mismatch!)
  const theme = createThemeStore(data.theme);
  const sidebar = createSidebarStore(data.sidebarPinned);

  setContext('theme', theme);
  setContext('sidebar', sidebar);
</script>

{@render children()}
```

### State Storage Decision Matrix

| State Type | Storage | Why |
|------------|---------|-----|
| Theme (affects SSR) | **Cookie** | Server must render correct theme |
| Sidebar pinned state | **Cookie** | Prevents layout shift |
| User preferences | **Cookie** | Consistent initial render |
| Transient UI state | **$state only** | No persistence needed |
| Large data caches | **localStorage** | Too big for cookies, doesn't affect SSR |

### Module State Boundaries

⚠️ **Critical:** Module-level stores (`.svelte.ts` files with top-level `$state`) must NEVER be imported in server contexts.

```typescript
// ❌ NEVER do this in +page.server.ts or hooks.server.ts
import { sidebar } from '$lib/stores/ui.svelte';  // Module state leaks between SSR requests!

// ✅ Always use context or page data for server-compatible state
```

---

## UI State

App-wide UI state for sidebar, theme, and locale. Uses cookies for SSR-affecting state.

### Store Interfaces

Define explicit TypeScript interfaces for type-safe context usage:

```typescript
// src/lib/stores/types.ts

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeStore {
  readonly current: Theme;
  set(value: Theme): void;
  toggle(): void;
  cycle(): void;
}

export interface SidebarStore {
  readonly isOpen: boolean;
  readonly isPinned: boolean;
  open(): void;
  close(): void;
  toggle(): void;
  pin(): void;
  unpin(): void;
}

export interface ToastStore {
  readonly items: readonly Toast[];
  add(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  dismiss(id: string): void;
  clear(): void;
}
```

### Store File (Factory Pattern for SSR Safety)

```typescript
// src/lib/stores/ui.svelte.ts

import { browser } from '$app/environment';
import type { Theme, ThemeStore, SidebarStore } from './types';

// ═══════════════════════════════════════════════════════════════
// THEME (Factory — SSR-safe with cookie sync)
// ═══════════════════════════════════════════════════════════════

function applyTheme(theme: Theme) {
  if (!browser) return;

  const isDark = theme === 'dark' ||
    (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
}

export function createThemeStore(initial: Theme = 'system'): ThemeStore {
  let theme = $state<Theme>(initial);

  // Sync to cookie and apply to DOM
  $effect(() => {
    if (browser) {
      document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      applyTheme(theme);
    }
  });

  // Listen for system preference changes when in 'system' mode
  $effect(() => {
    if (!browser || theme !== 'system') return;

    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  return {
    get current() { return theme; },
    set(value: Theme) { theme = value; },
    toggle() { theme = theme === 'dark' ? 'light' : 'dark'; },
    cycle() {
      const modes: Theme[] = ['light', 'dark', 'system'];
      const i = modes.indexOf(theme);
      theme = modes[(i + 1) % modes.length];
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR (Factory — SSR-safe with cookie sync)
// ═══════════════════════════════════════════════════════════════

export function createSidebarStore(initialPinned: boolean = false): SidebarStore {
  let isOpen = $state(false);
  let isPinned = $state(initialPinned);

  // Sync pinned state to cookie
  $effect(() => {
    if (browser) {
      document.cookie = `sidebar-pinned=${isPinned}; path=/; max-age=31536000; SameSite=Lax`;
    }
  });

  return {
    get isOpen() { return isOpen; },
    get isPinned() { return isPinned; },

    open() { isOpen = true; },
    close() { isOpen = false; },
    toggle() { isOpen = !isOpen; },

    pin() {
      isPinned = true;
      isOpen = true;
    },
    unpin() {
      isPinned = false;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// LOCALE
// ═══════════════════════════════════════════════════════════════
// Locale/i18n state is managed by sveltekit-i18n.
// See i18n.md for locale management, language switching, and translations.
```

### Usage in Components

Components access stores via context (set in root layout):

```svelte
<!-- Sidebar.svelte -->
<script>
  import { getContext } from 'svelte';

  const sidebar = getContext('sidebar');
</script>

<aside class:open={sidebar.isOpen} class:pinned={sidebar.isPinned}>
  <!-- ... -->
</aside>
```

```svelte
<!-- ThemeToggle.svelte -->
<script>
  import { getContext } from 'svelte';

  const theme = getContext('theme');
</script>

<button onclick={theme.cycle} aria-label="Toggle theme">
  {#if theme.current === 'light'}
    ☀️
  {:else if theme.current === 'dark'}
    🌙
  {:else}
    💻
  {/if}
</button>
```

```svelte
<!-- LanguageSwitcher.svelte -->
<!-- See i18n.md for locale/language switching implementation -->
```

### User Menu Integration

For logged-in users, theme and language controls appear in the user menu dropdown:

```svelte
<!-- UserMenu.svelte -->
<script>
  import { getContext } from 'svelte';
  import { locale, locales } from '$lib/i18n';

  const theme = getContext('theme');

  const languages: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
  };
</script>

<div class="user-menu-dropdown">
  <a href="/settings/profile">👤 Profile</a>

  <div class="menu-item">
    🎨 Theme
    <!-- Note: bind:value won't work with getters. Use onchange + value instead -->
    <select value={theme.current} onchange={(e) => theme.set(e.currentTarget.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  </div>

  <div class="menu-item">
    🌐 Language
    <!-- See i18n.md for full language switcher with route handling -->
    <select onchange={(e) => /* navigate to localized route */}>
      {#each $locales as lang}
        <option value={lang} selected={lang === $locale}>
          {languages[lang]}
        </option>
      {/each}
    </select>
  </div>

  <hr />
  <button onclick={logout}>🚪 Sign out</button>
</div>
```

> **Note:** Language switching requires route navigation. See [i18n.md](./i18n.md) for the full implementation with `getLocalizedPath()` helper.

### Responsive Sidebar Behavior

The sidebar state changes based on viewport:

```svelte
<!-- AppShell.svelte -->
<script>
  import { getContext } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';

  const sidebar = getContext('sidebar');

  // Close sidebar on mobile when route changes
  afterNavigate(() => {
    if (browser && window.innerWidth < 768) {
      sidebar.close();
    }
  });
</script>
```

---

## Anti-Patterns

### Don't: Modify State in $derived

```svelte
<script>
  let count = $state(0);

  // BAD - will error
  let doubled = $derived((count++, count * 2));

  // GOOD
  let doubled = $derived(count * 2);
</script>
```

### Don't: Use $effect for Derived Values

```svelte
<script>
  let items = $state([]);

  // BAD - using effect for computation
  let total = $state(0);
  $effect(() => {
    total = items.reduce((sum, i) => sum + i.price, 0);
  });

  // GOOD - use derived
  let total = $derived(items.reduce((sum, i) => sum + i.price, 0));
</script>
```

### Don't: Share Module State with SSR

```typescript
// BAD - shared across all users on server
// stores/user.svelte.ts
let user = $state(null); // All users see same user!

// GOOD - use context in layout
// +layout.svelte
const user = createUserStore();
setContext('user', user);
```

### Don't: Forget Cleanup in Effects

```svelte
<script>
  // BAD - memory leak
  $effect(() => {
    window.addEventListener('resize', handleResize);
  });

  // GOOD - cleanup
  $effect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>
```

---

## File Structure

```
src/lib/
├── stores/
│   ├── theme.svelte.ts       # Theme state (light/dark/system)
│   ├── sidebar.svelte.ts     # Sidebar open/pinned state
│   ├── toast.svelte.ts       # Toast notification queue
│   ├── chat.svelte.ts        # AI assistant state (see ai/README.md)
│   ├── ui.svelte.ts          # Re-exports theme + sidebar (convenience)
│   └── context.ts            # Type-safe context helpers
└── components/
    └── ...
```

**Why split stores?**
- Easier to delete unused features (not using sidebar? delete one file)
- Better tree-shaking potential
- Clearer ownership (theme has its own file)
- `ui.svelte.ts` re-exports for convenience: `import { createThemeStore, createSidebarStore } from '$lib/stores/ui.svelte'`

---

## Summary

| What | Rune | When |
|------|------|------|
| Reactive variable | `$state` | Component/module state |
| No proxy overhead | `$state.raw` | Large datasets, external libs |
| Plain object copy | `$state.snapshot` | API calls, cloning |
| Computed value | `$derived` | 90% of reactivity needs |
| Complex computation | `$derived.by` | Multi-statement derivations |
| Side effects | `$effect` | DOM, localStorage, logging |
| Before DOM update | `$effect.pre` | Scroll position capture |
| Manual cleanup | `$effect.root` | Classes, libraries |
| Receive props | `$props` | All components |
| Two-way binding | `$bindable` | Forms (use sparingly) |

---

## Related

- [pages.md](./pages.md) - `/showcase/state` route demonstrating these patterns
- [design/tokens.md](./design/tokens.md) - Sidebar dimensions, z-index values referenced in UI state
- [app-shell.md](./app-shell.md) - Sidebar component consuming sidebar state
- [design/styling.md](./design/styling.md) - Theme CSS variables applied by themeStore
- [i18n.md](./i18n.md) - Locale/language state management (handled by sveltekit-i18n)
- [ai/README.md](./ai/README.md) - AI assistant chat state with persistence

---

## Sources

### Official Svelte Documentation
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Introducing Runes](https://svelte.dev/blog/runes)
- [$state Documentation](https://svelte.dev/docs/svelte/$state)
- [$derived Documentation](https://svelte.dev/docs/svelte/$derived)
- [$effect Documentation](https://svelte.dev/docs/svelte/$effect)
- [SvelteKit State Management](https://svelte.dev/docs/kit/state-management)
- [SvelteKit Navigation API](https://svelte.dev/docs/kit/$app-navigation)
- [Svelte/Reactivity Module](https://svelte.dev/docs/svelte/svelte-reactivity)
- [View Transitions in SvelteKit](https://svelte.dev/blog/view-transitions)

### GitHub Issues & Discussions
- [Svelte Issue #13594 - Module state SSR safety](https://github.com/sveltejs/svelte/issues/13594)
- [SvelteKit Issue #13746 - Reactive URL Search Params](https://github.com/sveltejs/kit/issues/13746)
- [Svelte Discussion #14376 - Using SvelteMap with runes](https://github.com/sveltejs/svelte/discussions/14376)

### Community Resources
- [Global State Do's and Don'ts (Mainmatter)](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)
- [Avoid Async Effects In Svelte (Joy of Code)](https://joyofcode.xyz/avoid-async-effects-in-svelte)
- [Avoid Sharing Server And Client State (Joy of Code)](https://joyofcode.xyz/avoid-sharing-server-and-client-state-in-sveltekit)
- [Joy of Code - Share State in Svelte 5](https://joyofcode.xyz/how-to-share-state-in-svelte-5)
- [Understanding $derived vs $effect](https://dev.to/mikehtmlallthethings/understanding-svelte-5-runes-derived-vs-effect-1hh)
- [State in URL: the SvelteKit approach](https://www.okupter.com/blog/state-in-url-the-sveltekit-approach)
