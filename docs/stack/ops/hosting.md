# Hosting

Vercel is the only live hosting target today; a container provider is a planned portability goal (see [deployment.md](./deployment.md)).

## Provider strategy

| Subdomain | Platform | Adapter | Status |
|-----------|----------|---------|--------|
| `v10r.dev` → `www.v10r.dev` | Vercel | `adapter-vercel` | **Live** — production; the apex 308-redirects to `www` |
| `koyeb.v10r.dev` | Koyeb | `adapter-node` | **Planned** — the adapter is not installed and no such deployment exists yet |

**Domain:** `v10r.dev` (numeronym: v + 10 letters + r = velociraptor); `www.v10r.dev` is the host that serves and the one baked into `sitemap.xml`/`robots.txt`. Only `main` deploys — there are no preview hosts ([shipping.md](./shipping.md)).

## Known limitations (once a second provider lands)

- Environment variables must be synced across providers manually.
- Session cookies need compatible domain settings across both origins.

## Related

- [deployment.md](./deployment.md) - Deployment targets
- [logging.md](./logging.md) - Platform logging
