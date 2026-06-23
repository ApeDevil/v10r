# Toast Notifications

Ephemeral feedback messages that appear in response to user actions. Distinct from the notification center (persistent) - toasts are immediate, temporary, and action-specific.

---

## When to Use

| Use Toast | Use Notification Center |
|-----------|------------------------|
| Form saved successfully | New comment on your post |
| Item deleted | System maintenance scheduled |
| Settings updated | Security alert |
| Error during action | Export ready for download |
| Copied to clipboard | Someone mentioned you |

**Rule:** Toasts are for **feedback on user-initiated actions**. Notifications are for **events that happen independently**.

---

## Toast Types

| Type | Icon | Use Case | Auto-dismiss |
|------|------|----------|--------------|
| `success` | `i-lucide-check-circle` | Action completed | 4s |
| `error` | `i-lucide-x-circle` | Action failed | Manual |
| `warning` | `i-lucide-alert-triangle` | Action succeeded with caveats | 6s |
| `info` | `i-lucide-info` | Neutral information | 4s |

---

## Wireframe

```
                                    ┌────────────────────────────────┐
                                    │ ✓ Settings saved               │
                                    │                          [✕]  │
                                    └────────────────────────────────┘

                                    ┌────────────────────────────────┐
                                    │ ✗ Failed to delete item        │
                                    │   Network error. Try again?    │
                                    │                   [Retry] [✕]  │
                                    └────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   Sidebar        Main Content                                        │
│                                                                      │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Position:** Top-right corner, below any sticky headers. Stacks vertically with newest on top.

---

## Implementation

### Toast Store

SSR-safe context factory. The root layout creates the instance once with `setToastContext()`; child components read it with `getToast()`.

```typescript
// src/lib/state/toast.svelte.ts
import { getContext, setContext } from 'svelte';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // 0 = manual dismiss only
}

const TOAST_CTX = Symbol('toast');

export function createToastState() {
  let toasts = $state<Toast[]>([]);

  function add(type: ToastType, message: string, duration = 5000) {
    const id = crypto.randomUUID();
    toasts.push({ id, type, message, duration });

    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }

  function remove(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  return {
    get items() {
      return toasts;
    },
    success: (msg: string, duration?: number) => add('success', msg, duration),
    error: (msg: string, duration?: number) => add('error', msg, duration),
    warning: (msg: string, duration?: number) => add('warning', msg, duration),
    info: (msg: string, duration?: number) => add('info', msg, duration),
    remove,
  };
}

// Call in root layout.
export function setToastContext() {
  const toast = createToastState();
  setContext(TOAST_CTX, toast);
  return toast;
}

// Call in child components.
export function getToast() {
  return getContext<ReturnType<typeof createToastState>>(TOAST_CTX);
}
```

The API is `{ items, success, error, warning, info, remove }`. Each toast carries a single `message` string — there is no `title`/`description`/`action` model.

### Toast Container

```svelte
<!-- src/lib/components/composites/toast/ToastContainer.svelte -->
<script lang="ts">
  import { getToast } from '$lib/state/toast.svelte';
  import { fly } from 'svelte/transition';

  const toast = getToast();

  // Limit visible toasts to 5
  const visibleToasts = $derived(toast.items.slice(0, 5));

  const icons: Record<string, string> = {
    success: 'i-lucide-check-circle',
    error: 'i-lucide-x-circle',
    warning: 'i-lucide-alert-triangle',
    info: 'i-lucide-info',
  };
</script>

<div
  class="toast-region"
  role="region"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each visibleToasts as t (t.id)}
    <div
      class="toast toast-{t.type}"
      role="status"
      aria-atomic="true"
      transition:fly={{ x: 300, duration: 250 }}
    >
      <span class={icons[t.type]} aria-hidden="true" />
      <div class="toast-message">{t.message}</div>
      <button
        class="toast-close"
        onclick={() => toast.remove(t.id)}
        aria-label="Dismiss"
      >
        <span class="i-lucide-x" />
      </button>
    </div>
  {/each}
</div>
```

### Shell Integration

Create the context once in the root layout and render the container. `ToastContainer` is re-exported through `shell/index.ts`.

```svelte
<!-- src/routes/[[locale=locale]]/+layout.svelte -->
<script lang="ts">
  import { setToastContext } from '$lib/state/toast.svelte';
  import { ToastContainer } from '$lib/components/shell';

  let { children } = $props();

  setToastContext();
</script>

<div class="app-shell">
  <Sidebar />
  <main>
    {@render children()}
  </main>
  <ToastContainer />
</div>
```

---

## Usage Examples

Read the context with `getToast()`, then call `success`/`error`/`warning`/`info` with a message string and optional duration.

### Form Submission

```svelte
<script lang="ts">
  import { getToast } from '$lib/state/toast.svelte';
  import { superForm } from 'sveltekit-superforms';

  const toast = getToast();

  const { enhance } = superForm(data.form, {
    onResult({ result }) {
      if (result.type === 'success') {
        toast.success('Settings saved');
      } else if (result.type === 'failure') {
        toast.error('Failed to save settings');
      }
    },
  });
</script>
```

### Error with Manual Dismiss

```svelte
<script lang="ts">
  import { getToast } from '$lib/state/toast.svelte';

  const toast = getToast();

  async function fetchData() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    } catch (error) {
      // duration 0 = stays until manually dismissed
      toast.error('Failed to load data. Check your connection and try again.', 0);
    }
  }
</script>
```

### Clipboard Copy

```svelte
<script lang="ts">
  import { getToast } from '$lib/state/toast.svelte';

  const toast = getToast();

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }
</script>
```

---

## Stacking Behavior

| Scenario | Behavior |
|----------|----------|
| Multiple toasts | Stack vertically, newest at the bottom of the array |
| Max visible | 5 (`ToastContainer` slices `toast.items` to the first 5) |
| Auto-dismiss | Each toast removes itself after its `duration` (default 5000ms; 0 = manual only) |
| Page navigation | Persist toasts (the context lives in the root layout) |

---

## Styling

```css
/* UnoCSS utilities + custom properties */
.toast {
  --toast-bg: var(--color-surface);
  --toast-border: var(--color-border);
  --toast-icon: var(--color-text-muted);

  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--toast-bg);
  border: 1px solid var(--toast-border);
  border-radius: 0.5rem;
  box-shadow: var(--shadow-lg);
  min-width: 300px;
  max-width: 400px;
}

.toast-success {
  --toast-icon: var(--color-success);
  --toast-border: var(--color-success-border);
}

.toast-error {
  --toast-icon: var(--color-error);
  --toast-border: var(--color-error-border);
}

.toast-warning {
  --toast-icon: var(--color-warning);
  --toast-border: var(--color-warning-border);
}
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen reader | `aria-live="polite"` on container |
| Role | `role="alert"` on each toast |
| Focus | Don't steal focus, toasts are informational |
| Dismiss | Button with `aria-label="Dismiss"` |
| Reduced motion | Respect `prefers-reduced-motion` for animations |

```css
@media (prefers-reduced-motion: reduce) {
  .toast {
    transition: none;
  }
}
```

---

## Mobile Behavior

| Pattern | Desktop | Mobile |
|---------|---------|--------|
| Position | Top-right | Top-center, full width with padding |
| Max width | 400px | 100% - 2rem |
| Dismiss | Click X or action | Swipe right or tap X |
| Stacking | 5 visible | 3 visible |

```css
@media (max-width: 640px) {
  .toast-container {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }

  .toast {
    width: 100%;
    max-width: none;
  }
}
```

---

## Component Location

```
src/lib/
├── state/
│   └── toast.svelte.ts                       # Toast context factory
└── components/
    └── composites/
        └── toast/
            ├── ToastContainer.svelte         # Toast renderer (re-exported via shell/index.ts)
            ├── Toaster.svelte                # Alternate display variant
            └── index.ts
```

---

## Related

- [./notifications.md](./notifications.md) - Persistent notification center
- [../forms.md](../forms.md) - Superforms integration
- [../error-handling.md](../error-handling.md) - Error feedback patterns
- [../state.md](../state.md) - Svelte 5 state patterns
