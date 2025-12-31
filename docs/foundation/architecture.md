# Architecture

Framework-agnostic architectural patterns for modern full-stack applications. These principles apply regardless of which framework implements them.

---

## Core Patterns

### Server/Client Separation

Enforce a hard boundary between server and client code.

| Server | Client |
|--------|--------|
| Database connections | UI components |
| API keys, secrets | User interactions |
| Business logic | Presentation logic |
| Auth verification | Auth state display |

**Why:** Prevents accidental exposure of secrets, reduces client bundle size, clarifies security boundaries.

**Implementation:** Use directory conventions or file suffixes that your framework enforces at build time.

---

### Route-Based Organization

Organize code by URL routes, not by technical layers.

```
routes/
├── dashboard/          # /dashboard
│   ├── page            # UI
│   └── server          # Data loading, mutations
├── items/              # /items
│   ├── page
│   ├── server
│   └── [id]/           # /items/:id
│       ├── page
│       └── server
└── api/                # /api/*
    └── items/
        └── server      # JSON endpoints
```

**Why:**
- Reduces cognitive overhead (one place to look)
- Natural code splitting by route
- Framework can generate types automatically
- Scales linearly with app size

**Alternative patterns:**
- **MVC-style**: Separate models, views, controllers. Use when strong data layer separation required.
- **Feature-based**: Group by domain (auth, billing, users). Use for large teams with feature ownership.
- **tRPC/RPC**: Centralized API layer. Use when multiple clients consume same API.

---

### Colocation

Keep related code together. Route-specific code lives with the route.

| Colocate | Centralize |
|----------|------------|
| Route-specific components | Shared UI components |
| Route-specific types | Shared types |
| Route-specific utils | Database client, auth config |

**Why:** Reduces indirection, makes dependencies explicit, simplifies deletion.

---

### Rendering Strategies

Choose rendering strategy per route based on content characteristics.

| Strategy | Characteristics | Use Case |
|----------|-----------------|----------|
| **SSR** | Dynamic, personalized, SEO-needed | Product pages, dashboards |
| **SSG** | Static, cacheable, infrequent updates | Blog posts, docs, marketing |
| **SPA** | Interactive, no SEO needed | Admin panels, authenticated apps |
| **No-JS** | Maximum performance, progressive | Landing pages, forms |

**Hybrid approach:** Most apps combine strategies. Use SSG for marketing, SSR for dynamic pages, SPA for admin.

---

### State Layers

Organize state by scope and persistence.

| Layer | Scope | Persistence | Examples |
|-------|-------|-------------|----------|
| Local | Component | None | Form inputs, UI toggles |
| Shared | Multiple components | Session | Shopping cart, filters |
| Server | Application | Database | User data, content |
| URL | Shareable | Bookmark/link | Search params, pagination |

**Flow:** Server → Shared → Local. Data flows down, events flow up.

---

### Middleware Pattern

Intercept requests/responses for cross-cutting concerns.

| Concern | Middleware handles |
|---------|-------------------|
| Auth | Verify session, attach user to request |
| Logging | Request timing, error capture |
| Rate limiting | Throttle by IP/user |
| Headers | Security headers, CORS |
| Redirects | Auth redirects, locale detection |

**Order matters:** Auth before rate limiting, logging wraps everything.

---

## Scaling Guidance

### Do

- **Start simple** — Add abstraction when pain emerges, not before
- **Enforce boundaries** — Server/client separation is non-negotiable
- **Colocate by default** — Extract to shared only when reused
- **Let types flow** — Minimize manual type definitions
- **Use path aliases** — Clean imports, easy refactoring

### Don't

- Over-abstract with unnecessary services/repositories
- Put route-specific code in shared directories
- Mix server and client code in same files
- Create deep folder hierarchies prematurely
- Duplicate framework conventions with custom ones

---

## Implementation

See [stack/core/sveltekit.md](../stack/core/sveltekit.md) for how these patterns are implemented in SvelteKit.
