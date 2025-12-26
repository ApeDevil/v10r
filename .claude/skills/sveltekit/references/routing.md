# Routing

File-based routing in `src/routes/`.

## Contents

- [Basic Routes](#basic-routes) - File structure to URLs
- [Dynamic Parameters](#dynamic-parameters) - [slug], [...path], [[optional]]
- [Route Groups](#route-groups) - (marketing), (app) for shared layouts
- [Layout Hierarchy](#layout-hierarchy) - Nested layouts
- [Breaking Out of Layouts](#breaking-out-of-layouts) - @reset syntax
- [Layouts](#layouts) - +layout.svelte, layout data
- [Error Pages](#error-pages) - +error.svelte inheritance
- [API Routes](#api-routes) - +server.ts for REST endpoints
- [Parameter Validation](#parameter-validation) - Custom matchers
- [Route Priority](#route-priority) - Literal > dynamic > rest
- [Prerendering Dynamic Routes](#prerendering-dynamic-routes) - entries()
- [Redirects](#redirects) - Load, hooks, config

## Basic Routes

```
src/routes/
  +page.svelte              → /
  about/+page.svelte        → /about
  blog/+page.svelte         → /blog
  blog/first-post/+page.svelte → /blog/first-post
```

## Dynamic Parameters

### Single Parameter
```
src/routes/blog/[slug]/+page.svelte → /blog/:slug
```

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const post = await db.posts.findUnique({ where: { slug: params.slug } });
  if (!post) error(404, 'Post not found');
  return { post };
};
```

### Multiple Parameters
```
src/routes/[category]/[id]/+page.svelte → /:category/:id
```

### Rest Parameters
```
src/routes/docs/[...path]/+page.svelte → /docs/*path
```

```typescript
// params.path = 'getting-started/installation'
// for URL: /docs/getting-started/installation
```

### Optional Parameters
```
src/routes/[[lang]]/about/+page.svelte
  → /about
  → /en/about
  → /fr/about
```

## Route Groups

Organize routes without affecting URLs:

```
src/routes/
  (marketing)/
    +layout.svelte          ← Marketing layout
    about/+page.svelte      → /about
    pricing/+page.svelte    → /pricing
    contact/+page.svelte    → /contact

  (app)/
    +layout.svelte          ← App layout
    dashboard/+page.svelte  → /dashboard
    settings/+page.svelte   → /settings
```

Groups share layouts but don't add URL segments.

## Layout Hierarchy

```
src/routes/
  +layout.svelte            ← Root layout (all pages)
  dashboard/
    +layout.svelte          ← Dashboard layout (nested)
    +page.svelte            ← Uses both layouts
    settings/
      +page.svelte          ← Uses both layouts
```

### Breaking Out of Layouts

Use `@` to reset to specific parent:

```
src/routes/
  +layout.svelte                    ← root
  dashboard/
    +layout.svelte                  ← dashboard
    +page.svelte                    ← Uses root + dashboard
    +page@.svelte                   ← Uses only root (reset)
    settings/
      +layout.svelte                ← settings
      +page.svelte                  ← Uses all three
      +page@dashboard.svelte        ← Uses root + dashboard (skip settings)
```

## Layouts

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
</script>

<nav>
  <a href="/" class:active={page.url.pathname === '/'}>Home</a>
  <a href="/about" class:active={page.url.pathname === '/about'}>About</a>
</nav>

<main>
  {@render children()}
</main>

<footer>Footer content</footer>
```

### Layout Data

```typescript
// +layout.server.ts
export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    notifications: await getNotifications(locals.user?.id)
  };
};
```

Data is available to all child pages:

```svelte
<!-- Any child +page.svelte -->
<script lang="ts">
  let { data } = $props();
  // data.user and data.notifications available
</script>
```

## Error Pages

```svelte
<!-- +error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p>{page.error?.message}</p>

{#if page.status === 404}
  <a href="/">Go home</a>
{/if}
```

Error pages are inherited. Create at different levels:

```
src/routes/
  +error.svelte             ← Default for all
  admin/
    +error.svelte           ← Admin-specific errors
```

## API Routes

```
src/routes/
  api/
    users/+server.ts        → GET/POST /api/users
    users/[id]/+server.ts   → GET/PUT/DELETE /api/users/:id
```

Can coexist with pages - SvelteKit routes based on Accept header.

## Parameter Validation

```typescript
// src/params/integer.ts
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => {
  return /^\d+$/.test(param);
};
```

```
src/routes/items/[id=integer]/+page.svelte
```

Only matches numeric IDs. Non-matches fall through to next route.

## Route Priority

More specific routes take precedence:

1. `/blog/new` (literal)
2. `/blog/[slug]` (dynamic)
3. `/blog/[...rest]` (rest)

## Prerendering Dynamic Routes

```typescript
// +page.server.ts
export async function entries() {
  const posts = await db.posts.findMany();
  return posts.map(post => ({ slug: post.slug }));
}

export const prerender = true;
```

## Parallel Routes

Handle multiple independent sections:

```
src/routes/
  dashboard/
    +page.svelte
    @sidebar/
      +page.svelte          ← Rendered in named slot
    @main/
      +page.svelte          ← Rendered in named slot
```

## Redirects

In load function:
```typescript
export const load: PageServerLoad = async ({ params }) => {
  if (params.old) {
    redirect(301, `/new/${params.old}`);
  }
};
```

In hooks:
```typescript
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === '/old-path') {
    redirect(301, '/new-path');
  }
  return resolve(event);
};
```

In config (static redirects):
```javascript
// svelte.config.js
export default {
  kit: {
    prerender: {
      handleHttpError: ({ path, referrer }) => {
        if (path === '/old') {
          return { redirect: '/new' };
        }
      }
    }
  }
};
```
