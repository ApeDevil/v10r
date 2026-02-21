# Caching

## What is it?

Multi-layer caching strategy combining edge caching (HTTP) with optional dynamic caching (Redis). Optimizes response times and reduces database load.

## What is it for?

- Static asset caching (automatic)
- API response caching
- Rate limiting
- Session storage
- Query result caching
- Real-time features (pub/sub)

## Why was it chosen?

| Layer | Technology | Provider | Use Case |
|-------|------------|----------|----------|
| Edge | HTTP Cache | Vercel | Static + semi-static |
| Dynamic | Redis | Upstash | Queries, rate limiting |

**Edge caching (default):**
| Type | Configuration |
|------|---------------|
| Static assets | Automatic |
| ISR | `prerender = true` |
| Stale-while-revalidate | `Cache-Control` header |

**Redis (when needed):**
| Use Case | Why Redis |
|----------|-----------|
| Query caching | Reduce DB load |
| Rate limiting | Per-user/IP limits |
| Session storage | Fast lookups |
| Real-time | Pub/sub, queues |

**Upstash pricing:**
| Tier | Commands/mo | Storage | Cost |
|------|-------------|---------|------|
| Free | 500K | 256 MB | $0 |
| Pay-as-you-go | Unlimited | Unlimited | $0.20/100K |

## Known limitations

**Edge caching:**
- Best-effort, per-region
- Not guaranteed to persist across deploys
- Cannot cache authenticated content without care

**Serverless + Redis (Upstash HTTP):**
- Higher per-request latency than TCP Redis (~4-5ms vs ~0.5ms), but no connection overhead
- No connection pooling needed (stateless HTTP)
- Free tier databases archived after 14 days of inactivity

**Cache invalidation:**
- Manual invalidation requires strategy
- ISR revalidation has delay
- Cross-region consistency not guaranteed

**Decision flow:**
```
Need caching?
├── Static assets → Automatic (Vercel)
├── Page-level → ISR or Cache-Control
├── Query results → Redis (Upstash)
├── Rate limiting → Redis (Upstash)
└── Real-time → Redis pub/sub
```

## Related

- [deployment.md](./deployment.md) - Vercel configuration
- [../data/postgres.md](../data/postgres.md) - Database queries
- [../data/redis.md](../data/redis.md) - Redis technology details, SDK reference, known limitations
- [../../implementation/cache.md](../../implementation/cache.md) - Cache showcase implementation record
