# Security Headers

## SvelteKit CSP Configuration

### Basic Setup

```javascript
// svelte.config.js
export default {
  kit: {
    csp: {
      mode: 'auto', // 'hash' for prerendered, 'nonce' for SSR
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
};
```

### Why unsafe-inline for styles

Svelte transitions create inline `<style>` elements dynamically. Without `unsafe-inline`, all animations break.

**Alternatives:**
1. Use CSS animations instead of Svelte transitions
2. Pre-compile all transition styles
3. Accept `unsafe-inline` as necessary trade-off

### Using Nonces

```html
<!-- src/app.html -->
<!DOCTYPE html>
<html>
<head>
  <script nonce="%sveltekit.nonce%">
    // Inline script with nonce
  </script>
  %sveltekit.head%
</head>
<body>
  %sveltekit.body%
</body>
</html>
```

### Report-Only Mode (Testing)

```javascript
// svelte.config.js
export default {
  kit: {
    csp: {
      mode: 'auto',
      reportOnly: {
        'default-src': ['self'],
        'report-uri': ['/api/csp-report'],
      },
    },
  },
};
```

### CSP Report Endpoint

```typescript
// src/routes/api/csp-report/+server.ts
export async function POST({ request }) {
  const report = await request.json();
  console.error('CSP Violation:', JSON.stringify(report, null, 2));
  return new Response(null, { status: 204 });
}
```

## Additional Security Headers

### Via hooks.server.ts

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // HSTS (only in production)
  if (event.url.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
};
```

### Via vercel.json

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

## CORS Configuration

### Restrictive (Recommended)

```typescript
// src/routes/api/[...path]/+server.ts
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://yourapp.com',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

### If You Need Multiple Origins

```typescript
const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
];

export async function OPTIONS({ request }) {
  const origin = request.headers.get('origin');

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      // ...other headers
    },
  });
}
```

### CORS + Credentials Warning

If you set `Access-Control-Allow-Credentials: true`:
- Cannot use `Access-Control-Allow-Origin: *`
- Must specify exact origin
- Cookies will be sent cross-origin (CSRF risk)

## Header Security Checklist

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Restrictive directives | XSS prevention |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `X-Frame-Options` | `DENY` | Clickjacking prevention |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | Restrict unused APIs | Feature restriction |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS enforcement |

## Prerendered Pages Limitation

For prerendered pages, CSP is set via `<meta>` tag, which does NOT support:
- `frame-ancestors` (use X-Frame-Options instead)
- `report-uri` / `report-to`
- `sandbox`

```html
<!-- Generated for prerendered pages -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; ...">
```
