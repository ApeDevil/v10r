# State Management Architecture

Svelte 5 runes for explicit, portable reactivity.

> Rune basics (`$state`, `$derived`, `$effect`, `$props`, `$bindable`, `svelte/reactivity`, cleanup, async-effect rules) live in the **`svelte5-runes`** skill. This doc covers only v10r's state-layer decisions: what state lives where, the SSR-safe sharing rule, the Better Auth session pattern, and project file locations.

---

## Strategy

**Runes-based state** with the context API for SSR safety.

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

### Factory Pattern + Context (SSR-Safe)

Export a factory from `.svelte.ts`, instantiate it once per request in a layout, and expose it via context. Each request gets its own isolated instance — no cross-request leak.

```typescript
// src/lib/state/todos.svelte.ts
export function createTodoStore(initial: Todo[] = []) {
  let todos = $state(initial);

  return {
    get items() { return todos; },
    get completed() { return todos.filter(t => t.done); },
    add(text: string) {
      todos.push({ id: crypto.randomUUID(), text, done: false });
    },
    toggle(id: string) {
      const todo = todos.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },
  };
}
```

```svelte
<!-- +layout.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createTodoStore } from '$lib/state/todos.svelte';

  setContext('todos', createTodoStore()); // per-request instance
</script>
```

### Module State (No SSR Only)

Module-level `$state` exported directly from `.svelte.ts` is shared across ALL users on the server. **Only use for client-only state that never touches SSR.** When in doubt, use the factory + context pattern above.

### Type-Safe Context Helper

```typescript
// src/lib/state/context.ts
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

Don't wrap a `SvelteMap`/`SvelteSet` in `$state` — they're already reactive. For nested data with string keys, prefer `$state<Record<string, T>>` for deep reactivity.

---

## SvelteKit Integration

### Load Function Data

Data from `load` functions is already reactive in components via `$props()`. It updates on navigation.

### Server State to Client

Pass initial state from the server, then hydrate a store on the client.

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createItemStore } from '$lib/state/items.svelte';

  let { data } = $props();

  const store = createItemStore(data.initialItems);
  setContext('items', store);
</script>
```

### Form State with Superforms

See [forms.md](./forms.md). `$form`, `$errors`, `$submitting` from `superForm(data.form)` are already reactive.

---

## Better Auth Session State

Better Auth uses [nano-stores](https://github.com/nanostores/nanostores) internally for `useSession()`. **Correct usage requires understanding SSR safety.**

### SSR Safety Warning

Module-level state in SvelteKit is **shared across all SSR requests** — User A's session could briefly leak to User B in the Node.js process.

```typescript
// ❌ UNSAFE - Module-level singleton shared across SSR requests
const session = useSession(); // Persists in Node.js process!
export const auth = { get user() { return session.value?.data?.user; } };
```

### Recommended Pattern: Server-First

The safe approach populates `event.locals` (request-scoped) in hooks for SSR, with optional client-side reactivity after hydration.

**1. Server: populate `event.locals` in hooks (SSR-safe)**

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

**2. Load functions: access `event.locals`**

```typescript
// src/routes/[[locale=locale]]/account/+layout.server.ts
export async function load({ locals }) {
  return {
    user: locals.user,
    session: locals.session,
  };
}
```

**3. Components: use page data**

```svelte
<!-- src/routes/[[locale=locale]]/account/+layout.svelte -->
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

### Client-Side Reactivity (Post-Hydration)

For reactive updates after sign-in/sign-out (client-side only), use `useSession()` **within components**, not at module level.

**Hydration-safe pattern:** render from server data initially, switch to the client session only after hydration via `$effect` — avoids a hydration mismatch.

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

  const user = $derived(
    browser && clientSession?.data?.user
      ? clientSession.data.user
      : serverUser
  );
</script>

{#if user}
  <p>Welcome, {user.name}!</p>
{:else}
  <a href="/auth/login">Sign in</a>
{/if}
```

> **Why defer with `$effect`?** A bare `{#if browser}` conditional renders nothing on the server and content on the client → hydration mismatch. Deferring the client session with `$effect` means both render the same `page.data.user` content initially.

### Pattern Comparison

| Pattern | SSR Safe | Use Case |
|---------|----------|----------|
| `event.locals` → page data | ✅ Yes | Primary pattern for all auth state |
| `useSession()` in component | ✅ Yes | Client-side reactivity after auth events |
| Module-level `useSession()` | ❌ No | Avoid — leaks state between users |

See: [SvelteKit State Management](https://svelte.dev/docs/kit/state-management), [Svelte Issue #13594](https://github.com/sveltejs/svelte/issues/13594).

---

## URL State Synchronization

Sync state to URL query parameters for shareable/bookmarkable state. **Always use `replaceState`/`pushState` from `$app/navigation`, not `history.pushState` directly** — direct history manipulation conflicts with SvelteKit's router.

```svelte
<script>
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';

  // Initialize from URL
  let search = $state(page.url.searchParams.get('q') ?? '');
  let sort = $state(page.url.searchParams.get('sort') ?? 'newest');

  // Sync to URL on change
  $effect(() => {
    const url = new URL(page.url);
    if (search) url.searchParams.set('q', search);
    else url.searchParams.delete('q');
    url.searchParams.set('sort', sort);
    replaceState(url, {});
  });
</script>
```

### State Behavior During Navigation

| State Type | Persists? | Notes |
|------------|-----------|-------|
| Context API stores | ✅ Yes | Same layout = same context |
| Module-level state | ✅ Yes | Never resets (be careful!) |
| Component `$state` | ❌ No | Resets when component unmounts |
| `page.data` | Updates | Automatically from new load function |

---

## Hydration Mismatch Prevention

State that affects SSR rendering **must use cookies**, not localStorage. Otherwise the server renders one thing, the client reads localStorage and renders another — hydration error.

Common mismatch sources (timestamps/dates, random UUIDs, media queries, browser-only APIs like `navigator`) all share one fix: render a server-safe default, then update on the client inside `$effect`. See the `svelte5-runes` skill for the per-case patterns.

### The Solution: Cookie-Based SSR Sync

**1. Server reads from cookie in layout load:**

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  return {
    theme: (cookies.get('theme') as 'light' | 'dark' | 'system') ?? 'system',
    sidebarPinned: cookies.get('sidebar-pinned') === 'true',
  };
};
```

**2. Store syncs to cookie on change** (see UI State below).

**3. Initialize the store from page data in the layout:**

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createThemeStore, createSidebarStore } from '$lib/state/ui.svelte';

  let { data, children } = $props();

  // Initialize with server-provided values (no mismatch!)
  setContext('theme', createThemeStore(data.theme));
  setContext('sidebar', createSidebarStore(data.sidebarPinned));
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

---

## UI State

App-wide UI state for sidebar, theme, and locale. Uses cookies for SSR-affecting state.

### Store Interfaces

Define explicit TypeScript interfaces for type-safe context usage:

```typescript
// src/lib/state/types.ts

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
// src/lib/state/ui.svelte.ts

import { browser } from '$app/environment';
import type { Theme, ThemeStore, SidebarStore } from './types';

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
    pin() { isPinned = true; isOpen = true; },
    unpin() { isPinned = false; },
  };
}

// Locale/i18n state is managed by Paraglide. See i18n.md.
```

### Usage in Components

Components access stores via context (set in the root layout):

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

> **Gotcha:** `bind:value` won't work against a getter-backed store. Use `value={theme.current}` + `onchange` instead:
> `<select value={theme.current} onchange={(e) => theme.set(e.currentTarget.value)}>`

Language switching requires route navigation. See [i18n.md](./i18n.md) for the full switcher with `getLocalizedPath()`.

### Responsive Sidebar Behavior

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

- **Modifying state in `$derived`** — derivations must be pure. Use `$derived(count * 2)`, never `$derived((count++, count * 2))`.
- **Using `$effect` for derived values** — compute with `$derived`, not an effect that writes to a separate `$state`.
- **Sharing module state with SSR** — top-level `$state` in `.svelte.ts` leaks between users. Use a factory + context in a layout.
- **Forgetting effect cleanup** — return a cleanup function for `addEventListener`, timers, fetch, sockets, observers. See the `svelte5-runes` skill cleanup checklist.

---

## File Structure

```
src/lib/
├── state/
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
- `ui.svelte.ts` re-exports for convenience: `import { createThemeStore, createSidebarStore } from '$lib/state/ui.svelte'`

---

## Related

- [pages.md](./pages.md) - `/showcases/ui` route demonstrating these patterns
- [design/tokens.md](./design/tokens.md) - Sidebar dimensions, z-index values referenced in UI state
- [app-shell/sidebar.md](./app-shell/sidebar.md) - Sidebar component consuming sidebar state
- [design/styling.md](./design/styling.md) - Theme CSS variables applied by themeStore
- [i18n.md](./i18n.md) - Locale/language state management (handled by Paraglide)
- [ai/README.md](./ai/README.md) - AI assistant chat state with persistence

---

## Sources

- [SvelteKit State Management](https://svelte.dev/docs/kit/state-management)
- [Svelte Issue #13594 - Module state SSR safety](https://github.com/sveltejs/svelte/issues/13594)
- [Global State Do's and Don'ts (Mainmatter)](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)
- [Avoid Sharing Server And Client State (Joy of Code)](https://joyofcode.xyz/avoid-sharing-server-and-client-state-in-sveltekit)
