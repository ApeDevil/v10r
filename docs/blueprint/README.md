# Blueprint

Implementation designs for Velociraptor.

## What Is Velociraptor

Velociraptor is a **tech stack** (Bun, SvelteKit, Drizzle, Better Auth, etc.).

This project serves three purposes:

1. **Test** the stack - verify all components work together
2. **Document** the stack - show how to use each feature
3. **Template** for new projects - copy and build on it

These aren't separate efforts. They happen simultaneously through the same pages.

## Core Idea

**The app documents itself by being itself.**

Every showcase page serves three purposes simultaneously:

| Role | What It Does |
|------|--------------|
| **Documentation** | Explains how the feature works |
| **Test** | Proves the feature works |
| **Template** | Copy-paste reference for real projects |

## Self-Documentation

Traditional documentation drifts from reality. Code changes, docs don't. Examples rot.

Velociraptor solves this by making documentation executable:

```
Traditional:
  docs say "theme toggle works like X"
  → code changes
  → docs become wrong
  → developers get confused

Velociraptor:
  /showcase/theme IS the theme toggle
  → if page works, docs are accurate
  → if code breaks, page breaks
  → zero drift possible
```

The showcase pages ARE the documentation. Reading them shows what's possible. Using them proves it works.

## Self-Testing

No separate test suite needed for feature validation. The template tests itself through usage:

| If This Works | Then This Is Tested |
|---------------|---------------------|
| `/showcase/theme` renders | UnoCSS, CSS vars, localStorage, `$state` |
| `/showcase/forms` submits | Superforms, Valibot, server actions |
| `/showcase/data` loads | Drizzle, load functions, SSR |
| `/app/dashboard` requires login | Better Auth, sessions, route guards |
| `/showcase/files` uploads | R2, Sharp, presigned URLs |

Breaking a stack component breaks its showcase page. The failure is immediate and visible.

## Why This Works

| Problem | Traditional | Velociraptor |
|---------|-------------|--------------|
| Stale examples | Common | Impossible |
| "Works on my machine" | Hidden | Visible in deploy |
| Feature coverage gaps | Easy to miss | Page exists or doesn't |
| Onboarding confusion | Read, then try | See working, copy it |

## Documents

| File | Contents |
|------|----------|
| [pages.md](./pages.md) | Route structure, showcase pages, what each tests |
| [db/](./db/README.md) | Data layer overview and decision tree |
| [db/postgres.md](./db/postgres.md) | Drizzle schema, Better Auth tables, migrations |
| [db/graph.md](./db/graph.md) | Neo4j connection, Cypher queries, graph model |
| [tokens.md](./tokens.md) | Design tokens: breakpoints, colors, spacing, z-index |
| [styling.md](./styling.md) | UnoCSS, fluid typography, container queries |
| [components.md](./components.md) | Bits UI primitives, CVA variants, composites |
| [forms.md](./forms.md) | Superforms, Valibot validation, form patterns |
| [app-shell.md](./app-shell.md) | Sidebar, navigation, responsive layout |
| [auth.md](./auth.md) | Better Auth, OAuth, 2FA, route guards |
| [state.md](./state.md) | Svelte 5 runes, shared state, context API |
| [api.md](./api.md) | REST endpoints, GraphQL (optional), validation, CORS |
| [middleware.md](./middleware.md) | SvelteKit hooks, request handling, rate limiting |
| [error-handling.md](./error-handling.md) | Error pages, API errors, form errors |
| [i18n.md](./i18n.md) | sveltekit-i18n, locale routing, date/number formatting |

## Future Additions

- `files.md` - File uploads, R2 storage, image processing
- `testing.md` - Vitest unit tests, Playwright E2E
