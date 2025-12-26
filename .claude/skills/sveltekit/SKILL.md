---
name: sveltekit
description: SvelteKit 2 patterns for Velociraptor projects. Use when creating routes, load functions, form actions, API endpoints, or configuring rendering modes. Includes $app/state (replaces deprecated stores), shallow routing, remote functions, and Vercel deployment. Essential for any +page, +layout, +server file.
---

# SvelteKit 2

File-based routing framework for Svelte 5. Server-first, progressive enhancement by default.

## Contents

- [Route Files](#route-files) - +page, +layout, +server, +error
- [Load Functions](#load-functions) - Server vs Universal, streaming
- [Form Actions](#form-actions) - POST mutations with enhance
- [$app/state (Replaces $app/stores)](#appstate-replaces-appstores) - Reactive page data
- [$app/navigation](#appnavigation) - goto, invalidate, preloadData
- [Shallow Routing](#shallow-routing) - pushState without navigation
- [Page Options](#page-options) - prerender, ssr, csr
- [API Routes (+server.js)](#api-routes-serverjs) - REST endpoints
- [Hooks](#hooks) - handle, handleFetch
- [SvelteKit 2 Breaking Changes](#sveltekit-2-breaking-changes) - Migration notes
- [Routing Patterns](#routing-patterns) - Dynamic, groups, catch-all
- [Vercel Adapter](#vercel-adapter) - Deployment config
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Detailed guides

| Concept | Purpose |
|---------|---------|
| Load functions | Fetch data before rendering |
| Form actions | Handle POST mutations |
| Hooks | Intercept requests/responses |
| $app/state | Reactive page data (NEW) |
| Shallow routing | History without navigation |

## Route Files

All route files use `+` prefix:

| File | Runs Where | Purpose |
|------|------------|---------|
| `+page.svelte` | Client + Server | Page component |
| `+page.js` | Client + Server | Universal load |
| `+page.server.js` | Server only | Server load, form actions |
| `+layout.svelte` | Client + Server | Layout wrapper |
| `+layout.server.js` | Server only | Layout data |
| `+server.js` | Server only | API endpoint |
| `+error.svelte` | Client + Server | Error boundary |

## Load Functions

### Server Load (+page.server.js)
```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
  const user = await db.users.findUnique({ where: { id: params.id } });
  return { user };
};
```

Use for: database access, private env vars, cookies, auth.

### Universal Load (+page.js)
```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, data }) => {
  // data = return value from +page.server.js
  const posts = await fetch('/api/posts').then(r => r.json());
  return { ...data, posts };
};
```

Use for: public APIs, non-serializable values (classes, components).

### Streaming
```typescript
export const load: PageServerLoad = async () => {
  return {
    instant: 'Available now',
    slow: fetchSlowData() // Promise streams when resolved
  };
};
```

```svelte
{#await data.slow}
  <p>Loading...</p>
{:then value}
  <p>{value}</p>
{/await}
```

**Constraint:** Streaming only works on platforms that support it (not Lambda/Firebase).

## Form Actions

```typescript
// +page.server.js
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    if (!email) {
      return fail(400, { email, missing: true });
    }

    await db.users.create({ data: { email } });
    redirect(303, '/success'); // No throw needed in v2
  },

  delete: async ({ params }) => {
    await db.users.delete({ where: { id: params.id } });
    return { deleted: true };
  }
};
```

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="email" value={form?.email ?? ''} />
  {#if form?.missing}<span class="error">Required</span>{/if}
  <button>Submit</button>
</form>

<form method="POST" action="?/delete" use:enhance>
  <button>Delete</button>
</form>
```

## $app/state (Replaces $app/stores)

```svelte
<script lang="ts">
  import { page } from '$app/state';

  // Fine-grained reactivity - no $ prefix
  const userId = $derived(page.params.id);
  const isAdmin = $derived(page.data.user?.role === 'admin');
</script>

<p>Current route: {page.route.id}</p>
<p>URL: {page.url.pathname}</p>
```

**Properties:**
- `page.data` - Load function return value
- `page.params` - Route parameters
- `page.url` - Current URL object
- `page.route` - Route info
- `page.status` - HTTP status
- `page.error` - Error object (on error pages)
- `page.form` - Form action return value
- `page.state` - Shallow routing state

**Migration:** Run `npx sv migrate app-state`

## $app/navigation

```typescript
import {
  goto,
  invalidate,
  invalidateAll,
  preloadData,
  pushState,
  replaceState
} from '$app/navigation';

// Navigate
await goto('/dashboard');
await goto('/login', { replaceState: true });

// Invalidate load functions
await invalidate('/api/users');     // By URL dependency
await invalidate('app:user');       // By custom identifier
await invalidateAll();              // All load functions

// Preload
const result = await preloadData('/photos/123');

// Shallow routing (no navigation)
pushState('/photos/123', { photoId: 123, modal: true });
replaceState('', { updated: true });
```

## Shallow Routing

Create history entries without full navigation:

```svelte
<script lang="ts">
  import { pushState, preloadData } from '$app/navigation';
  import { page } from '$app/state';

  async function openModal(id: string) {
    const result = await preloadData(`/items/${id}`);
    if (result.type === 'loaded') {
      pushState(`/items/${id}`, {
        itemData: result.data,
        showModal: true
      });
    }
  }
</script>

{#if page.state.showModal}
  <Modal data={page.state.itemData} onclose={() => history.back()} />
{/if}
```

**Type safety:**
```typescript
// src/app.d.ts
declare namespace App {
  interface PageState {
    showModal?: boolean;
    itemData?: { id: string; name: string };
  }
}
```

## Page Options

```typescript
// +page.js or +page.server.js
export const prerender = true;      // Static generation
export const ssr = true;            // Server-side render (default)
export const csr = true;            // Client-side hydration (default)
export const trailingSlash = 'never'; // URL normalization
```

| Option | Values | Effect |
|--------|--------|--------|
| `prerender` | `true/false/'auto'` | Build-time static HTML |
| `ssr` | `true/false` | Server-render or empty shell |
| `csr` | `true/false` | Ship JS or pure HTML |
| `trailingSlash` | `'never'/'always'/'ignore'` | URL format |

## API Routes (+server.js)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, params }) => {
  const items = await db.items.findMany();
  return json(items);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const item = await db.items.create({ data });
  return json(item, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params }) => {
  await db.items.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
};
```

## Hooks

```typescript
// src/hooks.server.ts
import type { Handle, HandleFetch } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Before routing
  const session = event.cookies.get('session');
  event.locals.user = session ? await getUser(session) : null;

  const response = await resolve(event);

  // After response
  response.headers.set('x-custom', 'value');
  return response;
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Rewrite internal API calls during SSR
  if (request.url.startsWith('https://api.example.com')) {
    request = new Request(
      request.url.replace('https://api.example.com', 'http://localhost:3000'),
      request
    );
  }
  return fetch(request);
};
```

## SvelteKit 2 Breaking Changes

| Change | Before (v1) | After (v2) |
|--------|-------------|------------|
| error/redirect | `throw error(404)` | `error(404)` |
| Cookie path | Optional | Required: `path: '/'` |
| Top-level promises | Auto-awaited | Must await explicitly |
| goto external | Supported | Use `window.location` |
| $app/stores | Current | Deprecated, use $app/state |

## Routing Patterns

```
src/routes/
  +page.svelte              → /
  about/+page.svelte        → /about
  blog/[slug]/+page.svelte  → /blog/:slug
  [...rest]/+page.svelte    → /*rest (catch-all)
  [[lang]]/+page.svelte     → /:lang? (optional)

  (marketing)/              → Route group (no URL effect)
    pricing/+page.svelte    → /pricing

  admin/
    +page@.svelte           → Reset to root layout
```

## Vercel Adapter

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter({
      runtime: 'nodejs22.x',  // or 'edge'
      regions: ['iad1'],
      split: true,            // Separate functions per route
      isr: {
        expiration: 60        // ISR cache seconds
      }
    })
  }
};
```

## Anti-Patterns

**Don't fetch in components:**
```svelte
<!-- WRONG -->
<script>
  import { onMount } from 'svelte';
  let data = $state([]);
  onMount(async () => {
    data = await fetch('/api/items').then(r => r.json());
  });
</script>

<!-- RIGHT: Use load function -->
```

**Don't use deprecated stores:**
```svelte
<!-- WRONG -->
import { page } from '$app/stores';
$page.data

<!-- RIGHT -->
import { page } from '$app/state';
page.data
```

**Don't throw error/redirect in v2:**
```typescript
// WRONG
throw redirect(303, '/login');

// RIGHT
redirect(303, '/login');
```

## References

- **references/load-functions.md** - Universal vs server, streaming, dependencies
- **references/form-actions.md** - Progressive enhancement, validation, file uploads
- **references/hooks.md** - Server hooks, client hooks, handleFetch
- **references/routing.md** - Groups, optional params, layout resets
- **references/remote-functions.md** - Experimental RPC-style server calls
- **references/shallow-routing.md** - pushState, replaceState, page.state
