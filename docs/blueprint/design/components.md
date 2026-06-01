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

## Dependencies

```json
"bits-ui": "^1.x",
"class-variance-authority": "^0.7.x",
"clsx": "^2.x"
```

Dev dependencies:
```json
"@iconify/svelte": "^4.x"
```

> See [development-environment.md](../../foundation/development-environment.md) for installation workflow.

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

Per-page header for title, breadcrumbs, and actions. **Not a global header** — lives inside the main content area, used per-page as needed. See [page-header.md](../app-shell/page-header.md) for full documentation.

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

### CommandPalette

Universal search and command modal. Opens via `⌘K` / `Ctrl+K` or the sidebar search trigger.

```svelte
<!-- src/lib/components/composites/command-palette/CommandPalette.svelte -->
```

Built on Bits UI `Command` + `Dialog` primitives with `shouldFilter={false}` — all filtering is handled by the engine or the component's own derived state.

#### Props

```ts
interface Props {
  open: boolean;       // bindable
  items: CommandPaletteItem[];
  query?: string;      // bindable — parent drives the search engine
  placeholder?: string;
  mode?: 'filter' | 'search';  // default: 'filter'
  loading?: boolean;   // shows spinner in search mode
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `open` | `false` | Bindable. Controls dialog visibility. |
| `items` | — | All items passed to the palette. |
| `query` | `''` | Bindable. Current search query. |
| `placeholder` | `'Search pages, docs, blog, panels…'` | Input placeholder text. |
| `mode` | `'filter'` | `'filter'`: palette filters items client-side. `'search'`: search-surface items arrive pre-matched. |
| `loading` | `false` | Shows a spinner. Used in `'search'` mode while the server lane is in flight. |

#### Item Type

Items use `CommandPaletteItem` from `$lib/components/composites/command-palette/types.ts`:

```ts
type CommandPaletteItemType =
  'page' | 'action' | 'recent' | 'panel' |
  'showcase' | 'section' | 'doc' | 'blog';

interface CommandPaletteItem {
  id: string;
  type: CommandPaletteItemType;
  label: string;
  icon: string;           // CSS icon class, e.g. 'i-lucide-home'
  href?: string;
  action?: () => void;
  secondary?: { icon: string; label: string; action: () => void };
  hint?: string;          // sub-label / breadcrumb
  shortcut?: string;
  snippet?: string;       // plain-text excerpt for search results
  highlight?: [number, number][];  // character ranges into snippet
  badge?: 'en-fallback' | null;
}
```

Items are rendered internally by `CommandPalette`. There is no separate item component.

#### `mode` Prop

| Mode | Behavior |
|------|----------|
| `'filter'` (default) | Self-contained. Filters all items by query client-side. Use for demos. |
| `'search'` | Real universal search. Command items (`panel`/`action`/`recent`) are filtered client-side; search-surface items (`page`/`showcase`/`section`/`doc`/`blog`) arrive pre-matched. |

`AppShell.svelte` always uses `mode="search"`.

#### Display Groups

When a query is active, items are grouped in order: Recent, Pages, Showcases, Elements (section), Docs, Blog, Panels, Actions. When the query is empty, only Recents, Panels, and Actions are shown (launcher view).

#### AppShell Wiring

`CommandPalette` is mounted once in `AppShell.svelte`, bound to the modal store:

```svelte
<CommandPalette
  bind:open={modals.quickSearchOpen}
  bind:query={searchQuery}
  items={searchItems}
  mode="search"
  loading={search.status === 'loading'}
/>
```

The modal store field `modals.quickSearchOpen` and the `ModalId` string `'quickSearch'` are the real shipped identifiers. Open the palette programmatically with `modals.open('quickSearch')` or toggle with `modals.toggle('quickSearch')`.

#### Trigger

There is no standalone trigger component. The trigger is `SidebarTriggers.svelte` (in `shell/`), which calls `modals.open('quickSearch')` when clicked. The ⌘K / Ctrl+K global shortcut does the same.

#### Exports

```ts
// src/lib/components/composites/command-palette/index.ts
export { default as CommandPalette } from './CommandPalette.svelte';
export type { CommandPaletteItem } from './types';
// also exports CVA variant functions
```

The composites barrel re-exports all of these via `export * from './command-palette'`.

For full universal-search behavior (two-lane engine, indexing, blog FTS, `/search` page), see [`../quick-search/ui.md`](../quick-search/ui.md).

---

### Chatbot

Persistent AI assistant modal. Opens via `⌘J` or sidebar trigger. Unlike Quick Search (ephemeral), the chatbot maintains conversation history across modal close/reopen.

See [ai/README.md](../ai/README.md) for full implementation details, provider configuration, and persistence strategies.

```svelte
<!-- src/lib/components/composites/chatbot/Chatbot.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { Chat } from '@ai-sdk/svelte';
  import { cn } from '$lib/utils/cn';
  import { chatStore } from '$lib/stores/chat.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import Icon from '@iconify/svelte';

  const chat = new Chat({
    api: '/api/chat',
    onFinish: (message) => {
      chatStore.addMessage('assistant', message.content);
    },
  });

  function handleSend(text: string) {
    chatStore.addMessage('user', text);
    chat.sendMessage({ text });
  }
</script>

<!-- Global keyboard shortcut -->
<svelte:window
  onkeydown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      chatStore.toggle();
    }
  }}
/>

<Dialog.Root bind:open={chatStore.isOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-overlay bg-black/50" />
    <Dialog.Content
      class={cn(
        'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
        'flex h-[600px] w-full max-w-2xl flex-col',
        'rounded-lg border border-border bg-bg shadow-xl'
      )}
    >
      <!-- Header -->
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:bot" class="h-5 w-5 text-primary" />
          <Dialog.Title class="font-semibold text-fg">AI Assistant</Dialog.Title>
        </div>
        <Dialog.Close class="rounded p-1.5 text-muted hover:bg-muted/10">
          <Icon icon="lucide:x" class="h-4 w-4" />
        </Dialog.Close>
      </header>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4">
        {#each chat.messages as message (message.id)}
          <ChatMessage role={message.role} parts={message.parts} />
        {/each}
      </div>

      <!-- Input -->
      <ChatInput onsubmit={handleSend} disabled={chat.isLoading} />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### ChatbotTrigger (Sidebar)

Adapts to sidebar collapsed/expanded state, similar to the Quick Search trigger.

```svelte
<!-- src/lib/components/composites/chatbot/ChatbotTrigger.svelte -->
<script lang="ts">
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';
  import { chatStore } from '$lib/stores/chat.svelte';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();
</script>

{#if collapsed}
  <!-- Rail mode: icon only -->
  <button
    class="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-muted/10 hover:text-fg"
    onclick={() => chatStore.open()}
    aria-label="Open AI Assistant"
  >
    <Icon icon="lucide:bot" class="h-5 w-5" />
  </button>
{:else}
  <!-- Expanded mode: fake input -->
  <button
    class={cn(
      'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-bg/50 px-3',
      'text-muted hover:border-muted hover:text-fg'
    )}
    onclick={() => chatStore.open()}
  >
    <Icon icon="lucide:bot" class="h-4 w-4" />
    <span class="flex-1 text-left text-sm">Ask AI...</span>
    <kbd class="rounded bg-muted/20 px-1.5 py-0.5 text-xs">⌘J</kbd>
  </button>
{/if}
```

Usage in sidebar (alongside the Quick Search triggers):

```svelte
<script>
  import { Chatbot } from '$lib/components/composites';
  import { SidebarTriggers } from '$lib/components/shell';
  // CommandPalette and its trigger are wired in AppShell via modals.quickSearchOpen
</script>

<!-- Sidebar header — SidebarTriggers renders both search + AI buttons -->
<SidebarTriggers />

<!-- Chatbot modal (rendered at root level in AppShell) -->
<Chatbot />
<Chatbot />
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
| CommandPalette | Composite | Required |
| Chatbot | Composite | Required |
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

### Priority 4 (Layout)

| Component | Type | Status |
|-----------|------|--------|
| PaneGroup / Pane / PaneResizer | Primitive | Done |
| ReorderablePaneLayout | Composite | Done |
| DockLayout | Composite | Done |

### Shell Components

Navigation components for the app shell are documented separately in [app-shell/](../app-shell/README.md):

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
│   │   ├── pane/
│   │   │   ├── PaneGroup.svelte      # PaneForge wrapper
│   │   │   ├── Pane.svelte
│   │   │   ├── PaneResizer.svelte
│   │   │   ├── pane.ts               # CVA variants
│   │   │   └── index.ts
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
│   │   ├── command-palette/
│   │   │   ├── CommandPalette.svelte
│   │   │   ├── command-palette.ts  # CVA variants
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── chatbot/
│   │   │   ├── Chatbot.svelte
│   │   │   ├── ChatbotTrigger.svelte
│   │   │   ├── ChatMessage.svelte
│   │   │   ├── ChatInput.svelte
│   │   │   └── index.ts
│   │   ├── page-header/
│   │   │   ├── PageHeader.svelte
│   │   │   └── index.ts
│   │   ├── alert/
│   │   ├── pagination/
│   │   ├── data-table/
│   │   ├── reorderable-panes/
│   │   │   ├── ReorderablePaneLayout.svelte
│   │   │   ├── PaneTabBar.svelte
│   │   │   ├── reorderable-panes.ts  # CVA + types
│   │   │   └── index.ts
│   │   ├── dock/
│   │   │   ├── DockLayout.svelte     # Root: context + persistence
│   │   │   ├── DockNode.svelte       # Recursive split/leaf renderer
│   │   │   ├── DockLeaf.svelte       # Tab bar + content area
│   │   │   ├── DockTabBar.svelte     # Tabs with drag source
│   │   │   ├── DockResizeHandle.svelte # Custom pointer + keyboard resize
│   │   │   ├── DockDropOverlay.svelte # Drop zone indicators
│   │   │   ├── DockActivityBar.svelte # Sidebar panel toggles
│   │   │   ├── dock.types.ts         # LayoutNode, PanelDefinition, etc.
│   │   │   ├── dock.state.svelte.ts  # Reactive state + context
│   │   │   ├── dock.operations.ts    # Tree operations (find, split, replace)
│   │   │   ├── dock.persistence.ts   # localStorage save/load
│   │   │   └── index.ts
│   │   └── index.ts               # Barrel export
│   │
│   ├── shell/                     # App shell (see app-shell/)
│   │   ├── AppShell.svelte
│   │   ├── Sidebar.svelte
│   │   └── ...
│   │
│   └── index.ts                   # Root barrel export
│
├── stores/
│   ├── toast.svelte.ts
│   └── chat.svelte.ts             # AI chat state
│
├── server/
│   └── ai/
│       ├── provider.ts            # Provider abstraction
│       └── config.ts              # Model configuration
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
export * from './command-palette'; // CommandPalette, CommandPaletteItem
export { default as Chatbot } from './chatbot/Chatbot.svelte';
export { default as ChatbotTrigger } from './chatbot/ChatbotTrigger.svelte';
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
- [app-shell/](../app-shell/README.md) - Shell components (Sidebar, NavItem, etc.)
- [ai/README.md](../ai/README.md) - AI Assistant implementation and provider configuration
- [error-handling.md](../error-handling.md) - Error display with Toast
- [pages.md](../pages.md) - `/showcase/ui` component gallery

---

## Sources

- [Bits UI Documentation](https://bits-ui.com/)
- [CVA Documentation](https://cva.style/docs)
- [Iconify for Svelte](https://iconify.design/docs/icon-components/svelte/)
- [Svelte 5 Snippets](https://svelte.dev/docs/svelte/snippet)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
