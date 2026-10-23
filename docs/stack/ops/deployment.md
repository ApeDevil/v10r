# Deployment

Multi-target deployment proving runtime portability via SvelteKit's adapter system. Today only the Vercel serverless target is wired; the container target is a planned portability goal.

## Targets and adapters

| Target | Runtime | Platform | Adapter | Status |
|--------|---------|----------|---------|--------|
| Serverless | Node.js | Vercel | `adapter-vercel` | Live |
| Container | Bun | Koyeb | `svelte-adapter-bun` (fallback `adapter-node`) | Planned |

**How a change reaches production:** squash into GitHub `main` (when Stas says "ship it") → `gitlab-sync.yml` copies it to GitLab `main` → Vercel's GitLab integration builds and deploys `main`. Feature branches never deploy (`vercel.json` `git.deploymentEnabled`) — there are no preview deployments. Full flow, setup and recovery: [shipping.md](./shipping.md).

## Runtime parity

Node 22 is the engine everywhere the code is gated or run: cloud sessions (Node 22 from the
cloud image), the local container (`Containerfile.dev` copies `node:22`), `package.json`
`engines` (`>=22`), and the functions (`adapter-vercel` `runtime: 'nodejs22.x'`, also on the
route-level `config` exports). The Vercel project's **Node.js Version** setting decides the
engine the production *build* runs on; it must read **22.x**. On 2026-10-22 it read **24.x**,
so `validate:build` (Node 22) did not test the engine Vercel builds with. Stas changes it in
the dashboard ([shipping.md](./shipping.md#one-time-configuration)).

## Adapters

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
