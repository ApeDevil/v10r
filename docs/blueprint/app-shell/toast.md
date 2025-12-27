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

```typescript
// src/lib/stores/toast.svelte.ts
import { SvelteMap } from 'svelte/reactivity';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration: number; // 0 = manual dismiss only
}

const toasts = new SvelteMap<string, Toast>();

const defaultDurations: Record<ToastType, number> = {
  success: 4000,
  error: 0,      // Errors require manual dismiss
  warning: 6000,
  info: 4000,
};

export function toast(options: Omit<Toast, 'id' | 'duration'> & { duration?: number }) {
  const id = crypto.randomUUID();
  const duration = options.duration ?? defaultDurations[options.type];

  const newToast: Toast = { ...options, id, duration };
  toasts.set(id, newToast);

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }

  return id;
}

// Convenience methods
toast.success = (title: string, description?: string) =>
  toast({ type: 'success', title, description });

toast.error = (title: string, description?: string) =>
  toast({ type: 'error', title, description });

toast.warning = (title: string, description?: string) =>
  toast({ type: 'warning', title, description });

toast.info = (title: string, description?: string) =>
  toast({ type: 'info', title, description });

export function dismiss(id: string) {
  toasts.delete(id);
}

export function dismissAll() {
  toasts.clear();
}

export function getToasts() {
  return toasts;
}
```

### Toast Container

```svelte
<!-- src/lib/components/shell/ToastContainer.svelte -->
<script lang="ts">
  import { getToasts, dismiss, type Toast } from '$lib/stores/toast.svelte';
  import { fly } from 'svelte/transition';

  const toasts = getToasts();

  const icons: Record<Toast['type'], string> = {
    success: 'i-lucide-check-circle',
    error: 'i-lucide-x-circle',
    warning: 'i-lucide-alert-triangle',
    info: 'i-lucide-info',
  };
</script>

<div
  class="fixed top-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each [...toasts.values()] as toast (toast.id)}
    <div
      class="toast toast-{toast.type} pointer-events-auto"
      role="alert"
      transition:fly={{ x: 100, duration: 200 }}
    >
      <span class={icons[toast.type]} aria-hidden="true" />
      <div class="toast-content">
        <p class="toast-title">{toast.title}</p>
        {#if toast.description}
          <p class="toast-description">{toast.description}</p>
        {/if}
      </div>
      {#if toast.action}
        <button
          class="toast-action"
          onclick={toast.action.onClick}
        >
          {toast.action.label}
        </button>
      {/if}
      <button
        class="toast-dismiss"
        onclick={() => dismiss(toast.id)}
        aria-label="Dismiss"
      >
        <span class="i-lucide-x" />
      </button>
    </div>
  {/each}
</div>
```

### Shell Integration

Add ToastContainer to the root layout:

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { ToastContainer } from '$lib/components/shell';

  let { children } = $props();
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

### Form Submission

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import { superForm } from 'sveltekit-superforms';

  const { enhance } = superForm(data.form, {
    onResult({ result }) {
      if (result.type === 'success') {
        toast.success('Settings saved');
      } else if (result.type === 'failure') {
        toast.error('Failed to save settings', result.data?.message);
      }
    },
  });
</script>
```

### Delete with Undo

```svelte
<script lang="ts">
  import { toast, dismiss } from '$lib/stores/toast.svelte';

  async function deleteItem(id: string) {
    // Optimistic delete
    items = items.filter(item => item.id !== id);

    const toastId = toast({
      type: 'info',
      title: 'Item deleted',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await restoreItem(id);
          dismiss(toastId);
          toast.success('Item restored');
        },
      },
    });

    // Actually delete after toast expires
    setTimeout(async () => {
      await permanentlyDeleteItem(id);
    }, 5000);
  }
</script>
```

### API Error with Retry

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';

  async function fetchData() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Failed to load data',
        description: 'Check your connection and try again.',
        action: {
          label: 'Retry',
          onClick: () => fetchData(),
        },
      });
    }
  }
</script>
```

### Clipboard Copy

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';

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
| Multiple toasts | Stack vertically, newest on top |
| Max visible | 5 toasts, older ones auto-dismiss |
| Same message repeated | Don't duplicate, extend existing timer |
| Page navigation | Persist toasts (they're in root layout) |

```typescript
// Prevent duplicate toasts
const activeMessages = new Set<string>();

export function toast(options: ToastOptions) {
  const key = `${options.type}:${options.title}`;

  if (activeMessages.has(key)) {
    // Extend existing toast instead of creating new one
    return;
  }

  activeMessages.add(key);
  const id = createToast(options);

  // Cleanup when dismissed
  setTimeout(() => activeMessages.delete(key), options.duration || 10000);

  return id;
}
```

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
├── stores/
│   └── toast.svelte.ts          # Toast state + functions
└── components/
    └── shell/
        └── ToastContainer.svelte # Toast renderer
```

---

## Related

- [./notifications.md](./notifications.md) - Persistent notification center
- [../forms.md](../forms.md) - Superforms integration
- [../error-handling.md](../error-handling.md) - Error feedback patterns
- [../state.md](../state.md) - Svelte 5 state patterns
