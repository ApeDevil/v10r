# Hosting

The project runs the same app on multiple providers for comparison and failover.

## Multi-provider strategy

| Subdomain | Platform | Adapter | Purpose |
|-----------|----------|---------|---------|
| `www.v10r.dev` | Vercel | `adapter-vercel` | Primary production |
| `koyeb.v10r.dev` | Koyeb | `adapter-node` | Comparison/failover, native Bun |

**Domain:** `www.v10r.dev` (numeronym: v + 10 letters + r = velociraptor) — baked into `sitemap.xml`/`robots.txt`.

## Known limitations

- Environment variables must be synced across providers manually.
- Session cookies need compatible domain settings across both origins.

## Related

- [deployment.md](./deployment.md) - Deployment targets
- [logging.md](./logging.md) - Platform logging
