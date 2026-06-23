# SvelteKit

The full-stack meta-framework — file-based routing, SSR, deployment adapters. See the `sveltekit` skill for routing and load-function patterns.

## Why was it chosen?

- Adapter system enables platform-agnostic builds — the project deploys to Vercel but can swap to Node/Bun via config.
- Rendering mode is per-route (SSR default, SSG, CSR), matching the showcase-as-documentation architecture.

**Architecture features the project relies on:**
- `$lib/server/` is blocked from client imports at build time — the load-bearing boundary for the multi-client core (see `docs/codebase-organization.md`).
- Route groups `(name)` organize routes without affecting URLs.

## Known limitations

- Vite-only bundler; cold dev start is slow on large projects.
- **Bun adapter:** `svelte-adapter-bun` is community-maintained; ORIGIN-header handling breaks form CSRF. Fallback is `adapter-node` via a single config change.

## Related

- [svelte.md](./svelte.md) - UI framework
- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Deployment adapters
