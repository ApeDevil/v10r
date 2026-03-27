# Error Handling

SvelteKit error handling patterns for pages, forms, and API routes.

## Error Types

| Type | Cause | Handling |
|------|-------|----------|
| **Expected** | Validation, auth, not found | `error()` helper |
| **Unexpected** | Bugs, crashes, DB failures | `handleError` hook |
| **Form** | Action validation failures | `fail()` helper |
| **API** | Endpoint errors | `json()` with status |

---

## Expected Errors

Use the `error()` helper for controlled errors:

```typescript
// src/routes/items/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

export async function load({ params, locals }) {
  if (!locals.user) {
    error(401, { message: 'Authentication required' });
  }

  // Include ownership in query to prevent IDOR enumeration
  const item = await db.query.items.findFirst({
    where: and(
      eq(items.id, params.id),
      eq(items.userId, locals.user.id)
    )
  });

  // Return 404 for both "not found" and "not authorized"
  // This prevents attackers from enumerating valid item IDs
  if (!item) {
    error(404, { message: 'Item not found' });
  }

  return { item };
}
```

> **Security Note:** For user-owned resources, always return 404 for both missing and unauthorized access. Returning 403 reveals that the resource exists, enabling ID enumeration attacks (IDOR). See [OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).

### Error Responses

| Status | Use For |
|--------|---------|
| 400 | Bad request, invalid input |
| 401 | Not authenticated |
| 403 | Not authorized (use for shared resources with explicit permissions) |
| 404 | Resource not found OR not authorized (for user-owned resources) |
| 409 | Conflict (duplicate, etc.) |
| 422 | Validation failed |
| 429 | Rate limited |

**When to use 403 vs 404:**
- **User-owned resources** (items, invoices, drafts): Return 404 for both missing and unauthorized
- **Shared resources** (team docs, org settings): Return 403 when user lacks explicit permission

---

## Error Pages

### Global Error Page

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-container">
  <h1>{page.status}</h1>
  <p>{page.error?.message}</p>

  {#if page.error?.errorId}
    <p class="error-id">Error ID: {page.error.errorId}</p>
  {/if}

  <a href="/">Go home</a>
</div>
```

### Layout-Specific Error Pages

```svelte
<!-- src/routes/app/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="app-error">
  <h2>Something went wrong</h2>
  <p>{page.error?.message}</p>
  <a href="/app/dashboard">Back to dashboard</a>
</div>
```

### Custom Error Data

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Error {
      message: string;
      errorId?: string;
      code?: string;
    }
  }
}
```

```typescript
// Usage in load function
error(400, {
  message: 'Invalid email format',
  code: 'INVALID_EMAIL'
});
```

---

## Handle Error Hook

Catch unexpected errors globally:

```typescript
// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';

export const handleError: HandleServerError = async ({
  error,
  event,
  status,
  message
}) => {
  const errorId = crypto.randomUUID();

  // Log structured error
  console.error({
    errorId,
    status,
    message,
    path: event.url.pathname,
    method: event.request.method,
    userId: event.locals.user?.id,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error
  });

  // Report to Sentry (production)
  if (import.meta.env.PROD) {
    Sentry.captureException(error, {
      extra: { errorId, path: event.url.pathname }
    });
  }

  // Return safe error to client
  return {
    message: status === 500 ? 'Internal Server Error' : message,
    errorId
  };
};
```

---

## Form Errors

Use `fail()` in form actions for validation errors:

```typescript
// src/routes/items/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';

const schema = v.object({
  title: v.pipe(v.string(), v.minLength(1, 'Title is required')),
  description: v.optional(v.string())
});

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: 'Not authenticated' });
    }

    const form = await superValidate(request, valibot(schema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      await db.insert(items).values({
        id: createId.item(),
        userId: locals.user.id,
        title: form.data.title,
        description: form.data.description
      });
    } catch (e) {
      // Database error (e.g., unique constraint)
      return fail(500, {
        form,
        message: 'Failed to create item'
      });
    }

    redirect(303, '/app/items');
  }
};
```

### Displaying Form Errors

```svelte
<!-- src/routes/items/new/+page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();
  const { form, errors, message, enhance } = superForm(data.form);
</script>

{#if $message}
  <div class="error-banner">{$message}</div>
{/if}

<form method="POST" use:enhance>
  <label>
    Title
    <input name="title" bind:value={$form.title} />
    {#if $errors.title}
      <span class="field-error">{$errors.title}</span>
    {/if}
  </label>

  <button type="submit">Create</button>
</form>
```

---

## API Route Errors

### JSON Error Responses

```typescript
// src/routes/api/items/+server.ts
import { json, error } from '@sveltejs/kit';

export async function GET({ locals, url }) {
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  try {
    const items = await db.query.items.findMany({
      where: eq(items.userId, locals.user.id)
    });
    return json({ items });
  } catch (e) {
    console.error('Failed to fetch items:', e);
    error(500, { message: 'Failed to fetch items' });
  }
}

export async function POST({ request, locals }) {
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    error(400, { message: 'Invalid JSON' });
  }

  const result = v.safeParse(createItemSchema, body);
  if (!result.success) {
    return json({
      error: 'Validation failed',
      issues: result.issues
    }, { status: 422 });
  }

  try {
    const item = await db.insert(items).values({
      id: createId.item(),
      userId: locals.user.id,
      ...result.output
    }).returning();

    return json({ item: item[0] }, { status: 201 });
  } catch (e) {
    console.error('Failed to create item:', e);
    error(500, { message: 'Failed to create item' });
  }
}
```

### Consistent API Error Format

```typescript
// src/lib/server/api-error.ts
import { json } from '@sveltejs/kit';

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return json({
    error: {
      code,
      message,
      ...(details && { details })
    }
  }, { status });
}

// Usage
export async function POST({ request }) {
  // ...
  return apiError(422, 'VALIDATION_FAILED', 'Invalid input', {
    fields: { email: 'Invalid email format' }
  });
}
```

---

## Database Errors

### Drizzle Error Handling

Handle database errors inline in load functions and form actions. Map PG error codes to user-friendly messages at the route level, not in a shared utility.

```typescript
// In +page.server.ts form action
try {
  await db.insert(items).values(data);
} catch (e) {
  const msg = e instanceof Error ? e.message : 'Database error';
  if (msg.includes('23505')) return fail(409, { error: 'Resource already exists' });
  if (msg.includes('23503')) return fail(400, { error: 'Referenced resource not found' });
  return fail(500, { error: 'Database error' });
}
```

### Transaction Rollback

```typescript
// src/lib/server/db/index.ts
import { db } from './client';

export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    try {
      return await fn(tx);
    } catch (error) {
      console.error('Transaction failed, rolling back:', error);
      throw error;
    }
  });
}
```

---

## File Upload Errors

```typescript
// src/routes/api/upload/+server.ts
import { error, json } from '@sveltejs/kit';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST({ request, locals }) {
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    error(400, { message: 'No file provided' });
  }

  if (file.size > MAX_SIZE) {
    error(413, { message: 'File too large. Max size is 5MB' });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    error(415, { message: 'Invalid file type. Allowed: JPEG, PNG, WebP' });
  }

  try {
    const result = await uploadToR2(file);
    return json({ url: result.url }, { status: 201 });
  } catch (e) {
    console.error('Upload failed:', e);
    error(500, { message: 'Upload failed. Please try again.' });
  }
}
```

---

## Client-Side Error Handling

### Fetch Errors

```typescript
// src/lib/api.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Request failed'
    );
  }

  return response.json();
}
```

### Using in Components

```svelte
<script lang="ts">
  import { apiFetch, ApiError } from '$lib/api';

  let error = $state<string | null>(null);
  let loading = $state(false);

  async function createItem() {
    loading = true;
    error = null;

    try {
      const item = await apiFetch('/api/items', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Item' })
      });
      // Success handling
    } catch (e) {
      if (e instanceof ApiError) {
        error = e.message;
      } else {
        error = 'Something went wrong';
      }
    } finally {
      loading = false;
    }
  }
</script>

{#if error}
  <div class="error">{error}</div>
{/if}
```

---

## Error Boundaries (Future)

Svelte 5 introduces error boundaries with `<svelte:boundary>`:

```svelte
<svelte:boundary onerror={(e) => console.error(e)}>
  <ComponentThatMightError />

  {#snippet failed(error)}
    <p>Error: {error.message}</p>
  {/snippet}
</svelte:boundary>
```

---

## AI Error Handling

AI requests have unique failure modes. Handle them gracefully.

### AI Error Types

| Error | Cause | User Message |
|-------|-------|--------------|
| `401` | Invalid API key | "AI service unavailable" |
| `429` | Rate limited | "Too many requests. Try again shortly." |
| `500` | Provider outage | "AI service temporarily unavailable" |
| `timeout` | Slow response | "Response taking too long. Try again." |
| `stream_error` | Connection dropped | "Connection lost. Please retry." |

### AI API Error Handling

```typescript
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { APIError } from '@ai-sdk/provider';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages } = await request.json();
    const result = streamText({ model, messages, system });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Provider-specific errors
    if (error instanceof APIError) {
      console.error('AI API error:', {
        status: error.status,
        message: error.message,
        provider: 'groq',  // or 'mistral', 'together'
      });

      if (error.status === 429) {
        return json(
          { error: 'Too many requests. Please try again shortly.' },
          { status: 429 }
        );
      }

      if (error.status === 401 || error.status === 403) {
        return json(
          { error: 'AI service configuration error' },
          { status: 503 }
        );
      }
    }

    // Generic fallback
    console.error('Chat error:', error);
    return json(
      { error: 'Failed to get AI response. Please try again.' },
      { status: 500 }
    );
  }
};
```

### Client-Side Streaming Errors

```svelte
<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';

  const chat = new Chat({
    api: '/api/chat',
    onError: (error) => {
      // Show user-friendly message
      if (error.message.includes('429')) {
        toast.error('Too many requests. Please wait a moment.');
      } else {
        toast.error('Failed to get response. Please try again.');
      }
    },
  });
</script>
```

### Retry Pattern for AI

```typescript
// src/lib/utils/ai-retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options = { maxRetries: 3, delayMs: 1000 }
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry auth errors
      if (error instanceof APIError && error.status === 401) {
        throw error;
      }

      // Exponential backoff for rate limits
      if (error instanceof APIError && error.status === 429) {
        await new Promise(r => setTimeout(r, options.delayMs * Math.pow(2, i)));
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}
```

---

## Testing Errors

```typescript
// src/routes/items/[id]/+page.server.test.ts
import { describe, it, expect } from 'vitest';

describe('Item page', () => {
  it('returns 404 for non-existent item', async () => {
    const response = await fetch('/items/nonexistent');
    expect(response.status).toBe(404);
  });

  it('returns 404 for unauthorized access (IDOR prevention)', async () => {
    // Create item as user A, try to access as user B
    // Returns 404 (not 403) to prevent ID enumeration
    const response = await fetch('/items/other-user-item', {
      headers: { cookie: userBCookie }
    });
    expect(response.status).toBe(404);
  });
});
```

---

## Summary

| Layer | Pattern |
|-------|---------|
| Load functions | `error(status, { message })` |
| Form actions | `fail(status, { form, message })` |
| API routes | `error()` or `json({ error }, { status })` |
| Global handler | `handleError` hook |
| Client fetch | Custom `ApiError` class |
| Database | Catch and translate `PostgresError` |

---

## Related

- [middleware.md](./middleware.md) - `handleError` hook integration
- [api.md](./api.md) - API validation and error responses
- [auth.md](./auth.md) - Authentication error handling
- [ai/README.md](./ai/README.md) - AI assistant implementation
