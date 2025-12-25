# $state

Objects and arrays are deeply reactive proxies.

```svelte
<script lang="ts">
  let user = $state({ name: 'Ada', address: { city: 'London' } });
  let items = $state(['a', 'b']);
</script>

<button onclick={() => user.address.city = 'Paris'}>Move</button>
<button onclick={() => items.push('c')}>Add</button>
```

Proxy-based. Mutations trigger updates. Granular re-renders.

## $state.raw()

```svelte
<script lang="ts">
  let config = $state.raw({ apiUrl: 'https://api.example.com', timeout: 5000 });

  // Must reassign to trigger updates
  config = { ...config, timeout: 10000 };  // Works
  // config.timeout = 10000;  // Won't trigger updates
</script>
```

For large immutable data. Only reassignment triggers updates.

## $state.snapshot()

```svelte
<script lang="ts">
  let user = $state({ name: 'Ada', scores: [1, 2, 3] });

  function sendToAPI() {
    fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify($state.snapshot(user))
    });
  }
</script>
```

Extracts plain, non-reactive copy. Safe for JSON.stringify and logging.

## Classes

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

## Module-Level State

```ts
// $lib/stores/auth.svelte.ts
let currentUser = $state<User | null>(null);

export function getUser() { return currentUser; }
export function isLoggedIn() { return currentUser !== null; }
export async function login(email: string, password: string) {
  const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  currentUser = await res.json();
}
export function logout() { currentUser = null; }
```

```svelte
<script lang="ts">
  import { getUser, isLoggedIn, logout } from '$lib/stores/auth.svelte';
</script>

{#if isLoggedIn()}
  <p>Welcome, {getUser()?.name}</p>
  <button onclick={logout}>Logout</button>
{/if}
```

## Gotchas

```svelte
<!-- WRONG --> let { name } = user;
<!-- RIGHT --> <p>{user.name}</p>
```

**Reassignment vs mutation**
```svelte
items.push('c');           // Works with $state
items = [...items, 'd'];   // Also works

rawItems.push('c');              // NO update with $state.raw()
rawItems = [...rawItems, 'd'];   // Updates
```

**Proxy identity**
```svelte
let proxied = $state(original);
console.log(proxied === original); // false
console.log($state.snapshot(proxied).id === original.id); // true
```
