# Caching

Edge and dynamic caching strategies.

## Stack

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Edge | **HTTP Cache** | Vercel | Free, built-in, zero config |
| Dynamic | **Redis** | Upstash | 500K commands/mo free |

Start with Vercel Edge. Add Redis for query caching or real-time features.

## Edge Caching (Default)

Vercel automatically caches static assets and supports `Cache-Control` headers for dynamic content.

| Cache Type | Use Case | Configuration |
|------------|----------|---------------|
| Static | Built assets | Automatic |
| ISR | Semi-static pages | `export const prerender = true` |
| Stale-While-Revalidate | Dynamic with freshness | `Cache-Control` header |

Free with Vercel deployment. No additional setup required.

## Redis (When Needed)

Add Upstash Redis for:

| Use Case | Why Redis |
|----------|-----------|
| Query caching | Reduce database load |
| Rate limiting | Per-user/IP limits |
| Session storage | Fast session lookups |
| Real-time features | Pub/sub, queues |

## Provider: Upstash

| Tier | Commands/mo | Storage | Cost |
|------|-------------|---------|------|
| Free | 500K | 256 MB | $0 |
| Pay-as-you-go | Unlimited | Unlimited | $0.20/100K |

See [../vendors.md](../vendors.md#upstash) for details.

## Decision Flow

```
Need caching?
├── Static assets → Automatic (Vercel)
├── Page-level → ISR or Cache-Control headers
├── Query results → Redis (Upstash)
├── Rate limiting → Redis (Upstash)
└── Real-time → Redis pub/sub
```

## Related

- [deployment.md](./deployment.md) - Vercel configuration
- [../data/postgres.md](../data/postgres.md) - Database queries to cache
- [../../blueprint/caching/](../../blueprint/caching/) - Implementation details
