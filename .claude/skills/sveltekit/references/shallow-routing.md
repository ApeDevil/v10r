# Shallow Routing

Create history entries without full navigation. Added in SvelteKit 2.12.

## Use Cases

- Modal dialogs dismissible via back button
- Photo galleries with URL-addressable items
- Filter/sort state in browser history
- Any UI state you want navigable without page reload

## API

```typescript
import { pushState, replaceState } from '$app/navigation';

// Create new history entry
pushState(url, state);

// Update current history entry
replaceState(url, state);
```

**Parameters:**
- `url`: Relative URL string, or `''` to keep current URL
- `state`: Object accessible via `page.state`

## Basic Usage

```svelte
<script lang="ts">
  import { pushState } from '$app/navigation';
  import { page } from '$app/state';

  function openModal(itemId: string) {
    pushState(`/items/${itemId}`, { showModal: true, itemId });
  }

  function closeModal() {
    history.back();
  }
</script>

<button onclick={() => openModal('123')}>View Item</button>

{#if page.state.showModal}
  <Modal itemId={page.state.itemId} onclose={closeModal} />
{/if}
```

## With Preloaded Data

Load data for the "target" route without navigating:

```svelte
<script lang="ts">
  import { preloadData, pushState } from '$app/navigation';
  import { page } from '$app/state';

  async function openPhoto(id: string) {
    const result = await preloadData(`/photos/${id}`);

    if (result.type === 'loaded' && result.status === 200) {
      pushState(`/photos/${id}`, {
        selected: true,
        photo: result.data.photo
      });
    }
  }
</script>

{#each photos as photo}
  <a
    href="/photos/{photo.id}"
    onclick={(e) => {
      // Only intercept if JS is available
      if (e.metaKey || e.ctrlKey) return; // Allow cmd/ctrl+click
      e.preventDefault();
      openPhoto(photo.id);
    }}
  >
    <img src={photo.thumbnail} alt={photo.title} />
  </a>
{/each}

{#if page.state.selected}
  <PhotoModal photo={page.state.photo} />
{/if}
```

## Type Safety

Define state shape in `src/app.d.ts`:

```typescript
declare global {
  namespace App {
    interface PageState {
      showModal?: boolean;
      itemId?: string;
      photo?: {
        id: string;
        url: string;
        title: string;
      };
      filterOpen?: boolean;
    }
  }
}

export {};
```

Now TypeScript knows `page.state` shape:

```svelte
<script lang="ts">
  import { page } from '$app/state';

  // TypeScript knows these properties exist
  if (page.state.showModal) {
    const id = page.state.itemId; // string | undefined
  }
</script>
```

## replaceState vs pushState

```typescript
// pushState: Creates new history entry
// User can press "back" to return
pushState('/items/123', { viewing: true });

// replaceState: Updates current entry
// No new history entry created
replaceState('', { updated: true });
```

Use `replaceState` when:
- Updating state without new history entry
- Keeping URL but changing state
- After invalidation to restore state

## State After Invalidation

**Known Issue:** When you call `invalidate()` or `invalidateAll()`, `page.state` is reset to empty object.

**Workaround:**

```svelte
<script lang="ts">
  import { invalidate, replaceState } from '$app/navigation';
  import { page } from '$app/state';

  async function refresh() {
    // Save current state
    const currentState = page.state;

    await invalidateAll();

    // Restore state
    replaceState('', currentState);
  }
</script>
```

## Progressive Enhancement

Always provide fallback links:

```svelte
<script lang="ts">
  import { pushState, preloadData } from '$app/navigation';

  async function handleClick(e: MouseEvent, id: string) {
    // Allow default for keyboard modifiers
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;

    e.preventDefault();

    const result = await preloadData(`/items/${id}`);
    if (result.type === 'loaded') {
      pushState(`/items/${id}`, { data: result.data });
    }
  }
</script>

<!-- Works without JS (full navigation), enhanced with JS (shallow) -->
<a href="/items/{item.id}" onclick={(e) => handleClick(e, item.id)}>
  {item.name}
</a>
```

## Modal Pattern

Complete modal implementation:

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { pushState, preloadData } from '$app/navigation';
  import { page } from '$app/state';

  let { data } = $props();

  async function openItem(id: string, e: MouseEvent) {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();

    const result = await preloadData(`/items/${id}`);
    if (result.type === 'loaded') {
      pushState(`/items/${id}`, {
        showModal: true,
        item: result.data.item
      });
    }
  }

  function closeModal() {
    history.back();
  }
</script>

<ul>
  {#each data.items as item}
    <li>
      <a href="/items/{item.id}" onclick={(e) => openItem(item.id, e)}>
        {item.name}
      </a>
    </li>
  {/each}
</ul>

{#if page.state.showModal}
  <div class="modal-backdrop" onclick={closeModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2>{page.state.item.name}</h2>
      <p>{page.state.item.description}</p>
      <button onclick={closeModal}>Close</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
  }
  .modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    max-width: 500px;
  }
</style>
```

## Tabs/Filters Pattern

```svelte
<script lang="ts">
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';

  const tabs = ['all', 'active', 'completed'] as const;

  function setTab(tab: typeof tabs[number]) {
    replaceState('', { ...page.state, activeTab: tab });
  }

  let activeTab = $derived(page.state.activeTab ?? 'all');
</script>

<div class="tabs">
  {#each tabs as tab}
    <button
      class:active={activeTab === tab}
      onclick={() => setTab(tab)}
    >
      {tab}
    </button>
  {/each}
</div>
```

## Caveats

1. **Invalidation resets state** - Must manually restore after `invalidate()`
2. **SSR limitations** - `page.state` is empty on initial server render
3. **Serialization** - State must be serializable (JSON-compatible)
4. **Same-origin only** - Cannot shallow-route to external URLs
