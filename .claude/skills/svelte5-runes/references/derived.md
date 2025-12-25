# $derived

Computed values from state. Lazy and cached.

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  let isPositive = $derived(count > 0);

  // Complex logic with $derived.by()
  let status = $derived.by(() => {
    if (count === 0) return 'zero';
    if (count > 100) return 'large';
    return 'small';
  });
</script>
```

## Dependency Tracking

```svelte
<script lang="ts">
  let a = $state(1);
  let b = $state(2);

  let sum = $derived(a + b);  // Only depends on a and b
  let result = $derived(useA ? a : b);  // Conditional dependencies
</script>
```

Automatic. Only tracks what you read. Conditional tracking.

## Arrays

```svelte
<script lang="ts">
  let users = $state<User[]>([]);
  let searchQuery = $state('');
  let showActiveOnly = $state(false);

  let filtered = $derived.by(() => {
    let result = users;
    if (showActiveOnly) result = result.filter(u => u.active);
    if (searchQuery) result = result.filter(u => u.name.includes(searchQuery));
    return result;
  });

  let sorted = $derived([...filtered].sort((a, b) => a.name.localeCompare(b.name)));
  let activeCount = $derived(users.filter(u => u.active).length);
</script>
```

## Classes

```svelte
<script lang="ts">
  class ShoppingCart {
    items = $state<{ price: number; qty: number }[]>([]);
    subtotal = $derived(this.items.reduce((sum, i) => sum + i.price * i.qty, 0));
    tax = $derived(this.subtotal * 0.1);
    total = $derived(this.subtotal + this.tax);
    isEmpty = $derived(this.items.length === 0);
  }
</script>
```

## Performance

Derived values only compute when dependencies change and the value is read.

```svelte
<script lang="ts">
  let items = $state([]);

  let result = $derived.by(() => {
    console.log('Computing...');  // Only logs when needed
    return items.filter(x => x > 0).reduce((a, b) => a + b, 0);
  });
</script>

{#if showResult}<p>{result}</p>{/if}  <!-- Only computes when shown -->
```

## Pitfalls

**Don't use $effect**
```svelte
<!-- WRONG -->
let doubled = $state(0);
$effect(() => { doubled = count * 2; });

<!-- RIGHT -->
let doubled = $derived(count * 2);
```

**Can't use async**
```svelte
<!-- WRONG --> let user = $derived(await fetch(`/api/users/${userId}`));
<!-- RIGHT --> Use $effect for async, write to $state
```

**Don't mutate**
```svelte
let doubled = $derived(items.map(x => x * 2));
doubled.push(8);  // Won't work
items.push(4);    // Mutate source instead
```
