# SvelteKit CSRF Protection

## How Built-in Protection Works

SvelteKit validates the `Origin` header against the request URL:
1. Only in **production** (not during `vite dev`)
2. Only for `POST`, `PUT`, `PATCH`, `DELETE` requests
3. Only for "simple" content types that browsers send cross-origin:
   - `application/x-www-form-urlencoded`
   - `multipart/form-data`
   - `text/plain`

## The JSON API Gap

**Problem:** `application/json` requests are NOT covered by default CSRF protection because browsers don't send JSON cross-origin without CORS preflight.

**However:** If you configure permissive CORS, JSON endpoints become vulnerable.

### Protection Pattern

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const csrfProtection: Handle = async ({ event, resolve }) => {
  const method = event.request.method;
  const contentType = event.request.headers.get('content-type') || '';

  // Protect JSON mutations
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (contentType.includes('application/json')) {
      // Require custom header (simple requests can't set custom headers)
      const csrfToken = event.request.headers.get('x-requested-with');
      if (!csrfToken) {
        error(403, 'Missing CSRF protection header');
      }
    }
  }

  return resolve(event);
};

export const handle = sequence(csrfProtection, /* other handlers */);
```

### Client Wrapper

```typescript
// src/lib/api.ts
export async function api<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch', // CSRF protection
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

## CVE History

### CVE-2023-29003 (Fixed in 1.15.1)

**Vulnerability:** CSRF bypass via:
1. Uppercase `Content-Type` header (e.g., `TEXT/PLAIN`)
2. Using `text/plain` content type which wasn't properly validated

**Fix:** Case-insensitive content type checking.

**Action:** Ensure SvelteKit >= 1.15.1 (SvelteKit 2.x is safe).

## Configuration

```javascript
// svelte.config.js
export default {
  kit: {
    csrf: {
      // Enable origin checking (default: true)
      checkOrigin: true,

      // Add trusted external origins (e.g., payment callbacks)
      trustedOrigins: [
        'https://payments.stripe.com',
      ],
    },
  },
};
```

**Warning:** Never use `trustedOrigins: ['*']` in production.

## Form Actions (Automatic Protection)

Form actions in `+page.server.ts` are automatically protected:

```typescript
// src/routes/contact/+page.server.ts
export const actions = {
  default: async ({ request }) => {
    // CSRF protection automatic for form submissions
    const data = await request.formData();
    // ...
  },
};
```

## Testing CSRF Protection

```typescript
// tests/csrf.test.ts
import { expect, test } from '@playwright/test';

test('blocks cross-origin JSON POST without header', async ({ request }) => {
  const response = await request.post('/api/data', {
    headers: {
      'Content-Type': 'application/json',
      // Deliberately omit X-Requested-With
    },
    data: { key: 'value' },
  });

  expect(response.status()).toBe(403);
});
```

## SameSite Cookie Interaction

SvelteKit sets `SameSite=Lax` by default for cookies, which provides additional CSRF protection:
- Cookies NOT sent on cross-origin POST requests
- Cookies ARE sent on top-level GET navigations

```typescript
cookies.set('session', token, {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax', // Default, provides CSRF protection
});
```

**Note:** `SameSite=Strict` breaks OAuth flows (redirects from OAuth provider won't include cookies).
