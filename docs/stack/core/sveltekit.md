# SvelteKit

The full-stack meta-framework — file-based routing, SSR, deployment adapters. v10r runs SvelteKit 3.1; its config (adapter, `version`, `csp`, `preprocess`) is the `sveltekit({...})` call in `vite.config.ts` — there is no `svelte.config.js`. See the `sveltekit` skill for routing and load-function patterns.

The 2 → 3 move, with every behaviour change it forced, is commit `0b080a231` (its message is the record).

## Why was it chosen?

- Adapter system enables platform-agnostic builds — the project deploys to Vercel but can swap to Node/Bun via config.
- Rendering mode is per-route (SSR default, SSG, CSR), matching the showcase-as-documentation architecture.

**Architecture features the project relies on:**
- `src/lib/server/**` and `*.server.ts` are blocked from client imports at build time, whether reached through `#lib/server/` or a relative path — the load-bearing boundary for the multi-client core (see `docs/codebase-organization.md`).
- Node subpath imports (`#lib/*`, `#patterns/*` in package.json `imports`) replace the `$lib` alias, so app code, Vitest and bare-Bun scripts resolve the same specifiers. Specifiers carry the real extension (`#lib/server/db/index.ts`): Bun does not map `.js` to `.ts` through package imports.
- Route groups `(name)` organize routes without affecting URLs.

## Known limitations

- Vite-only bundler; cold dev start is slow on large projects.
- **Bun adapter:** `svelte-adapter-bun` is community-maintained; ORIGIN-header handling breaks form CSRF. Fallback is `adapter-node` via a single config change.

## Related

- [svelte.md](./svelte.md) - UI framework
- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Deployment adapters
