# Hosting

Domain strategy and multi-platform deployment configuration.

## Domain

**Primary domain:** `v10r.io`

The name is a numeronym: **v** + **10** letters (elocirapto) + **r** = velociraptor.

## Subdomain Strategy

| Subdomain | Platform | Purpose |
|-----------|----------|---------|
| `v10r.io` | Vercel | Primary production |
| `koyeb.v10r.io` | Koyeb | Secondary/comparison |

This allows A/B testing between hosting providers while maintaining a single brand identity.

## Platform Configuration

### Vercel

Primary host. Optimized for SvelteKit with edge functions and automatic preview deployments.

- Adapter: `@sveltejs/adapter-vercel`
- Region: TBD
- Environment variables: Vercel dashboard

### Koyeb

Secondary host for performance comparison and potential failover.

- Adapter: `@sveltejs/adapter-node` (or adapter-bun if supported)
- Region: TBD
- Environment variables: Koyeb dashboard

## DNS Configuration

TBD once domain is registered.

## Future Considerations

- Geographic load balancing
- Failover automation
- Performance benchmarking between platforms
