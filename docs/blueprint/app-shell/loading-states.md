# Loading States

Visual feedback during data fetching and navigation. Critical for perceived performance and user confidence.

---

## Loading State Types

| Type | When | Pattern |
|------|------|---------|
| **Initial load** | App shell first render | Skeleton screens |
| **Navigation** | Moving between pages | Progress bar + content skeleton |
| **Data fetch** | API calls within page | Inline skeleton or spinner |
| **Action** | Button click, form submit | Button loading state |
| **Streaming** | SSR streaming response | Progressive reveal |

---

## App Shell Initial Load

The shell structure loads instantly. Content areas show skeletons until data arrives.

### Initial State

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   ┌──────────┐   ┌────────────────────────────────────────────────┐ │
│   │ ▓▓▓▓▓▓▓▓ │   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │ │
│   │          │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│   │ ▓▓▓ Nav  │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│   │ ▓▓▓▓▓▓   │   │                                                │ │
│   │ ▓▓▓▓▓    │   │ ┌───────────────┐  ┌───────────────┐          │ │
│   │ ▓▓▓▓▓▓▓  │   │ │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░ │          │ │
│   │          │   │ │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░ │          │ │
│   │          │   │ └───────────────┘  └───────────────┘          │ │
│   │ ▓▓▓▓▓▓▓▓ │   │                                                │ │
│   └──────────┘   └────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

▓ = Instant (shell structure, nav items from session)
░ = Skeleton (content loading)
```

### Shell Initialization Sequence

```typescript
// Order of operations to prevent flash and hydration issues

// 1. Theme (before paint - in app.html)
<script>
  const theme = document.cookie.match(/theme=(\w+)/)?.[1] ?? 'system';
  if (theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
</script>

// 2. Shell structure (instant - in +layout.svelte)
// Sidebar, header zones render immediately with static structure

// 3. User data (from session - in +layout.server.ts)
// Name, avatar, notification count loaded server-side

// 4. Page content (streaming - in +page.server.ts)
// Data-dependent content streams in progressively
```

---

## Skeleton Components

### Skeleton Primitives

```svelte
<!-- src/lib/components/ui/skeleton/Skeleton.svelte -->
<script lang="ts">
  let { class: className = '', ...props } = $props();
</script>

<div
  class="animate-pulse bg-muted rounded {className}"
  aria-hidden="true"
  {...props}
/>
```

### Common Skeletons

```svelte
<!-- SkeletonText.svelte -->
<script lang="ts">
  let { lines = 1, width = 'full' } = $props();

  const widths = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/4': 'w-1/4',
  };
</script>

{#each Array(lines) as _, i}
  <Skeleton
    class="h-4 {i === lines - 1 ? widths[width] : widths.full} {i > 0 ? 'mt-2' : ''}"
  />
{/each}
```

```svelte
<!-- SkeletonCard.svelte -->
<div class="border rounded-lg p-4 space-y-3">
  <Skeleton class="h-5 w-3/4" />
  <Skeleton class="h-4 w-full" />
  <Skeleton class="h-4 w-1/2" />
</div>
```

```svelte
<!-- SkeletonAvatar.svelte -->
<script lang="ts">
  let { size = 'md' } = $props();
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
</script>

<Skeleton class="rounded-full {sizes[size]}" />
```

---

## Page Loading Patterns

### Navigation Progress Bar

Shows during client-side navigation. Positioned at top of viewport.

```svelte
<!-- src/lib/components/shell/NavigationProgress.svelte -->
<script lang="ts">
  import { navigating } from '$app/state';

  let progress = $state(0);
  let visible = $state(false);

  $effect(() => {
    if (navigating.to) {
      visible = true;
      progress = 0;

      // Animate to 90% quickly, then slow down
      const interval = setInterval(() => {
        progress = Math.min(progress + (90 - progress) * 0.1, 90);
      }, 100);

      return () => clearInterval(interval);
    } else if (visible) {
      // Complete and fade out
      progress = 100;
      setTimeout(() => {
        visible = false;
        progress = 0;
      }, 200);
    }
  });
</script>

{#if visible}
  <div
    class="fixed top-0 left-0 right-0 h-1 z-navigation-progress"
    role="progressbar"
    aria-valuenow={progress}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      class="h-full bg-primary transition-all duration-100"
      style:width="{progress}%"
    />
  </div>
{/if}
```

### Page Content Skeleton

```svelte
<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  import { SkeletonCard } from '$lib/components/ui/skeleton';

  let { data } = $props();
</script>

<PageHeader title="Dashboard" />

{#await data.stats}
  <!-- Skeleton while loading -->
  <div class="grid grid-cols-3 gap-4">
    {#each Array(3) as _}
      <SkeletonCard />
    {/each}
  </div>
{:then stats}
  <!-- Actual content -->
  <div class="grid grid-cols-3 gap-4">
    {#each stats as stat}
      <StatCard {stat} />
    {/each}
  </div>
{/await}
```

---

## Streaming with SvelteKit

Use streaming to show content progressively as it loads.

### Server Load Function

```typescript
// src/routes/(app)/dashboard/+page.server.ts
export const load = async ({ locals }) => {
  // Fast data - return immediately
  const user = locals.user;

  // Slow data - stream in
  const statsPromise = fetchStats(user.id);
  const activityPromise = fetchRecentActivity(user.id);

  return {
    user,
    stats: statsPromise,        // Streams in
    activity: activityPromise,  // Streams in
  };
};
```

### Client Component

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<!-- User data available immediately -->
<h1>Welcome, {data.user.name}</h1>

<!-- Stats stream in -->
{#await data.stats}
  <StatsSkeletons />
{:then stats}
  <StatsGrid {stats} />
{:catch error}
  <ErrorCard message="Failed to load stats" />
{/await}

<!-- Activity streams in independently -->
{#await data.activity}
  <ActivitySkeleton />
{:then activity}
  <ActivityFeed {activity} />
{:catch error}
  <ErrorCard message="Failed to load activity" />
{/await}
```

---

## Button Loading States

```svelte
<!-- src/lib/components/ui/button/Button.svelte -->
<script lang="ts">
  let {
    loading = false,
    disabled = false,
    children,
    ...props
  } = $props();
</script>

<button
  disabled={loading || disabled}
  aria-busy={loading}
  {...props}
>
  {#if loading}
    <span class="i-lucide-loader-2 animate-spin" aria-hidden="true" />
    <span class="sr-only">Loading...</span>
  {/if}
  <span class:opacity-0={loading}>
    {@render children()}
  </span>
</button>
```

### Form Submit Pattern

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();

  const { enhance, submitting } = superForm(data.form);
</script>

<form method="POST" use:enhance>
  <!-- form fields -->

  <Button type="submit" loading={$submitting}>
    Save Changes
  </Button>
</form>
```

---

## Inline Loading

For data fetches within a page that don't require full skeleton.

```svelte
<script lang="ts">
  let loading = $state(false);
  let items = $state<Item[]>([]);

  async function loadMore() {
    loading = true;
    try {
      const newItems = await fetchMoreItems(cursor);
      items = [...items, ...newItems];
    } finally {
      loading = false;
    }
  }
</script>

<ul>
  {#each items as item}
    <li>{item.name}</li>
  {/each}
</ul>

<button onclick={loadMore} disabled={loading}>
  {#if loading}
    <span class="i-lucide-loader-2 animate-spin" />
    Loading...
  {:else}
    Load more
  {/if}
</button>
```

---

## Sidebar Loading States

### Notification Badge

```svelte
<!-- Badge shows skeleton until count loads -->
<script lang="ts">
  let { count } = $props();
</script>

{#if count === undefined}
  <Skeleton class="h-4 w-4 rounded-full" />
{:else if count > 0}
  <span class="badge">{count > 99 ? '99+' : count}</span>
{/if}
```

### User Menu

```svelte
<!-- User data from session - available immediately -->
<script lang="ts">
  let { user } = $props();
</script>

{#if user}
  <UserMenuButton {user} />
{:else}
  <!-- Fallback skeleton (rare - session should always exist in /app) -->
  <div class="flex items-center gap-2">
    <SkeletonAvatar size="sm" />
    <Skeleton class="h-4 w-24" />
  </div>
{/if}
```

---

## Error States After Loading

When loading fails, show actionable error state:

```svelte
<script lang="ts">
  let { data } = $props();
</script>

{#await data.items}
  <ItemsListSkeleton />
{:then items}
  <ItemsList {items} />
{:catch error}
  <div class="error-state" role="alert">
    <span class="i-lucide-alert-circle text-error" />
    <h3>Failed to load items</h3>
    <p>{error.message}</p>
    <button onclick={() => invalidate('items')}>
      Try again
    </button>
  </div>
{/await}
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen reader | `aria-hidden="true"` on decorative skeletons |
| Progress | `role="progressbar"` with `aria-valuenow` |
| Busy state | `aria-busy="true"` on loading containers |
| Reduced motion | Disable pulse animation |

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
    opacity: 0.7;
  }

  .animate-spin {
    animation: none;
  }
}
```

---

## Performance Tips

| Pattern | Why |
|---------|-----|
| Stream slow data | Show fast content immediately |
| Skeleton matches content | Prevents layout shift (CLS) |
| Avoid nested spinners | One loading indicator per region |
| Use `{#await}` over `{#if loading}` | Built-in error handling |
| Prefetch on hover | `data-sveltekit-preload-data="hover"` |

---

## Component Location

```
src/lib/components/
├── ui/
│   └── skeleton/
│       ├── Skeleton.svelte
│       ├── SkeletonText.svelte
│       ├── SkeletonCard.svelte
│       ├── SkeletonAvatar.svelte
│       └── index.ts
└── shell/
    └── NavigationProgress.svelte
```

---

## Related

- [./layout.md](./layout.md) - Shell structure
- [../error-handling.md](../error-handling.md) - Error states
- [../state.md](../state.md) - Loading state management
- [./toast.md](./toast.md) - Feedback after loading
