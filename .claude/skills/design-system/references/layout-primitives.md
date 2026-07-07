# Layout Primitives

Reusable layout components that own spacing responsibility.

## Why Primitives?

1. **Centralize spacing logic** - One place to change gaps
2. **Enforce zero-margin rule** - Children don't need margin
3. **Consistent patterns** - Same gaps across the app
4. **Simpler components** - Content components stay dumb

## Stack

Vertical layout with consistent gaps.

### Implementation

```svelte
<!-- src/lib/components/layout/Stack.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    gap?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
    class?: string;
    children: Snippet;
  }

  let { gap = '4', class: className, children }: Props = $props();

  // @unocss-include
  const gapClasses = {
    '1': 'gap-1',
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '5': 'gap-5',
    '6': 'gap-6',
    '7': 'gap-7',
    '8': 'gap-8',
  };
</script>

<div class={cn('flex flex-col', gapClasses[gap], className)}>
  {@render children()}
</div>
```

### Usage

```svelte
<script>
  import { Stack } from '$lib/components/layout';
</script>

<!-- Default gap (16px) -->
<Stack>
  <Card>First</Card>
  <Card>Second</Card>
</Stack>

<!-- Custom gap -->
<Stack gap="6">
  <h2>Section Title</h2>
  <p>Content paragraph</p>
</Stack>

<!-- With additional classes -->
<Stack gap="4" class="max-w-md mx-auto">
  <Input />
  <Input />
  <Button>Submit</Button>
</Stack>
```

## Cluster

Horizontal layout with wrapping and alignment.

### Implementation

```svelte
<!-- src/lib/components/layout/Cluster.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    gap?: '1' | '2' | '3' | '4' | '5' | '6';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    align?: 'start' | 'center' | 'end' | 'stretch';
    wrap?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    gap = '3',
    justify = 'start',
    align = 'center',
    wrap = true,
    class: className,
    children
  }: Props = $props();

  // @unocss-include
  const gapClasses = {
    '1': 'gap-1',
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '5': 'gap-5',
    '6': 'gap-6',
  };

  const justifyClasses = {
    'start': 'justify-start',
    'center': 'justify-center',
    'end': 'justify-end',
    'between': 'justify-between',
    'around': 'justify-around',
  };

  const alignClasses = {
    'start': 'items-start',
    'center': 'items-center',
    'end': 'items-end',
    'stretch': 'items-stretch',
  };
</script>

<div class={cn(
  'flex',
  wrap && 'flex-wrap',
  gapClasses[gap],
  justifyClasses[justify],
  alignClasses[align],
  className
)}>
  {@render children()}
</div>
```

### Usage

```svelte
<script>
  import { Cluster } from '$lib/components/layout';
</script>

<!-- Tags/chips -->
<Cluster gap="2">
  <Tag>JavaScript</Tag>
  <Tag>TypeScript</Tag>
  <Tag>Svelte</Tag>
</Cluster>

<!-- Button group -->
<Cluster gap="3" justify="end">
  <Button variant="ghost">Cancel</Button>
  <Button>Submit</Button>
</Cluster>

<!-- Toolbar -->
<Cluster gap="2" justify="between" class="p-2 border-b">
  <Cluster gap="2">
    <Button size="sm">Bold</Button>
    <Button size="sm">Italic</Button>
  </Cluster>
  <Button size="sm">Save</Button>
</Cluster>
```

## Grid

CSS Grid with consistent gaps.

### Implementation

```svelte
<!-- src/lib/components/layout/Grid.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    cols?: 1 | 2 | 3 | 4 | 6 | 12;
    gap?: '2' | '3' | '4' | '5' | '6';
    class?: string;
    children: Snippet;
  }

  let { cols = 1, gap = '4', class: className, children }: Props = $props();

  // @unocss-include
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
    12: 'grid-cols-12',
  };

  const gapClasses = {
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '5': 'gap-5',
    '6': 'gap-6',
  };
</script>

<div class={cn('grid', colClasses[cols], gapClasses[gap], className)}>
  {@render children()}
</div>
```

### Usage

```svelte
<script>
  import { Grid } from '$lib/components/layout';
</script>

<!-- Card grid -->
<Grid cols={3} gap="5">
  <Card>One</Card>
  <Card>Two</Card>
  <Card>Three</Card>
</Grid>

<!-- Responsive grid -->
<Grid cols={1} gap="4" class="sm:grid-cols-2 lg:grid-cols-3">
  {#each items as item}
    <Card>{item.title}</Card>
  {/each}
</Grid>

<!-- Form layout -->
<Grid cols={2} gap="4">
  <Input label="First Name" />
  <Input label="Last Name" />
  <Input label="Email" class="col-span-2" />
</Grid>
```

## Center

Centering utility.

### Implementation

```svelte
<!-- src/lib/components/layout/Center.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    max?: string;
    class?: string;
    children: Snippet;
  }

  let { max = 'max-w-4xl', class: className, children }: Props = $props();
</script>

<div class={cn('mx-auto px-4', max, className)}>
  {@render children()}
</div>
```

### Usage

```svelte
<Center max="max-w-2xl">
  <article class="prose">
    <h1>Article Title</h1>
    <p>Content...</p>
  </article>
</Center>
```

## Surface

Tonal-elevation plane. Renders an element one rung above its parent surface (app
background = level 0), resolved via context so nesting auto-increments — background →
sidebar → menu → panel each climb a step without naming a number.

### Implementation

A thin wrapper over the `useSurface()` engine hook (`$lib/styles/elevation`):

```svelte
<!-- src/lib/components/layout/Surface.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { type SurfaceOptions, useSurface } from '$lib/styles/elevation';
  import { cn } from '$lib/utils/cn';

  interface Props extends HTMLAttributes<HTMLElement>, SurfaceOptions {
    as?: string; // element tag, defaults to a div
    children: Snippet;
  }

  let { level, as = 'div', class: className, children, ...rest }: Props = $props();

  // level = parent + 1; pass `level` only to pin a reset root.
  const s = useSurface({ level });
</script>

<svelte:element this={as} class={cn(className)} {...rest} {...s.attrs}>
  {@render children()}
</svelte:element>
```

`{...s.attrs}` stamps the *computed* `data-elevation="1..4"`; a global `app.css` block
keyed on `[data-elevation]` supplies the fill/rim/glow for that rung.

### Usage

```svelte
<script>
  import { Surface } from '$lib/components/layout';
</script>

<!-- Auto-increments by nesting depth — no rung named -->
<Surface as="aside" class="p-4 rounded-md">
  Sidebar plane (E1)
  <Surface class="p-3 rounded-md">Card raised above it (E2)</Surface>
</Surface>

<!-- Pin a reset root when a region must re-baseline -->
<Surface level={1}>…</Surface>
```

> **Component vs hook.** `<Surface>` renders a real DOM node. A primitive that stamps
> elevation onto a Bits `.Content` it does not own (Dialog, Popover, Select,
> DropdownMenu, …) instead calls the `useSurface()` hook directly and spreads
> `{...s.attrs}` — no extra wrapper node. Never hardcode a literal `data-elevation="N"`
> (a guard test enforces this). Full engine + ladder: `docs/blueprint/design/tokens.md`.

## Index Export

```typescript
// src/lib/components/layout/index.ts
export { default as Cluster } from './Cluster.svelte';
export { default as PageContainer } from './PageContainer.svelte';
export { default as Stack } from './Stack.svelte';
export { default as Surface } from './Surface.svelte';
```

## Composition Patterns

### Form Layout

```svelte
<Stack gap="6">
  <Stack gap="4">
    <h2>Personal Info</h2>
    <Grid cols={2} gap="4">
      <Input label="First Name" />
      <Input label="Last Name" />
    </Grid>
    <Input label="Email" />
  </Stack>

  <Stack gap="4">
    <h2>Address</h2>
    <Input label="Street" />
    <Grid cols={3} gap="4">
      <Input label="City" />
      <Input label="State" />
      <Input label="ZIP" />
    </Grid>
  </Stack>

  <Cluster gap="3" justify="end">
    <Button variant="ghost">Cancel</Button>
    <Button>Save</Button>
  </Cluster>
</Stack>
```

### Page Layout

```svelte
<Center max="max-w-6xl">
  <Stack gap="8">
    <!-- Hero -->
    <section class="py-fluid-6">
      <Stack gap="4">
        <h1>Page Title</h1>
        <p>Subtitle text</p>
      </Stack>
    </section>

    <!-- Content grid -->
    <section>
      <Grid cols={3} gap="5">
        {#each cards as card}
          <Card>{card.title}</Card>
        {/each}
      </Grid>
    </section>

    <!-- CTA -->
    <section class="py-fluid-5">
      <Cluster gap="4" justify="center">
        <Button size="lg">Get Started</Button>
        <Button size="lg" variant="outline">Learn More</Button>
      </Cluster>
    </section>
  </Stack>
</Center>
```

## When NOT to Use Primitives

1. **One-off layouts** - Simple `flex gap-4` is fine for unique cases
2. **Complex responsive grids** - Use raw CSS Grid with media queries
3. **Semantic elements** - Use `<nav>`, `<header>`, `<footer>` with classes

```svelte
<!-- Fine for simple one-off -->
<div class="flex gap-4 items-center">
  <Avatar />
  <span>{user.name}</span>
</div>

<!-- Use primitive for repeated patterns -->
<Stack gap="4">
  {#each messages as msg}
    <MessageCard {msg} />
  {/each}
</Stack>
```
