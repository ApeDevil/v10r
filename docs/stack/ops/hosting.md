# Hosting

## What is it?

Domain and multi-platform hosting configuration. Strategy for running the same application on multiple providers for comparison and redundancy.

## What is it for?

- Domain management and DNS configuration
- A/B testing between hosting providers
- Failover and redundancy options
- Performance benchmarking across platforms

## Why was it chosen?

**Multi-provider strategy:**
| Subdomain | Platform | Purpose |
|-----------|----------|---------|
| `v10r.io` | Vercel | Primary production |
| `koyeb.v10r.io` | Koyeb | Comparison/failover |

**Domain:** `v10r.io` (numeronym: v + 10 letters + r = velociraptor)

**Platform configuration:**
| Platform | Adapter | Features |
|----------|---------|----------|
| Vercel | `adapter-vercel` | Edge functions, auto preview |
| Koyeb | `adapter-node` | Native Bun, container control |

## Known limitations

**DNS propagation:**
- Can take up to 48 hours globally
- Test with multiple DNS resolvers

**Multi-provider complexity:**
- Environment variables must be synced manually
- Database connections should handle both origins
- Session cookies need compatible domain settings

**Platform differences:**
- Edge function behavior varies
- Cold start characteristics differ
- Logging and monitoring require separate configuration

## Related

- [deployment.md](./deployment.md) - Deployment targets
- [logging.md](./logging.md) - Platform logging
