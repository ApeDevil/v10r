# Component Architecture

Accessible, composable UI components built on Bits UI primitives with CVA styling.

---

## Strategy

**Primitives + Composites** layered architecture.

| Layer | Purpose | Example |
|-------|---------|---------|
| **Bits UI** | Headless, accessible primitives | `Dialog.Root`, `Dialog.Trigger` |
| **Primitives** | Styled atomic components | `Button`, `Input`, `Badge` |
| **Composites** | Composed from primitives | `Card`, `FormField`, `UserMenu` |

### Why This Architecture

```
Bits UI (headless)
    ↓ wrap with CVA styles
Primitives (styled atoms)
    ↓ compose together
Composites (molecules/organisms)
    ↓ use in
Pages
```

- **Bits UI**: Accessibility, keyboard nav, ARIA—handled
- **Primitives**: Consistent styling via CVA + UnoCSS
- **Composites**: Business logic, layout, feature-specific

---

## Installation

```bash
bun add bits-ui class-variance-authority clsx
bun add -D @iconify/svelte
```

---

## CVA (Class Variance Authority)

Type-safe variant system for component styles.

### Basic Pattern

```typescript
// src/lib/components/primitives/button/button.ts
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  // Base classes (always applied)
  [
    'inline-flex items-center justify-center',
    'rounded-md font-medium',
    'transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      intent: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-transparent border border-border text-fg hover:bg-muted/10',
        ghost: 'bg-transparent text-fg hover:bg-muted/10',
        destructive: 'bg-error text-white hover:bg-error/90',
      },
      size: {
        sm: 'h-8 px-3 text-fluid-sm',
        md: 'h-10 px-4 text-fluid-base',
        lg: 'h-12 px-6 text-fluid-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
```

### Using with clsx

```typescript
// src/lib/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx.
 * Use for combining CVA variants with additional classes.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

---

## Primitives

### Button

```svelte
<!-- src/lib/components/primitives/button/Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { buttonVariants, type ButtonVariants } from './button.ts';
  import { cn } from '$lib/utils/cn';

  interface Props extends HTMLButtonAttributes, ButtonVariants {
    children: Snippet;
    class?: string;
  }

  let {
    children,
    intent = 'primary',
    size = 'md',
    class: className,
    ...restProps
  }: Props = $props();
</script>

<button class={cn(buttonVariants({ intent, size }), className)} {...restProps}>
  {@render children()}
</button>
```

### Input

```svelte
<!-- src/lib/components/primitives/input/Input.svelte -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  interface Props extends HTMLInputAttributes {
    error?: boolean;
    class?: string;
  }

  let {
    error = false,
    class: className,
    ...restProps
  }: Props = $props();
</script>

<input
  class={cn(
    'flex h-10 w-full rounded-md border bg-bg px-3 py-2',
    'text-fluid-base text-fg placeholder:text-muted',
    'transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    error ? 'border-error' : 'border-border',
    className
  )}
  aria-invalid={error ? 'true' : undefined}
  {...restProps}
/>
```

### Badge

```typescript
// src/lib/components/primitives/badge/badge.ts
import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-fluid-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-muted/20 text-muted',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        error: 'bg-error/10 text-error',
        outline: 'border border-border text-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
```

```svelte
<!-- src/lib/components/primitives/badge/Badge.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { badgeVariants, type BadgeVariants } from './badge.ts';
  import { cn } from '$lib/utils/cn';

  interface Props extends BadgeVariants {
    children: Snippet;
    class?: string;
  }

  let { children, variant = 'default', class: className }: Props = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)}>
  {@render children()}
</span>
```

### Avatar

```svelte
<!-- src/lib/components/primitives/avatar/Avatar.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    src?: string | null;
    alt?: string;
    fallback?: string;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    src,
    alt = '',
    fallback = '?',
    size = 'md',
    class: className,
  }: Props = $props();

  let imageError = $state(false);

  const sizes = {
    sm: 'h-8 w-8 text-fluid-xs',
    md: 'h-10 w-10 text-fluid-sm',
    lg: 'h-12 w-12 text-fluid-base',
  };

  // Generate initials from fallback
  let initials = $derived(
    fallback
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  );
</script>

<div
  class={cn(
    'relative flex shrink-0 items-center justify-center rounded-full bg-muted/20 overflow-hidden',
    sizes[size],
    className
  )}
>
  {#if src && !imageError}
    <img
      {src}
      {alt}
      class="h-full w-full object-cover"
      onerror={() => (imageError = true)}
    />
  {:else}
    <span class="font-medium text-muted">{initials}</span>
  {/if}
</div>
```

### Select (using Bits UI)

```svelte
<!-- src/lib/components/primitives/select/Select.svelte -->
<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';

  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    options: Option[];
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
    class?: string;
  }

  let {
    options,
    value = $bindable(),
    placeholder = 'Select...',
    disabled = false,
    onchange,
    class: className,
  }: Props = $props();

  function handleChange(v: string | undefined) {
    if (v !== undefined) {
      value = v;
      onchange?.(v);
    }
  }
</script>

<SelectPrimitive.Root {disabled} onValueChange={handleChange}>
  <SelectPrimitive.Trigger
    class={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg px-3 py-2',
      'text-fluid-base text-fg',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
  >
    <SelectPrimitive.Value {placeholder} />
    <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
  </SelectPrimitive.Trigger>

  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      class="z-dropdown min-w-[8rem] overflow-hidden rounded-md border border-border bg-bg shadow-lg"
      sideOffset={4}
    >
      <SelectPrimitive.Viewport class="p-1">
        {#each options as option}
          <SelectPrimitive.Item
            value={option.value}
            disabled={option.disabled}
            class={cn(
              'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5',
              'text-fluid-sm text-fg outline-none',
              'data-[highlighted]:bg-muted/10',
              'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
            )}
          >
            {option.label}
            <SelectPrimitive.ItemIndicator class="ml-auto">
              <Icon icon="lucide:check" class="h-4 w-4" />
            </SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>
        {/each}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>
```

---

## Composites

### Card

```svelte
<!-- src/lib/components/composites/card/Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
    class?: string;
  }

  let { header, footer, children, class: className }: Props = $props();
</script>

<article
  class={cn(
    'rounded-lg border border-border bg-bg shadow-sm',
    className
  )}
>
  {#if header}
    <header class="border-b border-border px-fluid-4 py-fluid-3">
      {@render header()}
    </header>
  {/if}

  {#if children}
    <div class="px-fluid-4 py-fluid-4">
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <footer class="border-t border-border px-fluid-4 py-fluid-3">
      {@render footer()}
    </footer>
  {/if}
</article>
```

Usage:

```svelte
<Card>
  {#snippet header()}
    <h3 class="text-fluid-lg font-semibold">Card Title</h3>
  {/snippet}

  <p>Card content goes here.</p>

  {#snippet footer()}
    <Button size="sm">Action</Button>
  {/snippet}
</Card>
```

### FormField

```svelte
<!-- src/lib/components/composites/form-field/FormField.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    label: string;
    id?: string;
    error?: string;
    description?: string;
    required?: boolean;
    children: Snippet;
    class?: string;
  }

  let {
    label,
    id: propId,
    error,
    description,
    required = false,
    children,
    class: className,
  }: Props = $props();

  // Generate IDs for accessibility
  const id = propId ?? crypto.randomUUID();
  const errorId = `${id}-error`;
  const descId = `${id}-description`;
</script>

<div class={cn('space-y-2', className)}>
  <label for={id} class="text-fluid-sm font-medium text-fg">
    {label}
    {#if required}
      <span class="text-error">*</span>
    {/if}
  </label>

  {#if description}
    <p id={descId} class="text-fluid-xs text-muted">{description}</p>
  {/if}

  <div>
    {@render children()}
  </div>

  {#if error}
    <p id={errorId} class="text-fluid-xs text-error" role="alert">
      {error}
    </p>
  {/if}
</div>
```

Usage:

```svelte
<FormField label="Email" error={$errors.email} required>
  <Input
    type="email"
    name="email"
    bind:value={$form.email}
    error={!!$errors.email}
  />
</FormField>
```

### ConfirmDialog

```svelte
<!-- src/lib/components/composites/confirm-dialog/ConfirmDialog.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { Button } from '$lib/components/primitives';
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    open = $bindable(),
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onconfirm,
    oncancel,
  }: Props = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-overlay bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <Dialog.Content
      class={cn(
        'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-md rounded-lg border border-border bg-bg p-6 shadow-xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out'
      )}
    >
      <Dialog.Title class="text-fluid-lg font-semibold text-fg">
        {title}
      </Dialog.Title>

      {#if description}
        <Dialog.Description class="mt-2 text-fluid-sm text-muted">
          {description}
        </Dialog.Description>
      {/if}

      <div class="mt-6 flex justify-end gap-3">
        <Button intent="secondary" onclick={oncancel}>
          {cancelLabel}
        </Button>
        <Button
          intent={destructive ? 'destructive' : 'primary'}
          onclick={onconfirm}
        >
          {confirmLabel}
        </Button>
      </div>

      <Dialog.Close
        class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
      >
        <Icon icon="lucide:x" class="h-4 w-4" />
        <span class="sr-only">Close</span>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### PageHeader

Per-page header for title, breadcrumbs, and actions. **Not a global header** — lives inside the main content area, used per-page as needed. See [app-shell.md](../app-shell.md#pageheader) for full documentation.

```svelte
<!-- src/lib/components/composites/page-header/PageHeader.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Breadcrumb {
    label: string;
    href?: string;
  }

  interface Props {
    title: string;
    breadcrumbs?: Breadcrumb[];
    actions?: Snippet;
    class?: string;
  }

  let { title, breadcrumbs, actions, class: className }: Props = $props();
</script>

<header class={cn('mb-6', className)}>
  {#if breadcrumbs?.length}
    <nav class="mb-2 text-sm text-muted" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1">
        {#each breadcrumbs as crumb, i}
          {#if i > 0}
            <li class="text-muted/50">/</li>
          {/if}
          <li>
            {#if crumb.href}
              <a href={crumb.href} class="hover:text-fg">{crumb.label}</a>
            {:else}
              <span>{crumb.label}</span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  {/if}

  <div class="flex items-center justify-between gap-4">
    <h1 class="text-2xl font-semibold text-fg">{title}</h1>

    {#if actions}
      <div class="flex items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
</header>
```

Usage:

```svelte
<PageHeader
  title="Project Alpha"
  breadcrumbs={[
    { label: 'Projects', href: '/app/projects' },
    { label: 'Project Alpha' }
  ]}
>
  {#snippet actions()}
    <Button intent="secondary">Edit</Button>
    <DropdownMenu>...</DropdownMenu>
  {/snippet}
</PageHeader>
```

---

### QuickSearch

Global search and navigation modal. Opens via `⌘K` or sidebar trigger.

```svelte
<!-- src/lib/components/composites/quick-search/QuickSearch.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { Input } from '$lib/components/primitives';
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';
  import { goto } from '$app/navigation';

  interface QuickSearchItem {
    id: string;
    type: 'page' | 'action' | 'recent';
    label: string;
    icon: string;
    href?: string;
    action?: () => void;
  }

  interface Props {
    open: boolean;
    items: QuickSearchItem[];
  }

  let { open = $bindable(false), items }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);

  // Filter items based on query
  let filtered = $derived(
    query
      ? items.filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase())
        )
      : items
  );

  // Group by type
  let grouped = $derived({
    recent: filtered.filter((i) => i.type === 'recent'),
    pages: filtered.filter((i) => i.type === 'page'),
    actions: filtered.filter((i) => i.type === 'action'),
  });

  function handleSelect(item: QuickSearchItem) {
    open = false;
    query = '';
    if (item.href) {
      goto(item.href);
    } else if (item.action) {
      item.action();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const total = filtered.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % total;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + total) % total;
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  }

  // Reset on open
  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
    }
  });
</script>

<!-- Global keyboard shortcut -->
<svelte:window
  onkeydown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      open = true;
    }
  }}
/>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-overlay bg-black/50" />
    <Dialog.Content
      class={cn(
        'fixed left-1/2 top-1/4 z-modal -translate-x-1/2',
        'w-full max-w-lg rounded-lg border border-border bg-bg shadow-xl'
      )}
      onkeydown={handleKeydown}
    >
      <div class="flex items-center gap-3 border-b border-border px-4 py-3">
        <Icon icon="lucide:search" class="h-5 w-5 text-muted" />
        <input
          type="text"
          placeholder="Search pages, actions..."
          class="flex-1 bg-transparent text-fg placeholder:text-muted focus:outline-none"
          bind:value={query}
        />
        <kbd class="rounded bg-muted/20 px-2 py-0.5 text-xs text-muted">ESC</kbd>
      </div>

      <div class="max-h-80 overflow-y-auto p-2">
        {#if grouped.recent.length > 0}
          <div class="mb-2">
            <span class="px-2 text-xs font-medium text-muted">Recent</span>
            {#each grouped.recent as item, i}
              <button
                class={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                  filtered.indexOf(item) === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-fg hover:bg-muted/10'
                )}
                onclick={() => handleSelect(item)}
              >
                <Icon icon={item.icon} class="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            {/each}
          </div>
        {/if}

        {#if grouped.pages.length > 0}
          <div class="mb-2">
            <span class="px-2 text-xs font-medium text-muted">Pages</span>
            {#each grouped.pages as item}
              <button
                class={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                  filtered.indexOf(item) === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-fg hover:bg-muted/10'
                )}
                onclick={() => handleSelect(item)}
              >
                <Icon icon={item.icon} class="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            {/each}
          </div>
        {/if}

        {#if grouped.actions.length > 0}
          <div>
            <span class="px-2 text-xs font-medium text-muted">Actions</span>
            {#each grouped.actions as item}
              <button
                class={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                  filtered.indexOf(item) === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-fg hover:bg-muted/10'
                )}
                onclick={() => handleSelect(item)}
              >
                <Icon icon={item.icon} class="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            {/each}
          </div>
        {/if}

        {#if filtered.length === 0}
          <div class="py-8 text-center text-muted">
            No results for "{query}"
          </div>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### QuickSearchTrigger (Sidebar)

Fake input that opens QuickSearch. Adapts to sidebar collapsed/expanded state.

```svelte
<!-- src/lib/components/composites/quick-search/QuickSearchTrigger.svelte -->
<script lang="ts">
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    collapsed?: boolean;
    onclick: () => void;
  }

  let { collapsed = false, onclick }: Props = $props();
</script>

{#if collapsed}
  <!-- Rail mode: icon only -->
  <button
    class="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-muted/10 hover:text-fg"
    {onclick}
    aria-label="Open search"
  >
    <Icon icon="lucide:search" class="h-5 w-5" />
  </button>
{:else}
  <!-- Expanded mode: fake input -->
  <button
    class={cn(
      'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-bg/50 px-3',
      'text-muted hover:border-muted hover:text-fg',
      'transition-colors duration-fast'
    )}
    {onclick}
  >
    <Icon icon="lucide:search" class="h-4 w-4" />
    <span class="flex-1 text-left text-sm">Search...</span>
    <kbd class="rounded bg-muted/20 px-1.5 py-0.5 text-xs">⌘K</kbd>
  </button>
{/if}
```

Usage in sidebar:

```svelte
<script>
  import { QuickSearch, QuickSearchTrigger } from '$lib/components/composites';

  let searchOpen = $state(false);

  const searchItems = [
    { id: '1', type: 'page', label: 'Dashboard', icon: 'lucide:layout-dashboard', href: '/app/dashboard' },
    { id: '2', type: 'page', label: 'Projects', icon: 'lucide:folder', href: '/app/projects' },
    { id: '3', type: 'page', label: 'Settings', icon: 'lucide:settings', href: '/app/settings' },
    { id: '4', type: 'action', label: 'Create project', icon: 'lucide:plus', action: () => { /* open modal */ } },
    { id: '5', type: 'action', label: 'Toggle theme', icon: 'lucide:moon', action: () => { /* toggle */ } },
    { id: '6', type: 'action', label: 'Sign out', icon: 'lucide:log-out', action: () => { /* logout */ } },
  ];
</script>

<QuickSearchTrigger collapsed={sidebarCollapsed} onclick={() => searchOpen = true} />
<QuickSearch bind:open={searchOpen} items={searchItems} />
```

---

### Toast (using Svelte 5 state)

```typescript
// src/lib/stores/toast.svelte.ts
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

function createToastStore() {
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
    get items() { return toasts; },
    success: (msg: string) => add('success', msg),
    error: (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
    info: (msg: string) => add('info', msg),
    remove,
  };
}

export const toast = createToastStore();
```

```svelte
<!-- src/lib/components/composites/toast/Toaster.svelte -->
<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';
  import { fly } from 'svelte/transition';

  const icons = {
    success: 'lucide:check-circle',
    error: 'lucide:x-circle',
    warning: 'lucide:alert-triangle',
    info: 'lucide:info',
  };

  const styles = {
    success: 'border-success/50 bg-success/10',
    error: 'border-error/50 bg-error/10',
    warning: 'border-warning/50 bg-warning/10',
    info: 'border-primary/50 bg-primary/10',
  };
</script>

<div class="fixed bottom-4 right-4 z-toast flex flex-col gap-2">
  {#each toast.items as item (item.id)}
    <div
      class={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg',
        styles[item.type]
      )}
      transition:fly={{ x: 100, duration: 200 }}
      role="alert"
    >
      <Icon icon={icons[item.type]} class="h-5 w-5" />
      <span class="text-fluid-sm">{item.message}</span>
      <button
        onclick={() => toast.remove(item.id)}
        class="ml-auto opacity-70 hover:opacity-100"
      >
        <Icon icon="lucide:x" class="h-4 w-4" />
      </button>
    </div>
  {/each}
</div>
```

---

## Icons (Iconify)

```svelte
<script>
  import Icon from '@iconify/svelte';
</script>

<!-- Lucide icons (recommended) -->
<Icon icon="lucide:home" class="h-5 w-5" />
<Icon icon="lucide:settings" class="h-5 w-5" />
<Icon icon="lucide:user" class="h-5 w-5" />

<!-- Any Iconify set -->
<Icon icon="mdi:github" class="h-5 w-5" />
<Icon icon="logos:svelte-icon" class="h-5 w-5" />
```

Browse icons: [Iconify Icon Sets](https://icon-sets.iconify.design/)

---

## Component Inventory

### Priority 1 (Auth & Core)

| Component | Type | Status |
|-----------|------|--------|
| Button | Primitive | Required |
| Input | Primitive | Required |
| Select | Primitive | Required |
| Checkbox | Primitive | Required |
| Avatar | Primitive | Required |
| Badge | Primitive | Required |
| Card | Composite | Required |
| FormField | Composite | Required |

### Priority 2 (Showcase)

| Component | Type | Status |
|-----------|------|--------|
| Dialog/Modal | Primitive | Required |
| Drawer | Primitive | Required |
| DropdownMenu | Primitive | Required |
| Tabs | Primitive | Required |
| Toast/Toaster | Composite | Required |
| QuickSearch | Composite | Required |
| PageHeader | Composite | Required |
| Alert | Composite | Required |
| Skeleton | Primitive | Required |

### Priority 3 (Data)

| Component | Type | Status |
|-----------|------|--------|
| Table | Primitive | Required |
| Pagination | Composite | Required |
| Combobox | Primitive | Optional |
| Tooltip | Primitive | Optional |
| Popover | Primitive | Optional |

### Shell Components

Navigation components for the app shell are documented separately in [app-shell.md](./app-shell.md):

| Component | Location | Purpose |
|-----------|----------|---------|
| NavItem | `shell/` | Compound nav button with dropdown |
| NavDropdown | `shell/` | Dropdown menu for nav items |
| UserMenu | `shell/` | User avatar + dropdown |
| SidebarFab | `shell/` | Mobile trigger button |

---

## File Structure

```
src/lib/
├── components/
│   ├── primitives/
│   │   ├── button/
│   │   │   ├── Button.svelte
│   │   │   ├── button.ts          # CVA variants
│   │   │   └── index.ts
│   │   ├── input/
│   │   │   ├── Input.svelte
│   │   │   └── index.ts
│   │   ├── select/
│   │   ├── checkbox/
│   │   ├── avatar/
│   │   ├── badge/
│   │   ├── dialog/
│   │   ├── drawer/
│   │   ├── dropdown-menu/
│   │   ├── tabs/
│   │   ├── skeleton/
│   │   ├── table/
│   │   └── index.ts               # Barrel export
│   │
│   ├── composites/
│   │   ├── card/
│   │   │   ├── Card.svelte
│   │   │   └── index.ts
│   │   ├── form-field/
│   │   ├── confirm-dialog/
│   │   ├── toast/
│   │   │   ├── Toaster.svelte
│   │   │   └── index.ts
│   │   ├── quick-search/
│   │   │   ├── QuickSearch.svelte
│   │   │   ├── QuickSearchTrigger.svelte
│   │   │   └── index.ts
│   │   ├── page-header/
│   │   │   ├── PageHeader.svelte
│   │   │   └── index.ts
│   │   ├── alert/
│   │   ├── pagination/
│   │   ├── data-table/
│   │   └── index.ts               # Barrel export
│   │
│   ├── shell/                     # App shell (see app-shell.md)
│   │   ├── AppShell.svelte
│   │   ├── Sidebar.svelte
│   │   └── ...
│   │
│   └── index.ts                   # Root barrel export
│
├── stores/
│   └── toast.svelte.ts
│
└── utils/
    └── cn.ts                      # clsx wrapper
```

### Barrel Exports

```typescript
// src/lib/components/primitives/index.ts
export { default as Button } from './button/Button.svelte';
export { default as Input } from './input/Input.svelte';
export { default as Select } from './select/Select.svelte';
export { default as Avatar } from './avatar/Avatar.svelte';
export { default as Badge } from './badge/Badge.svelte';
// ...

// src/lib/components/composites/index.ts
export { default as Card } from './card/Card.svelte';
export { default as FormField } from './form-field/FormField.svelte';
export { default as ConfirmDialog } from './confirm-dialog/ConfirmDialog.svelte';
export { default as Toaster } from './toast/Toaster.svelte';
export { default as QuickSearch } from './quick-search/QuickSearch.svelte';
export { default as QuickSearchTrigger } from './quick-search/QuickSearchTrigger.svelte';
export { default as PageHeader } from './page-header/PageHeader.svelte';
// ...

// src/lib/components/index.ts
export * from './primitives';
export * from './composites';
```

Usage:

```svelte
<script>
  import { Button, Input, Card, FormField } from '$lib/components';
</script>
```

---

## Svelte 5 Patterns

### Props with TypeScript

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    children: Snippet;
    icon?: Snippet;
    loading?: boolean;
  }

  let { children, icon, loading = false, ...restProps }: Props = $props();
</script>
```

### Bindable Props

```svelte
<script lang="ts">
  interface Props {
    open: boolean;
  }

  // $bindable allows parent to use bind:open
  let { open = $bindable(false) }: Props = $props();
</script>
```

### Snippets as Children

```svelte
<!-- Parent -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}

  <p>Content becomes implicit `children` snippet</p>
</Card>

<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { header, children }: {
    header?: Snippet;
    children?: Snippet;
  } = $props();
</script>

{#if header}{@render header()}{/if}
{#if children}{@render children()}{/if}
```

### Event Handlers

```svelte
<!-- Svelte 5 syntax -->
<button onclick={() => count++}>Click</button>
<input oninput={(e) => value = e.currentTarget.value} />

<!-- With event forwarding -->
<script lang="ts">
  interface Props {
    onclick?: (e: MouseEvent) => void;
  }
  let { onclick }: Props = $props();
</script>

<button {onclick}>Click</button>
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | Bits UI handles via Melt UI |
| **Focus management** | Automatic focus trap in modals |
| **ARIA attributes** | Bits UI provides correct ARIA |
| **Screen readers** | Semantic HTML + ARIA labels |
| **Reduced motion** | Respect `prefers-reduced-motion` |

### Focus Visible

All interactive primitives include:

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
```

### Screen Reader Text

```svelte
<button>
  <Icon icon="lucide:x" class="h-4 w-4" />
  <span class="sr-only">Close dialog</span>
</button>
```

UnoCSS utility: `sr-only` hides visually but keeps accessible.

---

## Summary

| What | How |
|------|-----|
| Base library | Bits UI (headless) |
| Styling | CVA + UnoCSS |
| Architecture | Primitives → Composites |
| Icons | Iconify (@iconify/svelte) |
| Props | `$props()` with TypeScript |
| Slots | Snippets (`{#snippet}`) |
| Events | `onclick`, `oninput` (lowercase) |

---

## Related

- [README.md](./README.md) - Design philosophy and component rules
- [tokens.md](./tokens.md) - Design tokens (colors, spacing, z-index)
- [styling.md](./styling.md) - UnoCSS configuration, fluid scales
- [forms.md](../forms.md) - Form patterns using these components
- [app-shell.md](../app-shell.md) - Shell components (Sidebar, NavItem, etc.)
- [error-handling.md](../error-handling.md) - Error display with Toast
- [pages.md](../pages.md) - `/showcase/ui` component gallery

---

## Sources

- [Bits UI Documentation](https://bits-ui.com/)
- [CVA Documentation](https://cva.style/docs)
- [Iconify for Svelte](https://iconify.design/docs/icon-components/svelte/)
- [Svelte 5 Snippets](https://svelte.dev/docs/svelte/snippet)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
