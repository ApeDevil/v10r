# Load Functions

## Universal vs Server

### Server Load (+page.server.js)
- Runs only on server
- Access to `cookies`, `locals`, `platform`, `clientAddress`
- Must return serializable data (JSON + Date, Map, Set, BigInt, RegExp)
- Required for database access, private env vars

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
  // Auth check
  if (!locals.user) {
    redirect(303, '/login');
  }

  const item = await db.items.findUnique({
    where: { id: params.id }
  });

  if (!item) {
    error(404, 'Item not found');
  }

  return { item, user: locals.user };
};
```

### Universal Load (+page.js)
- Runs on both client and server
- Can return any value (classes, functions, components)
- Gets `data` property from server load if both exist
- Use for public APIs, client-side enrichment

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, data, depends }) => {
  // Register dependency for invalidation
  depends('app:items');

  // data = return value from +page.server.js
  const enriched = await fetch('/api/enrich', {
    method: 'POST',
    body: JSON.stringify(data.item)
  }).then(r => r.json());

  return {
    ...data,
    enriched,
    // Can return non-serializable values
    formatter: new Intl.DateTimeFormat('en-US')
  };
};
```

## Combining Both

When both exist, server runs first:

```typescript
// +page.server.js
export const load: PageServerLoad = async ({ params }) => {
  return { secret: await getSecret(params.id) };
};

// +page.js
export const load: PageLoad = async ({ data }) => {
  // data.secret is available
  return {
    ...data,
    clientOnly: computeClientThing()
  };
};
```

**Note:** Data is NOT merged automatically. You must spread `data` to include it.

## Streaming

Return promises to stream data as it resolves:

```typescript
export const load: PageServerLoad = async () => {
  return {
    // Available immediately
    title: 'Dashboard',

    // Streams when resolved
    stats: fetchStats(),           // Top-level promise
    nested: {
      slowData: fetchSlowData()    // Nested promise
    }
  };
};
```

### In Component

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<h1>{data.title}</h1>

{#await data.stats}
  <Skeleton />
{:then stats}
  <StatsDisplay {stats} />
{:catch error}
  <ErrorMessage {error} />
{/await}
```

### Platform Support

Streaming works on:
- Node.js servers
- Vercel Edge Runtime
- Cloudflare Workers
- Deno Deploy

Does NOT work on:
- AWS Lambda
- Firebase Functions
- Vercel Serverless (non-edge)

### Constraints

- Cannot change headers/status after streaming starts
- Cannot throw redirects inside streamed promise
- Only works when JavaScript is enabled
- Initial HTML won't contain resolved values

## Dependencies

### Using depends()

```typescript
export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:user');
  depends('app:notifications');

  const [user, notifications] = await Promise.all([
    fetch('/api/user').then(r => r.json()),
    fetch('/api/notifications').then(r => r.json())
  ]);

  return { user, notifications };
};
```

### Invalidating

```typescript
import { invalidate, invalidateAll } from '$app/navigation';

// Invalidate specific dependency
await invalidate('app:user');

// Invalidate by URL
await invalidate('/api/notifications');

// Invalidate everything
await invalidateAll();
```

### Custom Identifiers

Must match pattern `[a-z]+:`:
- `app:user`
- `data:posts`
- `cache:items`

## Parent Data

Access parent layout's load data:

```typescript
// routes/dashboard/+layout.js
export const load = async () => {
  return { layoutData: 'from layout' };
};

// routes/dashboard/settings/+page.js
export const load: PageLoad = async ({ parent }) => {
  const { layoutData } = await parent();
  return { layoutData, pageData: 'from page' };
};
```

**Warning:** Calling `parent()` adds implicit dependency. If parent re-runs, child re-runs.

## SvelteKit 2 Changes

### Top-level Promises

**v1 behavior:** Top-level promises auto-awaited
**v2 behavior:** Must explicitly await

```typescript
// v1 - worked
export const load = async () => {
  return {
    data: fetchData() // auto-awaited
  };
};

// v2 - must await or use for streaming
export const load = async () => {
  return {
    data: await fetchData()  // explicit await
    // OR
    data: fetchData()        // intentional streaming
  };
};
```

### Error and Redirect

```typescript
// v1
throw error(404, 'Not found');
throw redirect(303, '/login');

// v2 - just call, no throw
error(404, 'Not found');
redirect(303, '/login');
```
