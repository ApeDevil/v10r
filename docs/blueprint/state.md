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

For reactive updates after sign-in/sign-out (client-side only), use `useSession()` **within components**, not at module level:

```svelte
<script>
  import { useSession } from '$lib/auth-client';
  import { browser } from '$app/environment';

  // Only runs on client after hydration
  const session = browser ? useSession() : null;
</script>

{#if browser && $session?.data}
  <p>Client-side: {$session.data.user.name}</p>
{/if}
```

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

---

## Hydration Mismatch Prevention

State that affects SSR rendering **must use cookies**, not localStorage. Otherwise, server renders one thing, client reads localStorage and renders another — causing hydration errors.

### The Problem

```typescript
// ❌ CAUSES HYDRATION MISMATCH
let theme = $state(browser ? localStorage.getItem('theme') ?? 'light' : 'light');
// Server renders 'light', client may read 'dark' from localStorage → mismatch
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

### Store File (Factory Pattern for SSR Safety)

```typescript
// src/lib/stores/ui.svelte.ts

import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

// ═══════════════════════════════════════════════════════════════
// THEME (Factory — SSR-safe with cookie sync)
// ═══════════════════════════════════════════════════════════════

function applyTheme(theme: Theme) {
  if (!browser) return;

  const isDark = theme === 'dark' ||
    (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
}

export function createThemeStore(initial: Theme = 'system') {
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

export function createSidebarStore(initialPinned: boolean = false) {
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
│   ├── ui.svelte.ts          # Sidebar, theme, locale state
│   ├── chat.svelte.ts        # AI assistant state (see ai/README.md)
│   ├── toast.svelte.ts       # Toast notifications
│   ├── todos.svelte.ts       # Factory pattern example
│   └── context.ts            # Type-safe context helpers
└── components/
    └── ...
```

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

- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Introducing Runes](https://svelte.dev/blog/runes)
- [$state Documentation](https://svelte.dev/docs/svelte/$state)
- [$derived Documentation](https://svelte.dev/docs/svelte/$derived)
- [$effect Documentation](https://svelte.dev/docs/svelte/$effect)
- [SvelteKit State Management](https://svelte.dev/docs/kit/state-management)
- [Svelte/Reactivity Module](https://svelte.dev/docs/svelte/svelte-reactivity)
- [Global State Do's and Don'ts](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)
- [Joy of Code - Share State in Svelte 5](https://joyofcode.xyz/how-to-share-state-in-svelte-5)
- [Understanding $derived vs $effect](https://dev.to/mikehtmlallthethings/understanding-svelte-5-runes-derived-vs-effect-1hh)
