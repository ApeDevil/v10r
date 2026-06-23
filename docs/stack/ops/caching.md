# Caching

Two-layer strategy: edge (HTTP) caching for static/semi-static content, Redis (Upstash) for dynamic.

## Layers

| Layer | Technology | Use case |
|-------|------------|----------|
| Edge | Vercel HTTP cache | Static assets (automatic), ISR (`prerender = true`), `Cache-Control` |
| Dynamic | Redis (Upstash) | Query caching, rate limiting, session lookups, pub/sub |

**Decision flow:**
```
Need caching?
├── Static assets → Automatic (Vercel)
├── Page-level → ISR or Cache-Control
├── Query results → Redis (Upstash)
├── Rate limiting → Redis (Upstash)
└── Real-time → Redis pub/sub
```

## Known limitations

- **Edge:** best-effort, per-region; not guaranteed across deploys; authenticated content needs care.
- **Upstash HTTP:** ~4-5ms per request vs ~0.5ms for TCP Redis, but no connection overhead/pooling. Free-tier databases archived after 14 days inactive.

## Related

- [deployment.md](./deployment.md) - Vercel configuration
- [../data/postgres.md](../data/postgres.md) - Database queries
- [../data/redis.md](../data/redis.md) - Redis technology details, SDK reference, known limitations
