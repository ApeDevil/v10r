# Modern SvelteKit Codebase Architecture (2025)

## Official Structure

Complete structure from official SvelteKit documentation:

```
my-project/
├── src/
│   ├── lib/                        # Reusable code ($lib alias)
│   │   ├── components/             # Shared UI components
│   │   ├── stores/                 # Svelte stores
│   │   ├── utils/                  # Helper functions
│   │   └── server/                 # Server-only code ($lib/server)
│   │       ├── db/                 # Database client & queries
│   │       └── auth/               # Auth logic
│   ├── params/                     # Parameter matchers
│   ├── routes/                     # File-based routing
│   │   ├── +layout.svelte          # Root layout
│   │   ├── +page.svelte            # Home page
│   │   ├── api/                    # API endpoints (+server.ts)
│   │   └── [slug]/                 # Dynamic routes
│   ├── app.html                    # HTML template (%sveltekit.head%, %sveltekit.body%)
│   ├── error.html                  # Fallback error page
│   ├── hooks.server.ts             # Server hooks (handle, handleFetch, handleError)
│   ├── hooks.client.ts             # Client hooks (handleError)
│   ├── service-worker.js           # Service worker (optional)
│   └── instrumentation.server.js   # OpenTelemetry instrumentation (optional)
├── static/                         # Unprocessed assets (robots.txt, favicon)
├── tests/                          # Test files
├── .svelte-kit/                    # Generated (safe to delete)
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Svelte 5 Runes

Explicit reactivity replaces Svelte 4's implicit reactivity.

### $state - Reactive State

```svelte
<script>
  let count = $state(0);

  function increment() {
    count += 1;  // triggers reactivity
  }
</script>
```

Arrays and objects become deeply reactive proxies.

### $derived - Computed Values

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);  // auto-updates when count changes
</script>
```

For complex derivations, use `$derived.by()`:

```svelte
<script>
  let numbers = $state([1, 2, 3]);
  let total = $derived.by(() => {
    let sum = 0;
    for (const n of numbers) {
      sum += n;
    }
    return sum;
  });
</script>
```

`$derived(expression)` is equivalent to `$derived.by(() => expression)`.

### $effect - Side Effects

Runs after DOM updates when dependencies change:

```svelte
<script>
  let size = $state(50);

  $effect(() => {
    console.log('size changed:', size);
    // Return cleanup function (optional)
    return () => console.log('cleanup');
  });
</script>
```

Effects do not run during SSR.

**Rule of thumb:** Use `$derived` 90% of the time. Use `$effect` only for side effects (logging, canvas drawing, external subscriptions).

### Using Runes Outside Components

Use `.svelte.js` or `.svelte.ts` extension:

```ts
// stores.svelte.ts
export function createCounter() {
  let count = $state(0);
  return {
    get count() { return count; },
    increment() { count++; }
  };
}
```

## Server/Client Separation

`$lib/server` is automatically blocked from client imports.

**How it works:**
- Place server-only code in `src/lib/server/`
- Or name files with `.server` suffix (e.g., `secrets.server.ts`)
- SvelteKit throws build error if imported in client code

**Error message:**
```
Cannot import $lib/server/secrets.ts into client-side code
```

This prevents accidental exposure of API keys, database connections, and other secrets.

## Page Options

Configure rendering per route in `+page.js` or `+layout.js`:

### prerender (SSG)

```js
export const prerender = true;   // generate static HTML at build time
export const prerender = false;  // always server-render
export const prerender = 'auto'; // prerender but allow dynamic fallback
```

**Caveat:** Pages with form actions cannot be prerendered.

### ssr (Server-Side Rendering)

```js
export const ssr = false;  // render empty shell, hydrate on client
```

Use when page requires browser-only globals (`document`, `window`). Not recommended for SEO.

### csr (Client-Side Rendering)

```js
export const csr = false;  // no JavaScript shipped to client
```

**Critical caveats:**
- No `<script>` tags execute
- Forms cannot be progressively enhanced
- Links trigger full-page navigation
- HMR disabled in development

**Development workaround:**

```js
import { dev } from '$app/environment';
export const csr = dev;  // enable CSR only in dev
```

### Combining Options

| Goal | prerender | ssr | csr |
|------|-----------|-----|-----|
| Static site (SSG) | `true` | default | default |
| SPA (client-only) | default | `false` | default |
| No JS (pure HTML) | optional | default | `false` |

## Hooks

### Server Hooks (hooks.server.ts)

```ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Runs for every request

  // Add data to event.locals (available in load functions)
  event.locals.user = await getUser(event.cookies.get('session'));

  // Continue to route handler
  const response = await resolve(event);

  // Modify response headers if needed
  response.headers.set('x-custom-header', 'value');

  return response;
};
```

### Multiple Hooks

```ts
import { sequence } from '@sveltejs/kit/hooks';

const auth: Handle = async ({ event, resolve }) => { /* ... */ };
const logging: Handle = async ({ event, resolve }) => { /* ... */ };

export const handle = sequence(auth, logging);
```

## Large Project Architecture

### Option 1: MVC-Style Pattern

From [SvelteKit-Design-Pattern](https://github.com/Kreonovo/SvelteKit-Design-Pattern):

```
src/
├── lib/
│   └── server/
│       ├── httpConsumers/          # External API integrations
│       │   ├── users/
│       │   │   ├── index.ts
│       │   │   ├── userHttpConsumer.ts
│       │   │   └── models/
│       │   │       └── responses/
│       │   │           └── userResponse.ts
│       │   └── products/
│       ├── repositories/           # Database layer
│       │   ├── users/
│       │   │   ├── databaseConnection.ts
│       │   │   └── entities/
│       │   │       └── UserEntity.ts
│       │   └── products/
│       └── views/                  # Composite DTOs for UI
│           └── BasePageDataDto.ts
├── routes/
```

**httpConsumers**: Integration points with external APIs. Each domain has its own consumer containing request/response models.

**repositories**: Database layer with entities representing table structures.

**views**: Composite DTOs aggregating data from multiple sources for the UI.

### Option 2: tRPC Integration

Multiple valid approaches exist:

**A) Official tRPC-SvelteKit structure (`src/lib/trpc/`):**

```
src/lib/trpc/
├── t.ts              # tRPC initialization
├── context.ts        # Request context
├── router.ts         # Main router (or router/index.ts)
├── middleware.ts     # tRPC middleware
├── client.ts         # Client helper
└── routes/           # Sub-routers
    ├── users.ts
    └── products.ts
```

**B) Separate server folder (`src/server/`):**

```
src/server/
├── trpc/
│   ├── context.ts
│   └── router.ts
├── routers/
├── services/
└── validations/
```

With alias in `svelte.config.js`:

```js
export default {
  kit: {
    alias: {
      $server: 'src/server'
    }
  }
};
```

**C) Within `$lib/server` (recommended for SvelteKit):**

```
src/lib/server/
├── trpc/
│   ├── context.ts
│   └── router.ts
└── ...
```

Leverages built-in `$lib/server` import blocking.

### Option 3: Feature-Based Structure

For large teams with distinct feature ownership:

```
src/
├── lib/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── stores.svelte.ts
│   │   │   └── utils.ts
│   │   ├── users/
│   │   └── products/
│   └── shared/
│       ├── components/
│       └── utils/
├── routes/
```

### Option 4: Route-Centric (Minimal Abstraction)

Leverage SvelteKit's generated types without extra layers:

```
src/
├── lib/
│   ├── components/
│   └── server/
│       └── db.ts        # Just the database client
├── routes/
│   ├── users/
│   │   ├── +page.svelte
│   │   └── +page.server.ts  # All logic here
│   └── products/
```

SvelteKit generates page data types automatically. With an ORM like Drizzle or Prisma, you rarely need hand-written DTOs.

## The `$lib` Directory

`src/lib/` is your toolbox for reusable code:

- Accessible via `$lib` alias anywhere in the project
- `$lib/server` is server-only (blocked from client bundles)
- Could later be published as an npm package

## Path Aliases

Built-in aliases:
- `$lib` → `src/lib`
- `$lib/server` → `src/lib/server` (server-only)
- `$app/*` → SvelteKit runtime modules

Custom aliases in `svelte.config.js`:

```js
export default {
  kit: {
    alias: {
      $components: 'src/lib/components',
      $server: 'src/server'
    }
  }
};
```

Run `npm run dev` to generate tsconfig paths automatically.

## Scaling Considerations

> "Solve the architecture first, and you eliminate whole classes of problems before they manifest."

**Real-world validation:** Yahoo Finance runs entirely on SvelteKit with several hundred pages.

### Do

- Use **feature-based** organization for large teams
- Keep **server code in `$lib/server`** strictly
- **Colocate** route-specific code with routes
- Let **ORM types flow through** - SvelteKit's page data types reduce boilerplate
- Use **path aliases** for clean imports

### Don't

- Over-abstract with unnecessary services/models
- Put route-specific components in `$lib`
- Mix server and client code outside designated patterns
- Create deep folder hierarchies for small projects
- Use `hooks.ts` (use `hooks.server.ts` or `hooks.client.ts`)

## Rendering Modes

SvelteKit supports multiple rendering strategies in the same project:

| Mode | Use Case | Config | JavaScript |
|------|----------|--------|------------|
| SSR | Dynamic content, SEO | Default | Yes |
| SSG | Static pages, blogs | `prerender = true` | Yes |
| SPA | Admin panels, dashboards | `ssr = false` | Yes |
| No-JS | Maximum performance | `csr = false` | No |

Static marketing pages, server-rendered dashboards, and client-side admin tools coexist in one codebase.

## Sources

### Official Documentation
- [Project structure - SvelteKit Docs](https://svelte.dev/docs/kit/project-structure)
- [Page options - SvelteKit Docs](https://svelte.dev/docs/kit/page-options)
- [Server-only modules - SvelteKit Docs](https://svelte.dev/docs/kit/server-only-modules)
- [Hooks - SvelteKit Docs](https://svelte.dev/docs/kit/hooks)
- [$derived - Svelte Docs](https://svelte.dev/docs/svelte/$derived)
- [$effect - Svelte Docs](https://svelte.dev/docs/svelte/$effect)

### Community Resources
- [SvelteKit 2025: Modern Development Trends](https://zxce3.net/posts/sveltekit-2025-modern-development-trends-and-best-practices/)
- [Clean Frontend Architecture with SvelteKit](https://nikoheikkila.fi/blog/clean-frontend-architecture-with-sveltekit/)
- [SvelteKit Design Pattern (GitHub)](https://github.com/Kreonovo/SvelteKit-Design-Pattern)
- [Structuring larger SvelteKit apps (Discussion)](https://github.com/sveltejs/kit/discussions/7579)
- [SvelteKit scaling discussion](https://github.com/sveltejs/kit/discussions/13455)
- [tRPC-SvelteKit suggested structure](https://icflorescu.github.io/trpc-sveltekit/suggested-structure)
- [SvelteKit tRPC Guide](https://michaelbelete.com/sveltekit-trpc-scalable-apps/)
- [SvelteKit Project Structure Explained](https://joyofcode.xyz/sveltekit-project-structure)
- [Learn SvelteKit Hooks](https://joyofcode.xyz/sveltekit-hooks)
