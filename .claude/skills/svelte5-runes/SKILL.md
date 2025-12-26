---
name: svelte5-runes
description: Svelte 5 runes patterns for Velociraptor projects. Use when writing Svelte 5 components with $state, $derived, $effect, $props, $bindable. Includes Superforms + Valibot validation, Bits UI integration, and mobile-first fluid patterns. Essential for any .svelte file or reactive state management.
---

# Svelte 5 Runes

Compiler directives prefixed with `$`. Built-in keywords. No imports. Compile-time, not runtime.

## Contents

- [$state](#state) - Reactive state, deep reactivity
- [$derived](#derived) - Computed values
- [$effect](#effect) - Side effects, cleanup
- [$props](#props) - Component props with TypeScript
- [$bindable](#bindable) - Two-way binding
- [Forms (Valibot + Superforms)](#forms-valibot--superforms) - Form validation
- [Bits UI](#bits-ui) - Headless components
- [Data Loading](#data-loading) - Props from load functions
- [Class State](#class-state) - Runes in classes
- [Shared State](#shared-state) - .svelte.ts modules
- [Mobile-First Fluid Design](#mobile-first-fluid-design) - clamp(), containers
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [Migration from Svelte 4](#migration-from-svelte-4) - Conversion table
- [References](#references) - Detailed guides

| Rune | Purpose |
|------|---------|
| `$state` | Reactive state |
| `$derived` | Computed values |
| `$effect` | Side effects |
| `$props` | Component props |
| `$bindable` | Two-way binding |
| `$inspect` | Debug |

## $state

```svelte
<script lang="ts">
  let count = $state(0);
  let user = $state({ name: '', email: '' });
  let items = $state<string[]>([]);
</script>

<button onclick={() => count++}>Count: {count}</button>
<button onclick={() => items.push('new')}>Add item</button>
<button onclick={() => user.name = 'Ada'}>Set name</button>
```

Objects and arrays are deeply reactive. Mutations trigger updates.

Use `$state.raw()` for large immutable data. Works in class fields.

## $derived

```svelte
<script lang="ts">
  let items = $state<string[]>([]);
  let count = $derived(items.length);
  let isEmpty = $derived(items.length === 0);

  // Complex logic
  let summary = $derived.by(() => {
    if (items.length === 0) return 'No items';
    if (items.length === 1) return '1 item';
    return `${items.length} items`;
  });
</script>
```

**Rule:** Computing from state? Use `$derived`, never `$effect`.

## $effect

```svelte
<script lang="ts">
  let query = $state('');
  let results = $state<string[]>([]);

  $effect(() => {
    console.log('Query changed:', query);

    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(data => { results = data; });

    return () => console.log('Cleanup');
  });
</script>
```

**Use for:** DOM manipulation, subscriptions, event listeners, analytics.

**Don't use for:** Computing values (use `$derived`), synchronizing state.

## $props

```svelte
<script lang="ts">
  interface Props {
    title: string;
    count?: number;
    class?: string;
    onUpdate?: (value: number) => void;
  }

  let { title, count = 0, class: className, onUpdate }: Props = $props();
</script>

<div class={className}>
  <h2>{title}</h2>
  <button onclick={() => onUpdate?.(count + 1)}>Increment</button>
</div>
```

Destructure with defaults. Rename reserved words. Rest props: `let { title, ...rest } = $props()`

## $bindable

```svelte
<!-- TextInput.svelte -->
<script lang="ts">
  let { value = $bindable(''), placeholder }: Props = $props();
</script>
<input bind:value {placeholder} />

<!-- Usage -->
<script lang="ts">
  let message = $state('');
</script>
<TextInput bind:value={message} placeholder="Type" />
```

## Forms (Valibot + Superforms)

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';

  let { data } = $props();

  const { form, errors, enhance, submitting } = superForm(data.form, {
    validators: valibotClient(loginSchema)
  });
</script>

<form method="POST" use:enhance>
  <input name="email" bind:value={$form.email} />
  {#if $errors.email}<span class="error">{$errors.email}</span>{/if}

  <input name="password" type="password" bind:value={$form.password} />
  {#if $errors.password}<span class="error">{$errors.password}</span>{/if}

  <button disabled={$submitting}>Login</button>
</form>
```

## Bits UI

```svelte
<script lang="ts">
  import { Dialog } from 'bits-ui';
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <button {...props}>Open</button>
    {/snippet}
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

## Data Loading

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();
  let search = $state('');

  let filtered = $derived(
    data.users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
  );
</script>

<input bind:value={search} placeholder="Search" />
{#each filtered as user}<div>{user.name}</div>{/each}
```

## Class State

```svelte
<script lang="ts">
  class Counter {
    count = $state(0);
    doubled = $derived(this.count * 2);
    increment = () => { this.count++; };
  }

  let counter = new Counter();
</script>

<button onclick={counter.increment}>
  {counter.count} (doubled: {counter.doubled})
</button>
```

## Shared State

```ts
// $lib/stores/counter.svelte.ts
let count = $state(0);
export function getCount() { return count; }
export function increment() { count++; }
```

```svelte
<script lang="ts">
  import { getCount, increment } from '$lib/stores/counter.svelte';
</script>
<button onclick={increment}>Count: {getCount()}</button>
```

## Mobile-First Fluid Design

```svelte
<style>
  h1 { font-size: clamp(1.75rem, 4vw + 1rem, 3rem); }
  p { font-size: clamp(1rem, 1vw + 0.75rem, 1.125rem); line-height: 1.6; }

  .container { padding: clamp(1rem, 3vw, 2rem); }
  .section { margin-block: clamp(2rem, 5vw, 4rem); }

  /* Container queries */
  .card-container { container-type: inline-size; }
  @container (min-width: 400px) {
    .card { grid-template-columns: 150px 1fr; }
  }
</style>
```

## Anti-Patterns

**Don't use $effect for computed values**
```svelte
<!-- WRONG -->
let count = $state(0);
let doubled = $state(0);
$effect(() => { doubled = count * 2; });

<!-- RIGHT -->
let doubled = $derived(count * 2);
```

**Don't mutate props**
```svelte
<!-- WRONG --> let { count } = $props(); count++;
<!-- RIGHT --> let { count = $bindable() } = $props(); count++;
```

**Don't destructure state**
```svelte
<!-- WRONG --> let user = $state({ name: 'Ada' }); let { name } = user;
<!-- RIGHT --> <p>{user.name}</p>
```

**Track dependencies before await**
```svelte
<!-- WRONG --> $effect(async () => { await fetch(); if (settings.theme) {} });
<!-- RIGHT --> $effect(() => { const theme = settings.theme; fetch().then(...); });
```

## Migration from Svelte 4

| Svelte 4 | Svelte 5 |
|----------|----------|
| `let x = 0` | `let x = $state(0)` |
| `$: doubled = x * 2` | `let doubled = $derived(x * 2)` |
| `$: { console.log(x) }` | `$effect(() => { console.log(x) })` |
| `export let name` | `let { name } = $props()` |
| `<slot />` | `{@render children?.()}` |

## References

- **references/state.md** - Deep reactivity, classes, raw state, snapshots
- **references/derived.md** - Complex derivations, dependency tracking
- **references/effect.md** - Lifecycle, cleanup, pre-effects
- **references/props.md** - Type safety, rest props, bindable
- **references/superforms.md** - Superforms + Valibot
- **references/bits-ui.md** - Component library
