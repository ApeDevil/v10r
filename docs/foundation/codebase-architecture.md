# Velociraptor Codebase Architecture

SvelteKit supports multiple organizational patterns. This document explains which pattern Velociraptor uses and why.

## Architecture Decision

**Velociraptor uses the Route-Centric pattern.**

| Pattern | Status | Rationale |
|---------|--------|-----------|
| **Route-Centric** | ✓ CHOSEN | Minimal abstraction, leverages SvelteKit's type generation, simplest for templates |
| MVC-Style | Rejected | Over-engineered for template use case |
| tRPC | Rejected | Adds complexity without clear benefit |
| Feature-Based | Reference | Consider for large teams with distinct feature ownership |

### What is Route-Centric?

Logic lives in `+page.server.ts` and `+server.ts` files. Shared utilities (db client, auth config) go in `$lib/server/`. This maximizes SvelteKit's automatic type inference and minimizes boilerplate.

```
src/
├── lib/
│   ├── components/          # Shared UI components
│   └── server/
│       ├── db.ts            # Drizzle client
│       ├── auth/            # Better Auth setup
│       └── ai/              # AI provider config
├── routes/
│   ├── (app)/               # Authenticated routes
│   │   ├── dashboard/
│   │   │   ├── +page.svelte
│   │   │   └── +page.server.ts  # All logic here
│   │   └── items/
│   │       ├── +page.server.ts  # List + create
│   │       └── [id]/
│   │           └── +page.server.ts  # Read + update + delete
│   └── api/                 # REST endpoints
│       └── items/
│           └── +server.ts   # JSON API
```

## Server/Client Separation

`$lib/server` is automatically blocked from client imports.

- Place server-only code in `src/lib/server/`
- Or use `.server` suffix (e.g., `secrets.server.ts`)
- SvelteKit throws build error if imported in client code

This prevents accidental exposure of API keys, database connections, and secrets.

See [Server-only modules - SvelteKit Docs](https://svelte.dev/docs/kit/server-only-modules) for details.

## The `$lib` Directory

`src/lib/` is your toolbox for reusable code:

- Accessible via `$lib` alias anywhere in the project
- `$lib/server` is server-only (blocked from client bundles)
- Could later be published as an npm package

## Svelte 5 Runes

Svelte 5 uses explicit reactivity with runes (`$state`, `$derived`, `$effect`). Use `.svelte.js` or `.svelte.ts` extension to use runes outside components.

See official docs: [$state](https://svelte.dev/docs/svelte/$state), [$derived](https://svelte.dev/docs/svelte/$derived), [$effect](https://svelte.dev/docs/svelte/$effect)

## Rendering Modes

SvelteKit supports multiple rendering strategies per route:

| Mode | Use Case | Config |
|------|----------|--------|
| SSR | Dynamic content, SEO | Default |
| SSG | Static pages, blogs | `prerender = true` |
| SPA | Admin panels, dashboards | `ssr = false` |
| No-JS | Maximum performance | `csr = false` |

Configure in `+page.js` or `+layout.js`. See [Page options - SvelteKit Docs](https://svelte.dev/docs/kit/page-options).

## Scaling Guidance

> "Solve the architecture first, and you eliminate whole classes of problems before they manifest."

**Real-world validation:** Yahoo Finance runs entirely on SvelteKit with several hundred pages.

### Do

- **Route-centric first** - Start simple, add abstraction when needed
- **Server code in `$lib/server`** - Strictly enforce server/client boundary
- **Colocate route-specific code** - Keep route logic in `+page.server.ts` or `+server.ts`
- **Let ORM types flow** - SvelteKit's page data types reduce boilerplate
- **Use path aliases** - Clean imports with `$lib`, `$app`, etc.

### Don't

- Over-abstract with unnecessary services/models
- Put route-specific components in `$lib`
- Mix server and client code outside designated patterns
- Create deep folder hierarchies for small projects
- Use `hooks.ts` (use `hooks.server.ts` or `hooks.client.ts`)

---

## Reference: Alternative Patterns

These patterns are documented for reference. Consider them if the Route-Centric approach doesn't fit your project.

### MVC-Style

Separates external APIs (httpConsumers), database (repositories), and UI DTOs (views). See [SvelteKit-Design-Pattern](https://github.com/Kreonovo/SvelteKit-Design-Pattern).

Use when: Strong separation between data sources required.

### tRPC Integration

End-to-end type-safe API calls. Place tRPC router in `src/lib/trpc/` or `src/lib/server/trpc/`. See [tRPC-SvelteKit](https://icflorescu.github.io/trpc-sveltekit/).

Use when: Building a complex API layer consumed by multiple clients.

### Feature-Based

Organize by feature domains (auth, users, products) instead of technical layers. Each feature contains components, stores, and utils.

Use when: Large teams with distinct feature ownership.

---

## Official SvelteKit Structure (Reference)

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
│   ├── app.html                    # HTML template
│   ├── hooks.server.ts             # Server hooks (auth, logging, etc.)
│   └── hooks.client.ts             # Client hooks
├── static/                         # Unprocessed assets (robots.txt, favicon)
├── package.json
├── svelte.config.js
└── vite.config.ts
```

See [Project structure - SvelteKit Docs](https://svelte.dev/docs/kit/project-structure).

## Sources

### Official Documentation
- [Project structure](https://svelte.dev/docs/kit/project-structure)
- [Page options](https://svelte.dev/docs/kit/page-options)
- [Server-only modules](https://svelte.dev/docs/kit/server-only-modules)
- [Hooks](https://svelte.dev/docs/kit/hooks)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)

### Community Resources
- [SvelteKit Design Pattern (GitHub)](https://github.com/Kreonovo/SvelteKit-Design-Pattern) - MVC-style pattern
- [tRPC-SvelteKit](https://icflorescu.github.io/trpc-sveltekit/) - tRPC integration patterns
- [Structuring larger SvelteKit apps](https://github.com/sveltejs/kit/discussions/7579) - Community discussion
- [Clean Frontend Architecture with SvelteKit](https://nikoheikkila.fi/blog/clean-frontend-architecture-with-sveltekit/)
