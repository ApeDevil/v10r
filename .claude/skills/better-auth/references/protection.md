# Route Protection

Patterns for protecting routes and accessing sessions.

## Protection Strategies

| Strategy | When to Use | Pros | Cons |
|----------|-------------|------|------|
| Load function guard | Most routes | Server-side, prevents render | Must add to each route |
| Helper function | Reusable pattern | DRY, consistent | Extra abstraction |
| Layout guard | Grouped routes | Less repetition | Can be bypassed |
| Client guard | SPA fallback | Handles client navigation | Flicker, not secure alone |

## Load Function Guard (Recommended)

```typescript
// src/routes/app/settings/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/auth/login');
  }

  // User is guaranteed to exist here
  return {
    user: locals.user,
  };
};
```

## Reusable Guard Helper

```typescript
// src/lib/server/auth/guard.ts
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export function requireAuth(event: RequestEvent) {
  if (!event.locals.user || !event.locals.session) {
    const returnTo = encodeURIComponent(event.url.pathname);
    redirect(303, `/auth/login?redirect=${returnTo}`);
  }

  return {
    user: event.locals.user,
    session: event.locals.session,
  };
}

// Role-based guard
export function requireRole(event: RequestEvent, role: string) {
  const { user } = requireAuth(event);

  // Assuming role is stored in user profile or metadata
  if (user.role !== role) {
    redirect(303, '/app/dashboard');
  }

  return { user };
}
```

```typescript
// Usage
import { requireAuth, requireRole } from '$lib/server/auth/guard';

export const load: PageServerLoad = async (event) => {
  const { user } = requireAuth(event);
  return { user };
};

// Or for admin routes
export const load: PageServerLoad = async (event) => {
  const { user } = requireRole(event, 'admin');
  return { user };
};
```

## Form Action Protection

```typescript
// src/routes/app/settings/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import type { Actions } from './$types';

export const actions: Actions = {
  updateProfile: async (event) => {
    const { user } = requireAuth(event);

    const data = await event.request.formData();
    // ... update user profile

    return { success: true };
  },

  deleteAccount: async (event) => {
    const { user } = requireAuth(event);

    // ... delete user
    redirect(303, '/');
  },
};
```

## API Route Protection

```typescript
// src/routes/api/items/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    error(401, 'Unauthorized');
  }

  const items = await getItems(locals.user.id);
  return json(items);
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    error(401, 'Unauthorized');
  }

  const data = await request.json();
  const item = await createItem(locals.user.id, data);
  return json(item, { status: 201 });
};
```

## Layout-Level Protection (Caution)

Layouts provide shared protection, but each route should also check:

```typescript
// src/routes/app/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/auth/login');
  }

  // Pass user data to all child routes
  return {
    user: locals.user,
  };
};
```

**Warning:** Layout protection alone is NOT sufficient. Always protect individual routes too, because:
1. Direct URL access bypasses client-side guards
2. API routes under the layout aren't protected by layout load

## Client-Side Guard (Fallback)

For SPA navigation after initial server render:

```svelte
<!-- src/routes/app/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  let { children } = $props();

  const user = $derived(page.data.user);

  $effect(() => {
    if (browser && !user) {
      goto('/auth/login');
    }
  });
</script>

{#if user}
  {@render children()}
{:else}
  <div class="loading">Loading...</div>
{/if}
```

## Session Access in Components

```svelte
<!-- Any component under /app -->
<script lang="ts">
  import { page } from '$app/state';

  // Access user from page data (set by layout)
  const user = $derived(page.data.user);
  const isAdmin = $derived(user?.role === 'admin');
</script>

<nav>
  <span>Welcome, {user?.name}</span>
  {#if isAdmin}
    <a href="/admin">Admin Panel</a>
  {/if}
</nav>
```

## Redirect After Login

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { signIn } from '$lib/auth-client';

  const redirectTo = $derived(
    page.url.searchParams.get('redirect') || '/app/dashboard'
  );

  async function handleSubmit() {
    const result = await signIn.email({ email, password });
    if (!result.error) {
      goto(redirectTo);
    }
  }
</script>
```

## Protecting Prerendered Pages

Static pages can still check auth on the client:

```svelte
<!-- src/routes/pricing/+page.svelte -->
<script lang="ts">
  import { page } from '$app/state';

  const user = $derived(page.data.user);
</script>

<!-- Show different content based on auth state -->
{#if user}
  <p>You're logged in! <a href="/app">Go to dashboard</a></p>
{:else}
  <p>Sign up to get started</p>
  <a href="/auth/register">Create account</a>
{/if}
```

## Ownership Checks

Protect resources by ownership:

```typescript
// src/routes/app/items/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';

export const load: PageServerLoad = async (event) => {
  const { user } = requireAuth(event);

  const item = await getItem(event.params.id);

  if (!item) {
    error(404, 'Item not found');
  }

  if (item.userId !== user.id) {
    error(403, 'Not authorized to view this item');
  }

  return { item };
};
```
