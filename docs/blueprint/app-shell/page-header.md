# PageHeader

Per-page header inside the main content area. **Not a global header** — each page optionally includes this component for its title and actions.

---

## Why No Global Header?

| Global Header | PageHeader (per-page) |
|---------------|----------------------|
| Wastes vertical space | Only where needed |
| One-size-fits-all | Page-specific actions |
| Competes with sidebar | Clean separation |

---

## Structure

```
┌──────┬─────────────────────────────────────────┐
│      │  ┌───────────────────────────────────┐  │
│      │  │ Breadcrumbs (optional)            │  │
│      │  │ Page Title          [Actions]     │  │ ← PageHeader
│      │  ├───────────────────────────────────┤  │
│ Side │  │                                   │  │
│ bar  │  │  Page content...                  │  │
│      │  │                                   │  │
│      │  └───────────────────────────────────┘  │
│      │  Footer                                 │
└──────┴─────────────────────────────────────────┘
```

---

## PageHeader Anatomy

```
┌─────────────────────────────────────────────────┐
│  Projects › Project Alpha                       │  ← Breadcrumbs (optional)
│  Project Alpha                    [Edit] [⋮]   │  ← Title + Actions
└─────────────────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| **Breadcrumbs** | Optional navigation trail |
| **Title** | Page or resource name |
| **Actions** | Primary actions (buttons, dropdown) |

---

## Component

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

---

## Usage

```svelte
<!-- src/routes/app/projects/[id]/+page.svelte -->
<script>
  import { PageHeader } from '$lib/components/composites';
  import { Button, DropdownMenu } from '$lib/components/primitives';

  let { data } = $props();
</script>

<PageHeader
  title={data.project.name}
  breadcrumbs={[
    { label: 'Projects', href: '/app/projects' },
    { label: data.project.name }
  ]}
>
  {#snippet actions()}
    <Button intent="secondary">Edit</Button>
    <DropdownMenu>
      <DropdownItem>Duplicate</DropdownItem>
      <DropdownItem>Archive</DropdownItem>
      <DropdownItem destructive>Delete</DropdownItem>
    </DropdownMenu>
  {/snippet}
</PageHeader>

<!-- Page content below -->
```

---

## Sticky Option

For long pages, PageHeader can stick to top on scroll:

```svelte
<PageHeader title="Dashboard" class="sticky top-0 bg-bg z-10" />
```

---

## Security: Dynamic Content

When title or breadcrumbs come from user-controlled data (e.g., project names), be aware of XSS risks.

### Svelte Auto-Escapes (Safe by Default)

```svelte
<!-- ✅ SAFE: Svelte escapes {title} automatically -->
<h1>{title}</h1>

<!-- ✅ SAFE: Svelte escapes {crumb.label} automatically -->
<span>{crumb.label}</span>
```

### Never Use {@html} for User Content

```svelte
<!-- ❌ DANGEROUS: Never do this with user data -->
<h1>{@html projectName}</h1>

<!-- If you MUST render HTML (e.g., markdown), sanitize first -->
<script>
  import DOMPurify from 'dompurify';
  let safeTitle = DOMPurify.sanitize(projectName);
</script>
<h1>{@html safeTitle}</h1>
```

### Truncation for Long Titles

User-controlled titles can be very long. Truncate to prevent layout breaking:

```svelte
<h1 class="text-2xl font-semibold truncate max-w-md" title={title}>
  {title}
</h1>
```

### Breadcrumb Validation

If breadcrumbs contain user-controlled `href` values, validate the URL:

```typescript
function isValidHref(href: string): boolean {
  // Only allow relative paths or same-origin URLs
  if (href.startsWith('/')) return true;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}
```

```svelte
{#if crumb.href && isValidHref(crumb.href)}
  <a href={crumb.href}>{crumb.label}</a>
{:else}
  <span>{crumb.label}</span>
{/if}
```
