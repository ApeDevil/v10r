# SvelteKit

SvelteKit implementation of [architectural patterns](../../foundation/architecture.md).

---

## Why SvelteKit

| Principle | How SvelteKit delivers |
|-----------|------------------------|
| Lightweight | Minimal runtime, compiles away framework |
| Speed | Fast builds (Vite), fast runtime |
| Svelte-native | It *is* Svelte |
| No code generation | File-based routing, automatic types |

---

## Project Structure

```
src/
├── lib/                        # Reusable code ($lib alias)
│   ├── components/             # Shared UI components
│   ├── stores/                 # Svelte stores
│   ├── utils/                  # Helper functions
│   └── server/                 # Server-only code ($lib/server)
│       ├── db/                 # Database client & queries
│       └── auth/               # Auth logic
├── params/                     # Parameter matchers
├── routes/                     # File-based routing
│   ├── +layout.svelte          # Root layout
│   ├── +page.svelte            # Home page
│   ├── api/                    # API endpoints (+server.ts)
│   └── [slug]/                 # Dynamic routes
├── app.html                    # HTML template
├── hooks.server.ts             # Server hooks
└── hooks.client.ts             # Client hooks
static/                         # Unprocessed assets (robots.txt, favicon)
```

See [Project structure - SvelteKit Docs](https://svelte.dev/docs/kit/project-structure).

---

## Route-Centric Pattern

Logic lives in `+page.server.ts` and `+server.ts`. Shared utilities go in `$lib/server/`.

```
src/routes/
├── (app)/                      # Route group (authenticated)
│   ├── dashboard/
│   │   ├── +page.svelte
│   │   └── +page.server.ts     # All logic here
│   └── items/
│       ├── +page.server.ts     # List + create
│       └── [id]/
│           └── +page.server.ts # Read + update + delete
└── api/
    └── items/
        └── +server.ts          # JSON API
```

**Why route-centric:** Maximizes SvelteKit's automatic type inference, minimizes boilerplate.

---

## Server/Client Separation

SvelteKit enforces separation at build time.

| Convention | Purpose |
|------------|---------|
| `$lib/server/` | Directory blocked from client imports |
| `.server.ts` suffix | File blocked from client imports |
| `+page.server.ts` | Server-only load/actions |
| `+server.ts` | API endpoints (server-only) |

```typescript
// src/lib/server/db.ts — automatically blocked from client
import { drizzle } from 'drizzle-orm/neon-http';
export const db = drizzle(process.env.DATABASE_URL);
```

Importing `$lib/server/db` in client code throws a build error.

See [Server-only modules - SvelteKit Docs](https://svelte.dev/docs/kit/server-only-modules).

---

## The `$lib` Alias

`src/lib/` is accessible via `$lib` anywhere in the project.

```typescript
// Instead of: import { Button } from '../../../lib/components/Button.svelte'
import { Button } from '$lib/components/Button.svelte';
```

| Path | Access |
|------|--------|
| `$lib/components` | Client + Server |
| `$lib/utils` | Client + Server |
| `$lib/server` | Server only |

---

## Svelte 5 Runes

Explicit reactivity with runes.

| Rune | Purpose |
|------|---------|
| `$state` | Reactive state |
| `$derived` | Computed values |
| `$effect` | Side effects |
| `$props` | Component props |
| `$bindable` | Two-way binding props |

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log('Count changed:', count);
  });
</script>
```

**Outside components:** Use `.svelte.ts` extension to use runes in plain files.

See [$state](https://svelte.dev/docs/svelte/$state), [$derived](https://svelte.dev/docs/svelte/$derived), [$effect](https://svelte.dev/docs/svelte/$effect).

---

## Rendering Modes

Configure per route in `+page.ts` or `+layout.ts`.

| Mode | Config | Use Case |
|------|--------|----------|
| SSR | Default | Dynamic content, SEO |
| SSG | `export const prerender = true` | Static pages, blogs |
| SPA | `export const ssr = false` | Admin panels |
| No-JS | `export const csr = false` | Maximum performance |

```typescript
// src/routes/blog/[slug]/+page.ts
export const prerender = true;  // SSG for blog posts
```

See [Page options - SvelteKit Docs](https://svelte.dev/docs/kit/page-options).

---

## Hooks

Middleware in SvelteKit.

| Hook | File | Purpose |
|------|------|---------|
| `handle` | `hooks.server.ts` | Intercept requests (auth, logging) |
| `handleFetch` | `hooks.server.ts` | Modify fetch requests |
| `handleError` | `hooks.server.ts` | Error handling |
| `init` | `hooks.server.ts` | One-time setup |
| `reroute` | `hooks.ts` | URL rewriting |

```typescript
// src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event.cookies);
  event.locals.user = session?.user;
  return resolve(event);
};
```

See [Hooks - SvelteKit Docs](https://svelte.dev/docs/kit/hooks).

---

## Route Groups

Organize routes without affecting URLs.

```
routes/
├── (marketing)/          # No /marketing in URL
│   ├── +layout.svelte    # Marketing layout
│   ├── about/
│   └── pricing/
├── (app)/                # No /app in URL
│   ├── +layout.svelte    # App layout (with auth check)
│   └── dashboard/
└── +layout.svelte        # Root layout
```

Parentheses `()` create a group without adding URL segments.

---

## Form Actions

Progressive enhancement for forms.

```typescript
// src/routes/login/+page.server.ts
export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    // ... validate, authenticate
    return { success: true };
  }
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<form method="POST">
  <input name="email" type="email" />
  <button>Login</button>
</form>
```

Works without JavaScript. Enhanced with JS when available.

---

## Sources

### Official Documentation
- [Project structure](https://svelte.dev/docs/kit/project-structure)
- [Page options](https://svelte.dev/docs/kit/page-options)
- [Server-only modules](https://svelte.dev/docs/kit/server-only-modules)
- [Hooks](https://svelte.dev/docs/kit/hooks)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)

### Community Resources
- [SvelteKit Design Pattern (GitHub)](https://github.com/Kreonovo/SvelteKit-Design-Pattern) - MVC-style pattern
- [tRPC-SvelteKit](https://icflorescu.github.io/trpc-sveltekit/) - tRPC integration
- [Structuring larger SvelteKit apps](https://github.com/sveltejs/kit/discussions/7579) - Community discussion
