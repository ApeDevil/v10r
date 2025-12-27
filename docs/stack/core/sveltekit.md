# SvelteKit

## What is it?

Meta-framework for Svelte that enables full-stack web application development. Powered by Vite, it provides file-based routing, server-side rendering, and deployment adapters. Similar to Next.js (React) or Nuxt (Vue), but built on Svelte's compiler-first philosophy.

## What is it for?

- Full-stack web applications with server and client logic
- Server-Side Rendering (SSR) for SEO and initial load performance
- Static Site Generation (SSG) for documentation, blogs, marketing sites
- Hybrid applications mixing rendering modes per-route
- Progressive enhancement with form actions

**Rendering modes (configurable per route):**
| Mode | Use Case |
|------|----------|
| SSR (default) | Dynamic content, SEO |
| SSG | Static pages, blogs |
| CSR | Admin panels, heavy interactivity |

## Why was it chosen?

| Aspect | SvelteKit | Next.js | Nuxt |
|--------|-----------|---------|------|
| Bundle size | Smallest | Medium | Medium |
| Boilerplate | Minimal | Medium | Medium |
| Routing | Simple file-based | Complex (App Router) | File-based |
| Deployment | Adapters (swap targets easily) | Vercel-optimized | Nitro presets |

**Key advantages:**
- Less boilerplate than React/Vue equivalents
- ~1/3 the overhead compared to Nuxt 3 for SSR
- Single codebase for frontend and backend
- Built-in progressive form enhancement (works without JS)
- Adapter system enables platform-agnostic builds (Vercel, Node, Cloudflare, etc.)

**Architecture features:**
- `$lib/server/` directory blocked from client imports at build time
- Route groups `(name)` for organization without URL impact
- Hooks for middleware (auth, logging, error handling)
- Automatic TypeScript types from file-based routing

## Known limitations

**Ecosystem size:**
- Smaller community than React/Vue
- Fewer third-party libraries and components
- Finding Svelte developers harder than React/Vue developers

**Large project scaling:**
- IDE performance degrades on very large projects
- Build times can reach 10+ minutes in large codebases
- No esbuild/swc/rspack support (Vite only)
- Cold dev start: 1-1.5 minutes on large projects

**Bun compatibility:**
- `svelte-adapter-bun` development has stalled
- ORIGIN header issues break form CSRF protection
- Vite dev server runs on Node.js (not Bun)
- Easy fallback: switch to `adapter-node` via config

## Related

- [svelte.md](./svelte.md) - UI framework
- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Deployment adapters
