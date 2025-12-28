# Deployment

## What is it?

Multi-target deployment strategy proving runtime portability. Same codebase deploys to Vercel (serverless) and container platforms. SvelteKit's adapter system enables platform-agnostic builds.

## What is it for?

- Zero-config serverless deployment (Vercel)
- Container-based deployment (Koyeb, Railway)
- Testing runtime portability across platforms
- Preview deployments per PR

## Why was it chosen?

| Target | Runtime | Platform | Use Case |
|--------|---------|----------|----------|
| Serverless | Node.js | Vercel | Zero-config, preview deploys |
| Serverless | Bun | Vercel | Experimental (28% faster) |
| Container | Bun | Koyeb | Native Bun, no cold starts |

**Vercel advantages:**
- Automatic framework detection
- Git-based deployment with PR previews
- Built-in edge caching, image optimization
- Fluid compute: 99.37% of requests have zero cold starts

**Container advantages:**
- Persistent runtime (no cold starts)
- Full Node.js/Bun API access
- Railway: 3-4x faster than Vercel in benchmarks
- True free tier (Koyeb: no credit card)

**Adapter selection:**
| Adapter | Target |
|---------|--------|
| `adapter-vercel` | Vercel (Node.js or Bun) |
| `svelte-adapter-bun` | Bun containers |
| `adapter-node` | Node.js containers |

## Known limitations

**Vercel cold starts:**
- 2-3 seconds for heavy setups (GraphQL + Prisma)
- Each cold start requires new database connections
- Mitigated by Fluid compute (Pro/Enterprise)

**Vercel lock-in:**
- Proprietary features (image optimization, ISR) create migration friction
- SvelteKit adapter system provides better portability than Next.js
- Can swap adapters without changing application code

**Bun on Vercel:**
- SvelteKit not officially listed (Next.js, Express, Hono, Nitro only)
- May break without warning
- Test thoroughly before production

**Container platforms:**
- Container sleep on free tiers causes cold starts
- Requires Dockerfile knowledge

See [vendors.md](../vendors.md#vercel) for pricing, free tier limits, and platform alternatives.

## Related

- [../core/bun.md](../core/bun.md) - Runtime
- [../core/sveltekit.md](../core/sveltekit.md) - Adapters
- [hosting.md](./hosting.md) - Domain configuration
