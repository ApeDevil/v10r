# $props

Component props with TypeScript. Destructure with defaults.

```svelte
<script lang="ts">
  interface Props {
    title: string;
    count?: number;
    onUpdate?: (value: number) => void;
  }

  let { title, count = 0, onUpdate }: Props = $props();
</script>
```

## Defaults and Renaming

```svelte
<script lang="ts">
  let {
    title,
    count = 0,
    variant = 'primary',
    class: className = '',  // Rename reserved words
    ...rest  // Rest props
  }: Props = $props();
</script>
```

## Rest Props

```svelte
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary';
    loading?: boolean;
  }

  let { variant = 'primary', loading = false, ...rest }: Props = $props();
</script>

<button class="btn-{variant}" disabled={loading || rest.disabled} {...rest}>
  {#if loading}<span class="spinner" />{/if}
  {@render children?.()}
</button>
```

## Callbacks

```svelte
<!-- Parent -->
<script lang="ts">
  let count = $state(0);
</script>
<Counter {count} onIncrement={() => count++} onChange={(n) => count = n} />

<!-- Counter.svelte -->
<script lang="ts">
  interface Props {
    count: number;
    onIncrement: () => void;
    onChange: (value: number) => void;
  }

  let { count, onIncrement, onChange }: Props = $props();
</script>

<button onclick={onIncrement}>+</button>
<button onclick={() => onChange(count - 1)}>-</button>
```

## $bindable

```svelte
<!-- TextInput.svelte -->
<script lang="ts">
  let { value = $bindable(''), placeholder = '' }: Props = $props();
</script>
<input bind:value {placeholder} />

<!-- Usage -->
<script lang="ts">
  let name = $state('');
</script>
<TextInput bind:value={name} placeholder="Name" />
```

## Snippets (Children)

```svelte
<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
    footer?: Snippet;
  }

  let { title, children, footer }: Props = $props();
</script>

<div class="card">
  <h2>{title}</h2>
  {@render children()}
  {#if footer}{@render footer()}{/if}
</div>

<!-- Usage -->
<Card title="Welcome">
  <p>Content</p>
  {#snippet footer()}<button>Action</button>{/snippet}
</Card>
```

## Snippets with Parameters

```svelte
<!-- List.svelte -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    items: T[];
    renderItem: Snippet<[T, number]>;
  }

  let { items, renderItem }: Props = $props();
</script>

<ul>
  {#each items as item, index}
    <li>{@render renderItem(item, index)}</li>
  {/each}
</ul>

<!-- Usage -->
<List items={users}>
  {#snippet renderItem(user, index)}
    <span>{index + 1}. {user.name}</span>
  {/snippet}
</List>
```

## Reactivity

Props are read-only.

```svelte
<!-- WRONG --> let { count } = $props(); count++;
<!-- RIGHT --> let { count, onIncrement } = $props(); onIncrement();
<!-- RIGHT --> let { count = $bindable() } = $props(); count++;
```

Derive from props:

```svelte
<script lang="ts">
  let { items, filter }: Props = $props();

  let filtered = $derived(
    items.filter(i => i.toLowerCase().includes(filter.toLowerCase()))
  );
</script>
```

## Generics

```svelte
<script lang="ts" generics="T extends { id: string; label: string }">
  interface Props {
    options: T[];
    value?: T | null;
    onChange?: (selected: T) => void;
  }

  let { options, value = null, onChange }: Props = $props();
</script>

<select onchange={(e) => {
  const selected = options.find(o => o.id === e.currentTarget.value);
  if (selected) onChange?.(selected);
}}>
  {#each options as option}
    <option value={option.id}>{option.label}</option>
  {/each}
</select>
```
