# Deployment

Multi-target deployment proving runtime portability via SvelteKit's adapter system. Today only the Vercel serverless target is wired; the container target is a planned portability goal.

## Targets and adapters

| Target | Runtime | Platform | Adapter | Status |
|--------|---------|----------|---------|--------|
| Serverless | Node.js | Vercel | `adapter-vercel` | Live |
| Container | Bun | Koyeb | `svelte-adapter-bun` (fallback `adapter-node`) | Planned |

`svelte.config.js` hardcodes `adapter-vercel` (`runtime: 'nodejs22.x'`). The container adapters (`svelte-adapter-bun`, `adapter-node`) are not installed and there is no `Dockerfile` or `DEPLOY_TARGET` switch yet. Swapping adapters needs no application code changes — that portability is the point.

## Known limitations

- **Bun on Vercel:** SvelteKit isn't officially listed (Next.js, Express, Hono, Nitro only) — may break without warning.
- **Vercel lock-in:** proprietary features (image optimization, ISR) create migration friction; the adapter system contains it.

See [vendors.md](../vendors.md#vercel) for pricing, free tier limits, and platform alternatives.

## Related

- [../../blueprint/deployment.md](../../blueprint/deployment.md) - Detailed deployment guide (adapters, env parity, scheduled jobs, monitoring)
- [../core/bun.md](../core/bun.md) - Runtime
- [../core/sveltekit.md](../core/sveltekit.md) - Adapters
- [hosting.md](./hosting.md) - Domain configuration
